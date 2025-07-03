import asyncio
from typing import List, Dict, Any, Optional
from pathlib import Path
import logging
import chromadb
from chromadb.config import Settings
import numpy as np

from database import get_db
from models import Document, SearchResult

logger = logging.getLogger(__name__)

class SearchService:
    """Service for semantic search using ChromaDB"""
    
    def __init__(self):
        self.client = None
        self._client = None
        self.collection = None
        self._collection = None
        self.embeddings_dir = Path("./data/embeddings")
        self.embeddings_dir.mkdir(parents=True, exist_ok=True)
    
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
            
            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name="sortseek",
                metadata={"description": "Document embeddings for semantic search"}
            )
            self.collection = self._collection
            
            # Ensure collection is initialized
            if self._collection is None:
                logger.error("Failed to initialize ChromaDB collection")
                raise RuntimeError("ChromaDB collection initialization failed")
            
            logger.info("ChromaDB collection 'sortseek' created/loaded successfully")
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
            if not document.content or len(document.content.strip()) == 0:
                logger.warning(f"Document {document.id} has no content to index")
                return
                
            if self._collection is None:
                logger.error("ChromaDB collection is not initialized. Cannot index document.")
                return
                
            # Create embedding for the document
            embedding = self._create_simple_embedding(document.content)
            
            # Add to ChromaDB collection
            self._collection.add(
                embeddings=[embedding],
                documents=[document.content],
                metadatas=[{
                    "document_id": document.id,
                    "filename": document.filename,
                    "file_path": document.file_path,
                    "file_type": document.file_type
                }],
                ids=[f"doc_{document.id}"]
            )
            
            # Mark as indexed in database
            db = next(get_db())
            doc = db.query(Document).filter(Document.id == document.id).first()
            if doc:
                doc.is_indexed = True
                doc.embedding_path = f"doc_{document.id}"
                db.commit()
            
            logger.info(f"Successfully indexed document {document.id}: {document.filename}")
            
        except Exception as e:
            logger.error(f"Error indexing document {document.id}: {e}")
    
    def _create_simple_embedding(self, text: str) -> List[float]:
        """Create a simple embedding for text (placeholder implementation)"""
        # This is a placeholder - in a real implementation, you'd use:
        # - OpenAI embeddings
        # - Sentence transformers
        # - Or another embedding model
        
        # For now, create a simple hash-based embedding
        import hashlib
        hash_obj = hashlib.md5(text.encode())
        hash_bytes = hash_obj.digest()
        
        # Convert to 384-dimensional vector (similar to some embedding models)
        embedding = []
        for i in range(384):
            embedding.append(float(hash_bytes[i % 16]) / 255.0)
        
        return embedding
    
    async def search_documents(self, query: str, skip: int = 0, limit: int = 20) -> List[Dict[str, Any]]:
        """Search documents using semantic search"""
        try:
            if not self.collection:
                logger.error("Search service not initialized")
                return []
            
            # Create embedding for query
            query_embedding = self._create_simple_embedding(query)
            
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
    
    async def is_healthy(self) -> bool:
        """Check if the search service is healthy"""
        try:
            return self.client is not None and self.collection is not None
        except Exception as e:
            logger.error(f"Health check failed: {e}")
            return False
    
    async def cleanup(self):
        """Cleanup resources"""
        try:
            if self.client:
                self.client.reset()
            logger.info("Search service cleaned up")
        except Exception as e:
            logger.error(f"Error during cleanup: {e}")
    
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