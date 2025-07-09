import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
import chromadb
from chromadb.config import Settings
import numpy as np
import os
import re
import datetime
from dotenv import load_dotenv
load_dotenv()

from database import get_db
from models import Document, SearchResult
from langchain.embeddings import OpenAIEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter

logger = logging.getLogger(__name__)

class NamedEmbeddingFunction:
    def __init__(self, embedder, name="openai"):
        self.embedder = embedder
        self._name = name

    def __call__(self, input):
        # ChromaDB expects input to be either a single string or a list of strings
        if isinstance(input, str):
            return self.embedder.embed_query(input)
        elif isinstance(input, list):
            return self.embedder.embed_documents(input)
        else:
            raise ValueError("Input must be a string or list of strings")

    def embed_query(self, text):
        return self.embedder.embed_query(text)

    def name(self):
        return self._name

class SearchService:
    """Service for semantic search using ChromaDB"""
    
    def __init__(self):
        self.client = None
        self._client = None
        self.collection = None
        self._collection = None
        self.embeddings_dir = Path("./data/embeddings")
        self.embeddings_dir.mkdir(parents=True, exist_ok=True)
        self._embedding_function = None
        self._embedding_dimension = None
    
    def _extract_filenames_from_query(self, query: str) -> List[str]:
        """
        Extract potential filenames from a query string.
        Handles various formats like "test1.pdf", "test1", "show me test1.pdf", etc.
        """
        filenames = []
        
        # Convert to lowercase for case-insensitive matching
        query_lower = query.lower()
        
        # Pattern 1: Exact filename with extension (e.g., "test1.pdf", "document.docx")
        filename_pattern = r'\b([a-zA-Z0-9_\-\s]+\.(pdf|doc|docx|txt|rtf|odt|pages|epub|mobi|azw3|html|htm|xml|json|csv|md|tex|odf|ods|odp|ppt|pptx|xls|xlsx))\b'
        matches = re.findall(filename_pattern, query_lower)
        for match in matches:
            filenames.append(match[0])  # match[0] is the full filename, match[1] is the extension
        
        # Pattern 2: Filename without extension (e.g., "test1", "document")
        # This is more aggressive and might catch false positives
        no_ext_pattern = r'\b([a-zA-Z0-9_\-\s]{2,20})\b'
        no_ext_matches = re.findall(no_ext_pattern, query_lower)
        
        # Filter out common words that are unlikely to be filenames
        common_words = {
            'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
            'show', 'me', 'what', 'is', 'in', 'contains', 'summary', 'file', 'document',
            'pdf', 'doc', 'txt', 'test', 'example', 'sample', 'this', 'that', 'these', 'those'
        }
        
        for match in no_ext_matches:
            if match not in common_words and len(match) >= 2:
                filenames.append(match)
        
        # Remove duplicates while preserving order
        seen = set()
        unique_filenames = []
        for filename in filenames:
            if filename not in seen:
                seen.add(filename)
                unique_filenames.append(filename)
        
        return unique_filenames
    
    def _normalize_filename(self, filename: str) -> str:
        """
        Normalize a filename for comparison (lowercase, trim, remove extra spaces)
        """
        return re.sub(r'\s+', ' ', filename.lower().strip())
    
    def _calculate_filename_boost(self, result_filename: str, query_filenames: List[str]) -> float:
        """
        Calculate a boost score for a result based on filename matches.
        Returns a boost multiplier (1.0 = no boost, higher = more boost)
        """
        if not query_filenames:
            return 1.0
        
        result_normalized = self._normalize_filename(result_filename)
        
        for query_filename in query_filenames:
            query_normalized = self._normalize_filename(query_filename)
            
            # Exact match (highest boost)
            if result_normalized == query_normalized:
                return 2.0
            
            # Filename without extension matches
            result_name = result_normalized.rsplit('.', 1)[0] if '.' in result_normalized else result_normalized
            query_name = query_normalized.rsplit('.', 1)[0] if '.' in query_normalized else query_normalized
            
            if result_name == query_name:
                return 1.8
            
            # Contains match (partial filename)
            if query_name in result_name or result_name in query_name:
                return 1.5
            
            # Fuzzy match (case-insensitive substring)
            if query_normalized in result_normalized or result_normalized in query_normalized:
                return 1.3
        
        return 1.0
    
    def _apply_filters(self, search_results: List[Dict[str, Any]], filters: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Apply filters to search results based on metadata.
        Supports:
        - filetype: filter by file type (case-insensitive)
        - folder: substring match on file_path
        - import_time_after: only include results imported after this ISO date
        - import_time_before: only include results imported before this ISO date
        """
        filtered_results = []
        for result in search_results:
            filename = result.get("filename", "").lower()
            file_path = result.get("file_path", "").lower()
            import_time = result.get("import_time")
            # Filetype filter
            if "filetype" in filters:
                requested_filetype = filters["filetype"].lower()
                if "." in filename:
                    file_extension = filename.split(".")[-1]
                else:
                    file_extension = ""
                if file_extension != requested_filetype:
                    continue
            # Folder/path filter (substring match)
            if "folder" in filters:
                if filters["folder"].lower() not in file_path:
                    continue
            # Import time after filter
            if "import_time_after" in filters and import_time:
                if import_time < filters["import_time_after"]:
                    continue
            # Import time before filter
            if "import_time_before" in filters and import_time:
                if import_time > filters["import_time_before"]:
                    continue
            filtered_results.append(result)
        return filtered_results
    
    def _get_embedding_function(self):
        """Get the embedding function for ChromaDB"""
        if self._embedding_function is None:
            try:
                api_key = os.getenv("OPENAI_API_KEY")
                if api_key:
                    # Use OpenAI embeddings
                    embedder = OpenAIEmbeddings(openai_api_key=api_key)
                    self._embedding_function = NamedEmbeddingFunction(embedder, name="openai")
                    self._embedding_dimension = 1536  # OpenAI text-embedding-ada-002 dimension
                    logger.info("Using OpenAI embeddings (1536 dimensions)")
                else:
                    # Fallback to simple embeddings
                    self._embedding_function = None
                    self._embedding_dimension = 384
                    logger.warning("OpenAI API key not found, using simple embeddings (384 dimensions)")
            except Exception as e:
                logger.error(f"Failed to initialize OpenAI embeddings: {e}")
                self._embedding_function = None
                self._embedding_dimension = 384
                logger.warning("Falling back to simple embeddings (384 dimensions)")
        
        return self._embedding_function, self._embedding_dimension
    
    def _create_chunks(self, text: str, document: Document) -> tuple[List[str], List[Dict[str, Any]]]:
        """
        Create chunks from text using LangChain's RecursiveCharacterTextSplitter
        Returns tuple of (chunks, metadatas)
        """
        try:
            # Initialize the text splitter with specified parameters
            text_splitter = RecursiveCharacterTextSplitter(
                separators=["\n\n", "\n", ".", " "],
                chunk_size=750,
                chunk_overlap=150,
                length_function=len,
                is_separator_regex=False
            )
            
            # Split the text into chunks
            chunks = text_splitter.split_text(text)
            
            # Filter out empty or too-short chunks
            valid_chunks = []
            metadatas = []
            
            for i, chunk in enumerate(chunks):
                if chunk and len(chunk.strip()) >= 50:  # Minimum 50 characters
                    valid_chunks.append(chunk.strip())
                    
                    # Create metadata for this chunk
                    metadata = {
                        "document_id": document.id,
                        "filename": document.filename,
                        "filetype": document.file_type,
                        "source_path": document.file_path,
                        "import_time": datetime.datetime.now().isoformat(),
                        "chunk_index": i,
                        "chunk_size": len(chunk.strip())
                    }
                    metadatas.append(metadata)
                else:
                    logger.debug(f"Skipping chunk {i} for {document.filename} - too short or empty")
            
            logger.info(f"Created {len(valid_chunks)} valid chunks from {document.filename} ({len(text)} chars)")
            return valid_chunks, metadatas
            
        except Exception as e:
            logger.error(f"Error creating chunks for {document.filename}: {e}")
            # Fallback: return the original text as a single chunk
            fallback_metadata = {
                "document_id": document.id,
                "filename": document.filename,
                "filetype": document.file_type,
                "source_path": document.file_path,
                "import_time": datetime.datetime.now().isoformat(),
                "chunk_index": 0,
                "chunk_size": len(text)
            }
            return [text], [fallback_metadata]
    
    async def initialize(self):
        """Initialize ChromaDB client and collection"""
        try:
            # Initialize ChromaDB client with persistent storage
            self._client = chromadb.PersistentClient(
                path=str(self.embeddings_dir),
                settings=Settings(
                    anonymized_telemetry=False,
                    allow_reset=True
                )
            )
            logger.info("ChromaDB client initialized successfully")
            
            # Get embedding function and dimension
            embedding_function, embedding_dim = self._get_embedding_function()
            
            # Delete existing collection if it exists (to handle dimension mismatch)
            try:
                self._client.delete_collection("sortseek")
                logger.info("Deleted existing collection to handle embedding dimension mismatch")
            except:
                pass  # Collection doesn't exist, which is fine
            
            # Get or create collection with proper embedding function
            self._collection = self._client.get_or_create_collection(
                name="sortseek",
                embedding_function=embedding_function,
                metadata={
                    "description": "Document embeddings for semantic search",
                    "hnsw:space": "cosine",
                    "embedding_dimension": str(embedding_dim)
                }
            )
            self.collection = self._collection
            
            # Ensure collection is initialized
            if self._collection is None:
                logger.error("Failed to initialize ChromaDB collection")
                raise RuntimeError("ChromaDB collection initialization failed")
            
            logger.info(f"ChromaDB collection 'sortseek' created/loaded successfully with {embedding_dim} dimensions")
            logger.info("Search service initialized successfully")
            
            # Index existing documents
            await self._index_existing_documents()
        except Exception as e:
            logger.error(f"Failed to initialize search service: {e}")
            raise
    
    async def _index_existing_documents(self):
        """Index all documents that haven't been indexed yet"""
        try:
            db = next(get_db())
            unindexed_docs = db.query(Document).filter(Document.is_indexed == False).all()
            
            if unindexed_docs:
                logger.info(f"Indexing {len(unindexed_docs)} unindexed documents")
                
                for doc in unindexed_docs:
                    await self.index_document(doc)
                    
        except Exception as e:
            logger.error(f"Error indexing existing documents: {e}")
    
    async def index_document(self, document: Document):
        """Index a single document"""
        try:
            # Debug print at the very top
            print(f"📥 Entered index_document() with file: {document.filename}")
            
            # Debug print as requested
            print(f"📄 Document ready to index: {document.filename} → {len(document.content) if document.content else 0} chars")
            
            # Check if document has content
            content_to_index = document.content
            
            # If no content, try to get it from the file or use summary
            if not content_to_index or len(content_to_index.strip()) == 0:
                logger.warning(f"Document {document.id} ({document.filename}) has no content to index")
                
                # Try to use summary if available
                if document.summary and len(document.summary.strip()) > 0:
                    logger.info(f"Using summary as content for document {document.id} ({document.filename})")
                    content_to_index = document.summary
                else:
                    # Try to re-extract content from the file
                    try:
                        from services.file_service import FileService
                        file_service = FileService()
                        re_extracted_content = await file_service._extract_content(Path(document.file_path))
                        
                        if re_extracted_content and len(re_extracted_content.strip()) > 0:
                            logger.info(f"Successfully re-extracted content for document {document.id} ({document.filename})")
                            content_to_index = re_extracted_content
                            
                            # Update the document in database with the extracted content
                            db = next(get_db())
                            doc = db.query(Document).filter(Document.id == document.id).first()
                            if doc:
                                doc.content = content_to_index
                                db.commit()
                                logger.info(f"Updated document {document.id} with re-extracted content")
                        else:
                            logger.warning(f"Could not re-extract content for document {document.id} ({document.filename}) - skipping indexing")
                            return
                    except Exception as e:
                        logger.error(f"Error re-extracting content for document {document.id} ({document.filename}): {e}")
                        logger.warning(f"Skipping indexing for document {document.id} ({document.filename}) due to content extraction failure")
                        return
            
            # Final check - if we still don't have content, skip indexing
            if not content_to_index or len(content_to_index.strip()) == 0:
                logger.warning(f"Document {document.id} ({document.filename}) has no content after all attempts - skipping indexing")
                return
            
            # Debug print for final content length
            print(f"📄 Final content length for {document.filename}: {len(content_to_index)}")
            
            # Debug print for indexing
            print(f"📥 Indexing document: {document.filename} — {len(content_to_index)} characters")
            
            # Log whether this is raw content or summarized content
            if document.summary and len(document.summary.strip()) > 0:
                print(f"🧠 Indexing summarized content for {document.filename}")
            else:
                print(f"📄 Auto-indexing raw content for {document.filename}")
                
            if self._collection is None:
                logger.error("ChromaDB collection is not initialized. Cannot index document.")
                return
            
            # Create chunks using RecursiveCharacterTextSplitter
            chunks, chunk_metadatas = self._create_chunks(content_to_index, document)
            
            if not chunks:
                logger.warning(f"No valid chunks created for document {document.id} ({document.filename}) - skipping indexing")
                return
            
            # Index chunks using the existing index_document_chunks method
            await self.index_document_chunks(document, chunks, chunk_metadatas)
            
            # Mark as indexed in database
            db = next(get_db())
            doc = db.query(Document).filter(Document.id == document.id).first()
            if doc:
                doc.is_indexed = True
                doc.embedding_path = f"doc_{document.id}_chunked"
                doc.last_indexed_at = datetime.datetime.utcnow()
                db.commit()
            
            logger.info(f"Successfully indexed document {document.id}: {document.filename} ({len(chunks)} chunks)")
            
        except Exception as e:
            logger.error(f"Error indexing document {document.id}: {e}")
    
    def _create_simple_embedding(self, text: str) -> List[float]:
        """Create a simple embedding for text (fallback implementation)"""
        # Create a simple hash-based embedding
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        
        # Convert to 384-dimensional vector (consistent with fallback dimension)
        embedding = []
        for i in range(384):
            embedding.append(float(hash_bytes[i % 16]) / 255.0)
        
        # Debug print for embedding dimension
        print(f"🔢 Created simple embedding: {len(embedding)} dimensions")
        
        return embedding
    
    def _get_openai_embedding(self, text: str) -> list:
        """Get OpenAI embedding for a text chunk using LangChain"""
        try:
            embedding_function, _ = self._get_embedding_function()
            
            if embedding_function:
                embedding = embedding_function.embed_query(text)
                
                # Debug print for embedding dimension
                print(f"🔢 Created OpenAI embedding: {len(embedding)} dimensions")
                
                return embedding
            else:
                logger.warning("OpenAI embeddings not available, falling back to simple embedding")
                return self._create_simple_embedding(text)
                
        except Exception as e:
            logger.error(f"OpenAI embedding failed: {e}")
            logger.warning("Falling back to simple embedding")
            return self._create_simple_embedding(text)
    
    def _get_embedding(self, text: str) -> list:
        """Get embedding using the configured embedding function"""
        try:
            embedding_function, embedding_dim = self._get_embedding_function()
            
            if embedding_function:
                # Use OpenAI embeddings (wrapped)
                embedding = embedding_function.embed_query(text)
                print(f"🔢 Created OpenAI embedding: {len(embedding)} dimensions")
                return embedding
            else:
                # Use simple embeddings
                embedding = self._create_simple_embedding(text)
                print(f"🔢 Created simple embedding: {len(embedding)} dimensions")
                return embedding
                
        except Exception as e:
            logger.error(f"Embedding failed: {e}")
            logger.warning("Falling back to simple embedding")
            return self._create_simple_embedding(text)

    async def index_document_chunks(self, document: Document, chunks: list, chunk_metadatas: list):
        """Index a list of text chunks for a document, with metadata for each chunk"""
        try:
            # Debug print for chunks
            print(f"📄 Document chunks ready to index: {document.filename} → {len(chunks)} chunks")
            
            if not chunks or not any(c.strip() for c in chunks):
                logger.warning(f"Document {document.id} ({document.filename}) has no content chunks to index")
                return
                
            if self._collection is None:
                logger.error("ChromaDB collection is not initialized. Cannot index document chunks.")
                return
                
            # Filter out empty chunks
            valid_chunks = []
            valid_metadatas = []
            
            for i, (chunk, metadata) in enumerate(zip(chunks, chunk_metadatas)):
                if chunk and chunk.strip():
                    valid_chunks.append(chunk)
                    valid_metadatas.append(metadata)
                else:
                    logger.warning(f"Skipping empty chunk {i} for document {document.id} ({document.filename})")
            
            if not valid_chunks:
                logger.warning(f"No valid chunks found for document {document.id} ({document.filename}) - skipping indexing")
                return
            
            # Debug print for chunk creation
            print(f"✂️ Created {len(valid_chunks)} chunks for {document.filename}")
            
            # Debug print before adding to Chroma
            print(f"📊 Adding {len(valid_chunks)} chunks to Chroma for {document.filename}")
                
            embeddings = [self._get_embedding(chunk) for chunk in valid_chunks]
            ids = [f"doc_{document.id}_chunk_{metadata.get('chunk_index', i)}" for i, metadata in enumerate(valid_metadatas)]
            
            # Wrap the add call in try/except with individual chunk logging
            for i, (chunk, embedding, metadata, chunk_id) in enumerate(zip(valid_chunks, embeddings, valid_metadatas, ids)):
                try:
                    self._collection.add(
                        embeddings=[embedding],
                        documents=[chunk],
                        metadatas=[metadata],
                        ids=[chunk_id]
                    )
                    print(f"✅ Indexed chunk {i}: {chunk[:100]}...")
                except Exception as e:
                    print(f"❌ Failed to index chunk {i}: {e}")
            
            logger.info(f"Indexed {len(valid_chunks)} chunks for document {document.id}: {document.filename}")
            
        except Exception as e:
            logger.error(f"Error indexing document chunks for {document.id}: {e}")
    
    async def search_documents(self, query: str, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """Search documents using semantic search"""
        try:
            if not self.collection:
                logger.error("Search service not initialized")
                return []
            
            # Create embedding for query
            query_embedding = self._get_embedding(query)
            
            # Search in ChromaDB
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=limit + skip,
                include=["documents", "metadatas", "distances"]
            )
            
            # Process results
            search_results = []
            db = next(get_db())
            
            for i, (doc_id, metadata, distance, content) in enumerate(
                zip(results['ids'][0], results['metadatas'][0], results['distances'][0], results['documents'][0])
            ):
                if i < skip:
                    continue
                
                if i >= skip + limit:
                    break
                
                # Get full document from database
                document = db.query(Document).filter(Document.id == metadata['document_id']).first()
                if document:
                    # Calculate similarity score (1 - distance)
                    score = 1.0 - distance
                    
                    # Find matching text snippet
                    matched_text = self._find_matching_snippet(query, content)
                    
                    search_result = SearchResult(
                        document_id=document.id,
                        filename=document.filename,
                        file_path=document.file_path,
                        content=document.content,
                        score=score,
                        matched_text=matched_text
                    )
                    
                    search_results.append(search_result.to_dict())
            
            return search_results
            
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return []
    
    def _find_matching_snippet(self, query: str, content: str, max_length: int = 200) -> str:
        """Find a relevant snippet of text that matches the query"""
        try:
            # Simple implementation: find the first occurrence of query words
            query_words = query.lower().split()
            content_lower = content.lower()
            
            # Find the best matching position
            best_pos = -1
            best_score = 0
            
            for word in query_words:
                pos = content_lower.find(word)
                if pos != -1:
                    # Count how many query words are near this position
                    score = 0
                    for other_word in query_words:
                        if other_word in content_lower[max(0, pos-50):pos+50]:
                            score += 1
                    
                    if score > best_score:
                        best_score = score
                        best_pos = pos
            
            if best_pos != -1:
                # Extract snippet around the best position
                start = max(0, best_pos - max_length // 2)
                end = min(len(content), start + max_length)
                
                snippet = content[start:end]
                if start > 0:
                    snippet = "..." + snippet
                if end < len(content):
                    snippet = snippet + "..."
                
                return snippet
            
            # Fallback: return first part of content
            return content[:max_length] + "..." if len(content) > max_length else content
            
        except Exception as e:
            logger.error(f"Error finding matching snippet: {e}")
            return content[:max_length] + "..." if len(content) > max_length else content
    
    async def semantic_search(self, query: str, top_k: int = 5, filters: Optional[Dict[str, Any]] = None) -> list:
        """Semantic search for top_k relevant chunks using OpenAI embeddings and ChromaDB"""
        try:
            print(f"🔍 Starting semantic search for query: '{query}' (top_k={top_k})")
            
            if not self.collection:
                logger.error("Search service not initialized")
                print("❌ Search service not initialized")
                return []
                
            # Extract filenames from the query
            query_filenames = self._extract_filenames_from_query(query)
            print(f"🔗 Extracted filenames from query: {query_filenames}")
            
            # Check collection count
            try:
                count = self.collection.count()
                print(f"📊 ChromaDB collection has {count} documents")
            except Exception as e:
                print(f"⚠️ Could not get collection count: {e}")
            
            query_embedding = self._get_embedding(query)
            print(f"🔢 Created query embedding: {len(query_embedding)} dimensions")
            
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"]
            )
            
            print(f"🔍 ChromaDB query returned: {results}")
            
            if not results or not results.get('documents') or not results['documents'][0]:
                logger.warning("ChromaDB returned no matches for semantic search.")
                print("❌ No matches found in ChromaDB")
                return []
                
            print(f"✅ Found {len(results['documents'][0])} matches")
            
            search_results = []
            for i, (doc, meta, dist) in enumerate(zip(results['documents'][0], results['metadatas'][0], results['distances'][0])):
                score = 1.0 - dist
                filename_boost = self._calculate_filename_boost(meta.get("filename"), query_filenames)
                final_score = score * filename_boost
                # Clamp the final score to [0, 1] range to prevent scores > 1.0
                final_score = max(0.0, min(1.0, final_score))
                print(f"📄 Match {i+1}: {meta.get('filename', 'Unknown')} (score: {final_score:.3f}, distance: {dist:.3f}, boost: {filename_boost:.2f})")
                search_results.append({
                    "filename": meta.get("filename"),
                    "file_path": meta.get("source_path"),  # Use source_path from new metadata
                    "page": meta.get("page"),
                    "content": doc,
                    "score": final_score,
                    "original_score": score,
                    "filename_boost": filename_boost,
                    "metadata": {
                        "filetype": meta.get("filetype"),
                        "import_time": meta.get("import_time"),
                        "source_path": meta.get("source_path")
                    }
                })
            
            # Re-rank results by final score (highest first)
            search_results.sort(key=lambda x: x["score"], reverse=True)
            
            # Apply filters if provided
            if filters:
                original_count = len(search_results)
                search_results = self._apply_filters(search_results, filters)
                filtered_count = len(search_results)
                print(f"🔍 Applied filters: {original_count} → {filtered_count} results")
            
            # Log filename boost summary
            if query_filenames:
                boosted_results = [r for r in search_results if r["filename_boost"] > 1.0]
                if boosted_results:
                    print(f"🚀 Applied filename boost to {len(boosted_results)} results for query filenames: {query_filenames}")
                    for result in boosted_results[:3]:  # Show top 3 boosted results
                        print(f"   📈 {result['filename']}: {result['original_score']:.3f} → {result['score']:.3f} (boost: {result['filename_boost']:.2f})")
                else:
                    print(f"ℹ️ No filename matches found for query filenames: {query_filenames}")
            
            print(f"🎯 Returning {len(search_results)} re-ranked search results")
            return search_results
            
        except Exception as e:
            logger.error(f"Semantic search failed: {e}")
            print(f"❌ Semantic search failed: {e}")
            return []
    
    async def is_healthy(self) -> bool:
        """Check if the search service is healthy"""
        try:
            return self.client is not None and self.collection is not None
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    async def is_collection_empty(self) -> bool:
        """Check if the ChromaDB collection is empty"""
        try:
            if not self.collection:
                logger.warning("Collection not initialized, considering it empty")
                return True
            
            count = self.collection.count()
            logger.info(f"ChromaDB collection has {count} documents")
            return count == 0
        except Exception as e:
            logger.error(f"Error checking collection count: {e}")
            return True  # Consider empty if we can't check
    
    async def reindex_all_documents(self) -> dict:
        """
        Reindex all documents in the database if the collection is empty.
        Returns a summary of the reindexing operation.
        """
        try:
            logger.info("Starting full reindex of all documents...")
            
            # Get all documents from database
            db = next(get_db())
            all_documents = db.query(Document).all()
            
            if not all_documents:
                logger.info("No documents found in database, skipping reindex")
                return {
                    "success": True,
                    "message": "No documents found in database",
                    "documents_processed": 0,
                    "documents_indexed": 0,
                    "chunks_created": 0
                }
            
            logger.info(f"Found {len(all_documents)} documents in database")
            
            documents_processed = 0
            documents_indexed = 0
            total_chunks = 0
            
            for document in all_documents:
                documents_processed += 1
                logger.info(f"Processing document {documents_processed}/{len(all_documents)}: {document.filename}")
                
                # Check if document has content or summary
                has_content = document.content and len(document.content.strip()) > 0
                has_summary = document.summary and len(document.summary.strip()) > 0
                
                if not has_content and not has_summary:
                    logger.warning(f"Skipping document {document.id} ({document.filename}) - no content or summary available")
                    continue
                
                # Try to re-extract content if needed
                content_to_index = document.content
                if not has_content and has_summary:
                    logger.info(f"Using summary for document {document.id} ({document.filename})")
                    content_to_index = document.summary
                elif not has_content:
                    # Try to re-extract content from the file
                    try:
                        from services.file_service import FileService
                        file_service = FileService()
                        re_extracted_content = await file_service._extract_content(Path(document.file_path))
                        
                        if re_extracted_content and len(re_extracted_content.strip()) > 0:
                            logger.info(f"Successfully re-extracted content for document {document.id} ({document.filename})")
                            content_to_index = re_extracted_content
                            
                            # Update the document in database with the extracted content
                            doc = db.query(Document).filter(Document.id == document.id).first()
                            if doc:
                                doc.content = content_to_index
                                db.commit()
                                logger.info(f"Updated document {document.id} with re-extracted content")
                        else:
                            logger.warning(f"Could not re-extract content for document {document.id} ({document.filename}) - skipping")
                            continue
                    except Exception as e:
                        logger.error(f"Error re-extracting content for document {document.id} ({document.filename}): {e}")
                        logger.warning(f"Skipping document {document.id} ({document.filename}) due to content extraction failure")
                        continue
                
                # Index the document
                try:
                    await self.index_document(document)
                    documents_indexed += 1
                    
                    # Get chunk count for this document (approximate)
                    if content_to_index:
                        # Rough estimate: assume ~500 characters per chunk
                        estimated_chunks = max(1, len(content_to_index) // 500)
                        total_chunks += estimated_chunks
                    
                    logger.info(f"Successfully indexed document {document.id} ({document.filename})")
                except Exception as e:
                    logger.error(f"Failed to index document {document.id} ({document.filename}): {e}")
                    continue
            
            logger.info(f"Full reindex completed: {documents_indexed}/{documents_processed} documents indexed, ~{total_chunks} chunks created")
            
            return {
                "success": True,
                "message": f"Successfully reindexed {documents_indexed}/{documents_processed} documents",
                "documents_processed": documents_processed,
                "documents_indexed": documents_indexed,
                "chunks_created": total_chunks
            }
            
        except Exception as e:
            logger.error(f"Full reindex failed: {e}")
            return {
                "success": False,
                "message": f"Reindex failed: {str(e)}",
                "documents_processed": 0,
                "documents_indexed": 0,
                "chunks_created": 0
            }
    
    async def cleanup(self):
        """Cleanup resources"""
        try:
            if self.client:
                self.client.reset()
            logger.info("Search service cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
    async def reset_embeddings(self):
        """Reset all embeddings by deleting the embeddings directory"""
        try:
            import shutil
            if self.embeddings_dir.exists():
                shutil.rmtree(self.embeddings_dir)
                logger.info(f"Deleted embeddings directory: {self.embeddings_dir}")
            
            # Reset embedding function to force re-initialization
            self._embedding_function = None
            self._embedding_dimension = None
            
            # Recreate directory
            self.embeddings_dir.mkdir(parents=True, exist_ok=True)
            logger.info("Embeddings directory reset successfully")
            
        except Exception as e:
            logger.error(f"Error resetting embeddings: {e}")
    
    async def reindex_document(self, document_id: int):
        """Reindex a specific document"""
        try:
            db = next(get_db())
            document = db.query(Document).filter(Document.id == document_id).first()
            
            if document:
                # Remove old embedding if exists
                if document.embedding_path:
                    try:
                        self.collection.delete(ids=[document.embedding_path])
                    except:
                        pass
                
                # Reindex
                await self.index_document(document)
                
        except Exception as e:
            logger.error(f"Error reindexing document {document_id}: {e}")
    
    async def update_document_content(self, document_id: int, new_content: str, content_type: str = "content"):
        """Update document content and reindex it"""
        try:
            db = next(get_db())
            document = db.query(Document).filter(Document.id == document_id).first()
            
            if not document:
                logger.error(f"Document {document_id} not found")
                return False
            
            # Update the appropriate field
            if content_type == "summary":
                document.summary = new_content
                logger.info(f"Updated summary for document {document_id}: {document.filename}")
            else:
                document.content = new_content
                logger.info(f"Updated content for document {document_id}: {document.filename}")
            
            # Mark as not indexed so it gets reindexed
            document.is_indexed = False
            document.embedding_path = None
            
            db.commit()
            
            # Reindex the document
            await self.index_document(document)
            
            return True
            
        except Exception as e:
            logger.error(f"Error updating document content for {document_id}: {e}")
            return False 