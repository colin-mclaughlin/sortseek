import os
import asyncio
from pathlib import Path
from typing import List, Optional
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi import Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import uvicorn

from database import init_db, get_db
from models import Document, SearchResult
from services.file_service import FileService
from services.search_service import SearchService
from services.ai_service import AIService

# Pydantic models for request/response
class ImportFolderRequest(BaseModel):
    filePaths: List[str]

class ImportFolderResponse(BaseModel):
    success: bool
    message: str
    importedFiles: List[str]
    count: int

class SummarizeRequest(BaseModel):
    filePath: str
    maxPages: int = 5

class PageSummary(BaseModel):
    page: int
    summary: str

class SummarizeResponse(BaseModel):
    success: bool
    message: str
    summaries: List[PageSummary]
    totalPages: int

class SemanticSearchRequest(BaseModel):
    query: str
    top_k: int = 5
    filters: Optional[dict] = None

class SemanticSearchResult(BaseModel):
    filename: str
    file_path: str
    page: int = None
    content: str
    score: float

class SemanticSearchResponse(BaseModel):
    results: list
    count: int

class SummarizeClauseRequest(BaseModel):
    text: str
class SummarizeClauseResponse(BaseModel):
    summary: str

class SmartRenameRequest(BaseModel):
    file_path: str

class SmartRenameResponse(BaseModel):
    suggested_name: str

class ApplyRenameRequest(BaseModel):
    file_path: str
    new_name: str

class ApplyRenameResponse(BaseModel):
    success: bool
    old_path: str
    new_path: str
    new_name: str

class SmartMoveRequest(BaseModel):
    file_path: str

class SmartMoveResponse(BaseModel):
    suggested_folder: str

class ApplyMoveRequest(BaseModel):
    file_path: str
    new_folder: str

class ApplyMoveResponse(BaseModel):
    success: bool
    old_path: str
    new_path: str
    new_folder: str

# New Pydantic models for file tree operations
class FileTreeNode(BaseModel):
    name: str
    path: str
    children: List['FileTreeNode'] = []
    is_file: bool = False
    size: Optional[int] = None
    modified: Optional[str] = None
    type: Optional[str] = None

class FileTreeResponse(BaseModel):
    success: bool
    message: str
    tree: Optional[FileTreeNode] = None

class FileListItem(BaseModel):
    name: str
    path: str
    type: str
    size: int
    modified: str
    is_file: bool = True
    restricted: Optional[bool] = False  # New field to indicate restricted folders

class FilesInFolderResponse(BaseModel):
    success: bool
    message: str
    files: List[FileListItem] = []

# Update FileTreeNode to handle forward references
FileTreeNode.model_rebuild()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="SortSeek Backend",
    description="Local-first file assistant backend API",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for Electron
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
file_service = None  # Will be initialized after SearchService is ready
search_service = SearchService()
ai_service = AIService()

@app.on_event("startup")
async def startup_event():
    """Initialize database and services on startup"""
    logger.info("Starting SortSeek backend...")
    await init_db()
    await search_service.initialize()
    
    # Log ChromaDB collection status
    collection_ready = search_service._collection is not None
    logger.info(f"Search service initialized, ChromaDB collection ready: {collection_ready}")
    
    # Check if ChromaDB collection is empty and reindex if needed
    if collection_ready:
        is_empty = await search_service.is_collection_empty()
        if is_empty:
            logger.warning("ChromaDB collection is empty - triggering full reindex of all documents")
            reindex_result = await search_service.reindex_all_documents()
            if reindex_result["success"]:
                logger.info(f"Full reindex completed: {reindex_result['message']}")
                logger.info(f"  - Documents processed: {reindex_result['documents_processed']}")
                logger.info(f"  - Documents indexed: {reindex_result['documents_indexed']}")
                logger.info(f"  - Estimated chunks created: {reindex_result['chunks_created']}")
            else:
                logger.error(f"Full reindex failed: {reindex_result['message']}")
        else:
            logger.info("ChromaDB collection is already populated - skipping reindex")
    
    # Initialize FileService only after SearchService is ready
    global file_service
    if collection_ready:
        file_service = FileService(search_service=search_service)
        logger.info("FileService initialized with SearchService")
    else:
        logger.warning("SearchService not ready, initializing FileService without indexing capabilities")
        file_service = FileService(search_service=None)
    
    logger.info("SortSeek backend started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down SortSeek backend...")
    await search_service.cleanup()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "SortSeek Backend is running", "status": "healthy"}

@app.get("/ping")
async def ping():
    """Simple ping endpoint for connection testing"""
    return JSONResponse(content={"status": "ok"})

@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        # Check database connection
        db = get_db()
        # Check search service
        search_healthy = await search_service.is_healthy()
        
        return {
            "status": "healthy",
            "database": "connected",
            "search_service": "healthy" if search_healthy else "unhealthy",
            "ai_service": "available" if ai_service.is_available() else "unavailable"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=500, detail="Service unhealthy")

@app.post("/import")
async def import_folder(request: ImportFolderRequest, db: Session = Depends(get_db)):
    """Import files from a list of file paths"""
    try:
        logger.info(f"Received import request with {len(request.filePaths)} files")
        
        imported_files = []
        indexed_count = 0
        skipped_count = 0
        
        for file_path in request.filePaths:
            try:
                logger.info(f"Processing file: {file_path}")
                
                # Check if file exists
                if not os.path.exists(file_path):
                    logger.warning(f"File does not exist: {file_path}")
                    continue
                
                # Use file service to import the file (this handles content extraction and indexing)
                if file_service is None:
                    raise HTTPException(status_code=503, detail="FileService not initialized")
                
                # Import the file using file service
                doc_dict = await file_service._import_single_file(Path(file_path))
                
                if doc_dict:
                    imported_files.append(file_path)
                    
                    # Check if file was actually indexed or skipped
                    db = next(get_db())
                    doc = db.query(Document).filter(Document.id == doc_dict['id']).first()
                    if doc and doc.is_indexed:
                        indexed_count += 1
                        logger.info(f"Successfully indexed: {file_path}")
                    else:
                        skipped_count += 1
                        logger.info(f"Skipped (unchanged): {file_path}")
                else:
                    logger.warning(f"Failed to import file: {file_path}")
                
            except Exception as e:
                logger.error(f"Error processing file {file_path}: {e}")
                continue
        
        logger.info(f"Import completed: {len(imported_files)} files processed, {indexed_count} indexed, {skipped_count} skipped")
        
        return ImportFolderResponse(
            success=True,
            message=f"Successfully processed {len(imported_files)} files ({indexed_count} indexed, {skipped_count} skipped)",
            importedFiles=imported_files,
            count=len(imported_files)
        )
    except Exception as e:
        logger.error(f"Import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import/folder")
async def import_folder_legacy(folder_path: str, force: bool = False):
    """Import all supported documents from a folder recursively"""
    try:
        if file_service is None:
            raise HTTPException(status_code=503, detail="FileService not initialized")
            
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail="Folder path does not exist")
        
        logger.info(f"Starting folder import: {folder_path} (force={force})")
        result = await file_service.import_folder(folder_path, force=force)
        
        return {
            "message": f"Successfully processed {result['total_count']} documents ({result['indexed_count']} indexed, {result['skipped_count']} skipped)",
            "imported_files": result['imported_files'],
            "indexed_count": result['indexed_count'],
            "skipped_count": result['skipped_count'],
            "total_count": result['total_count']
        }
    except Exception as e:
        logger.error(f"Folder import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import/file")
async def import_file(file: UploadFile = File(...), force: bool = False):
    """Import a single file"""
    try:
        if file_service is None:
            raise HTTPException(status_code=503, detail="FileService not initialized")
            
        logger.info(f"Importing file: {file.filename} (force={force})")
        result = await file_service.import_file(file)
        
        return {
            "message": "File imported successfully",
            "file": result,
            "force": force
        }
    except Exception as e:
        logger.error(f"File import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import/file/force")
async def import_file_force(file_path: str):
    """Force reindex a single file by path"""
    try:
        if file_service is None:
            raise HTTPException(status_code=503, detail="FileService not initialized")
            
        if not os.path.exists(file_path):
            raise HTTPException(status_code=400, detail="File does not exist")
            
        logger.info(f"Force importing file: {file_path}")
        result = await file_service._import_single_file(Path(file_path), force=True)
        
        if result:
            return {
                "message": "File force imported successfully",
                "file": result
            }
        else:
            raise HTTPException(status_code=400, detail="Failed to import file")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Force file import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents")
async def get_documents(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    db: Session = Depends(get_db)  # ✅ Inject db session properly
):
    """Get all documents with optional search"""
    try:
        if search:
            results = await search_service.search_documents(search, skip, limit)
            return {"documents": results}
        else:
            documents = db.query(Document).offset(skip).limit(limit).all()
            return {"documents": [doc.to_dict() for doc in documents]}
    except Exception as e:
        logger.error(f"Failed to get documents: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/documents/{document_id}")
async def get_document(document_id: int):
    """Get a specific document by ID"""
    try:
        db = get_db()
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        return document.to_dict()
    except Exception as e:
        logger.error(f"Failed to get document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/documents/{document_id}/refresh")
async def refresh_document(document_id: int):
    """Refresh document content by re-reading from disk"""
    try:
        logger.info(f"Refreshing document {document_id}")
        
        db = next(get_db())
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Check if file still exists on disk
        if not os.path.exists(document.file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")
        
        # Re-extract content using file service
        from services.file_service import FileService
        file_service = FileService()
        
        new_content = await file_service._extract_content(Path(document.file_path))
        
        if not new_content or not new_content.strip():
            raise HTTPException(status_code=400, detail="No content found in file")
        
        # Update file size
        file_size = os.path.getsize(document.file_path)
        
        # Update document in database
        document.content = new_content
        document.file_size = file_size
        document.summary = None  # Clear existing summary since content changed
        document.is_indexed = False  # Mark for reindexing
        document.embedding_path = None
        
        db.commit()
        
        # Reindex the document
        if search_service:
            await search_service.index_document(document)
        
        logger.info(f"Successfully refreshed document {document_id}: {document.filename}")
        
        return {
            "success": True,
            "message": f"Document refreshed successfully",
            "document": document.to_dict()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to refresh document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/documents/{document_id}")
async def delete_document(document_id: int, delete_file: bool = False):
    """Delete a document from the database and optionally from disk"""
    try:
        logger.info(f"Deleting document {document_id} (delete_file={delete_file})")
        
        db = next(get_db())
        document = db.query(Document).filter(Document.id == document_id).first()
        
        if not document:
            raise HTTPException(status_code=404, detail="Document not found")
        
        # Store file path before deletion
        file_path = document.file_path
        filename = document.filename
        
        # Remove from search index if indexed
        if document.embedding_path and search_service:
            try:
                search_service.collection.delete(ids=[document.embedding_path])
                logger.info(f"Removed document {document_id} from search index")
            except Exception as e:
                logger.warning(f"Failed to remove document {document_id} from search index: {e}")
        
        # Delete from database
        db.delete(document)
        db.commit()
        
        # Optionally delete file from disk
        if delete_file and os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file from disk: {file_path}")
            except Exception as e:
                logger.error(f"Failed to delete file from disk {file_path}: {e}")
                # Don't fail the whole operation if file deletion fails
        
        logger.info(f"Successfully deleted document {document_id}: {filename}")
        
        return {
            "success": True,
            "message": f"Document deleted successfully",
            "deleted_file": delete_file and os.path.exists(file_path) == False
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete document {document_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search")
async def search_documents(
    query: str,
    limit: int = 20
):
    """Search documents using semantic search"""
    try:
        logger.info(f"Searching for: {query}")
        results = await search_service.search_documents(query, limit=limit)
        
        return {
            "query": query,
            "results": results,
            "total": len(results)
        }
    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/semantic-search")
async def semantic_search(request: SemanticSearchRequest):
    """Semantic search over imported documents using ChromaDB and OpenAI embeddings"""
    try:
        logger.info(f"Received semantic search query: {request.query}")
        if request.filters:
            logger.info(f"Applied filters: {request.filters}")
        results = await search_service.semantic_search(request.query, top_k=request.top_k, filters=request.filters)
        logger.info(f"Semantic search returned {len(results)} results")
        return {"results": results, "count": len(results)}
    except Exception as e:
        logger.error(f"Semantic search failed: {e}")
        return {"results": [], "count": 0, "error": str(e)}

@app.post("/summarize")
async def summarize_text(text: str, max_length: int = 200):
    """Summarize text using AI"""
    try:
        summary = await ai_service.summarize_text(text, max_length)
        return {"summary": summary}
    except Exception as e:
        logger.error(f"Summarization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/suggest-filename")
async def suggest_filename(content: str, current_name: Optional[str] = None):
    """Suggest a filename based on document content"""
    try:
        suggestion = await ai_service.suggest_filename(content, current_name)
        return {"suggested_name": suggestion}
    except Exception as e:
        logger.error(f"Filename suggestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/suggest-folder")
async def suggest_folder(content: str, current_path: Optional[str] = None):
    """Suggest a folder location based on document content"""
    try:
        suggestion = await ai_service.suggest_folder(content, current_path)
        return {"suggested_folder": suggestion}
    except Exception as e:
        logger.error(f"Folder suggestion failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize-document")
async def summarize_document(request: SummarizeRequest):
    """Summarize a document by pages using AI (supports PDF, DOCX, TXT)"""
    try:
        logger.info(f"Received summarization request for: {request.filePath}")
        
        if not ai_service.is_available():
            raise HTTPException(status_code=503, detail="AI service not available")
        
        if not os.path.exists(request.filePath):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Determine file type from extension
        file_extension = os.path.splitext(request.filePath)[1].lower()
        logger.info(f"File type detected: {file_extension}")
        
        summaries = []
        total_pages = 0
        
        if file_extension == '.pdf':
            # Handle PDF files using PyMuPDF
            try:
                import fitz
            except ImportError:
                raise HTTPException(status_code=500, detail="PyMuPDF not available for PDF processing")
            
            # Open the PDF document
            doc = fitz.open(request.filePath)
            total_pages = len(doc)
            logger.info(f"PDF has {total_pages} pages")
            
            # Limit to maxPages for performance
            pages_to_summarize = min(request.maxPages, total_pages)
            
            for page_num in range(pages_to_summarize):
                try:
                    logger.info(f"Processing PDF page {page_num + 1}")
                    
                    # Get the page
                    page = doc.load_page(page_num)
                    
                    # Extract text from the page
                    text = page.get_text()
                    
                    if not text.strip():
                        logger.warning(f"Page {page_num + 1} has no text content")
                        summaries.append(PageSummary(
                            page=page_num + 1,
                            summary="No text content found on this page."
                        ))
                        continue
                    
                    # Truncate text if too long for API
                    if len(text) > 3000:
                        text = text[:3000] + "..."
                    
                    logger.info(f"Page {page_num + 1} text length: {len(text)} characters")
                    
                    # Generate summary using AI
                    summary = await ai_service.summarize_text(text, max_length=300)
                    
                    summaries.append(PageSummary(
                        page=page_num + 1,
                        summary=summary
                    ))
                    
                    logger.info(f"Generated summary for page {page_num + 1}")
                    
                except Exception as e:
                    logger.error(f"Error processing PDF page {page_num + 1}: {e}")
                    summaries.append(PageSummary(
                        page=page_num + 1,
                        summary=f"Error processing this page: {str(e)}"
                    ))
            
            doc.close()
            
        elif file_extension in ['.docx', '.txt']:
            # Handle DOCX and TXT files
            try:
                from services.file_service import FileService
                file_service = FileService()
                
                # Extract content using the same method as during import
                content = await file_service._extract_content(Path(request.filePath))
                
                if not content or not content.strip():
                    raise HTTPException(status_code=400, detail="No content found in document")
                
                logger.info(f"Extracted content length: {len(content)} characters")
                
                # For text files, treat the entire content as one "page"
                total_pages = 1
                
                # Split content into chunks if it's too long
                max_chunk_size = 3000
                content_chunks = []
                
                if len(content) > max_chunk_size:
                    # Split by paragraphs or sentences
                    paragraphs = content.split('\n\n')
                    current_chunk = ""
                    
                    for paragraph in paragraphs:
                        if len(current_chunk) + len(paragraph) > max_chunk_size:
                            if current_chunk:
                                content_chunks.append(current_chunk.strip())
                                current_chunk = paragraph
                            else:
                                # Single paragraph is too long, truncate it
                                content_chunks.append(paragraph[:max_chunk_size] + "...")
                        else:
                            current_chunk += "\n\n" + paragraph if current_chunk else paragraph
                    
                    if current_chunk.strip():
                        content_chunks.append(current_chunk.strip())
                else:
                    content_chunks = [content]
                
                logger.info(f"Split content into {len(content_chunks)} chunks")
                
                # Generate summaries for each chunk
                for i, chunk in enumerate(content_chunks):
                    try:
                        logger.info(f"Processing {file_extension} chunk {i + 1}")
                        
                        # Truncate if still too long
                        if len(chunk) > max_chunk_size:
                            chunk = chunk[:max_chunk_size] + "..."
                        
                        # Generate summary using AI
                        summary = await ai_service.summarize_text(chunk, max_length=300)
                        
                        summaries.append(PageSummary(
                            page=i + 1,
                            summary=summary
                        ))
                        
                        logger.info(f"Generated summary for chunk {i + 1}")
                        
                    except Exception as e:
                        logger.error(f"Error processing {file_extension} chunk {i + 1}: {e}")
                        summaries.append(PageSummary(
                            page=i + 1,
                            summary=f"Error processing this section: {str(e)}"
                        ))
                
            except Exception as e:
                logger.error(f"Error extracting content from {file_extension} file: {e}")
                raise HTTPException(status_code=500, detail=f"Failed to process {file_extension} file: {str(e)}")
        
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_extension}")
        
        logger.info(f"Successfully summarized {len(summaries)} sections")
        
        # Check for meaningless fallback responses before saving
        meaningless_summaries = []
        meaningful_summaries = []
        
        # TODO: This fallback phrase detection could be improved with a more robust strategy
        # in the future, such as checking for multiple fallback patterns or using semantic
        # similarity to detect when summaries are not meaningful.
        
        for summary in summaries:
            # Check for fallback phrases and error messages (case-insensitive)
            summary_lower = summary.summary.lower().strip()
            if (summary_lower == "no meaningful summary available." or 
                summary_lower == "no meaningful summary generated for this page." or
                summary_lower.startswith("error processing") or
                summary_lower == "no text content found on this page."):
                meaningless_summaries.append(summary)
                logger.warning(f"Detected meaningless fallback summary for section {summary.page}: '{summary.summary}'")
            else:
                meaningful_summaries.append(summary)
        
        # If all summaries are meaningless, skip saving entirely
        if len(meaningful_summaries) == 0 and len(meaningless_summaries) > 0:
            logger.warning(f"All {len(meaningless_summaries)} summaries for document are meaningless fallback responses. Skipping save to preserve existing content.")
            return SummarizeResponse(
                success=True,
                message=f"Generated {len(summaries)} summaries, but all were meaningless fallback responses. No changes saved to preserve existing content.",
                summaries=summaries,
                totalPages=total_pages
            )
        
        # If some summaries are meaningless, log but proceed with meaningful ones
        if len(meaningless_summaries) > 0:
            logger.warning(f"Skipping {len(meaningless_summaries)} meaningless summaries, saving {len(meaningful_summaries)} meaningful summaries")
            summaries_to_save = meaningful_summaries
        else:
            summaries_to_save = summaries
        
        # Save meaningful summaries to document and trigger reindexing
        try:
            # Find the document in the database
            db = next(get_db())
            document = db.query(Document).filter(Document.file_path == request.filePath).first()
            
            if document:
                # Combine meaningful summaries into one content field
                combined_summary = "\n\n".join([f"Section {s.page}: {s.summary}" for s in summaries_to_save])
                
                print(f"📥 Calling index_document() for: {request.filePath}")
                
                # Update document summary field with summaries and reindex
                success = await search_service.update_document_content(
                    document.id, 
                    combined_summary, 
                    "summary"  # Update the summary field, not content
                )
                
                if success:
                    logger.info(f"Successfully updated summary and reindexed document {document.id} with {len(summaries_to_save)} meaningful summaries")
                else:
                    logger.warning(f"Failed to update summary and reindex document {document.id}")
            else:
                logger.warning(f"Document not found in database for path: {request.filePath}")
                
        except Exception as e:
            logger.error(f"Failed to save summaries to document: {e}")
        
        return SummarizeResponse(
            success=True,
            message=f"Successfully summarized {len(summaries)} sections",
            summaries=summaries,
            totalPages=total_pages
        )
        
    except Exception as e:
        logger.error(f"Document summarization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/update-document-content")
async def update_document_content(
    document_id: int,
    content: str,
    content_type: str = "content"
):
    """Update document content and reindex it"""
    try:
        if not content or not content.strip():
            raise HTTPException(status_code=400, detail="Content cannot be empty")
        
        success = await search_service.update_document_content(document_id, content.strip(), content_type)
        
        if success:
            return {
                "message": f"Document {document_id} content updated and reindexed successfully",
                "document_id": document_id,
                "content_type": content_type
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update document content")
            
    except Exception as e:
        logger.error(f"Failed to update document content: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/reset-embeddings")
async def reset_embeddings():
    """Reset all embeddings (useful for handling dimension mismatches)"""
    try:
        await search_service.reset_embeddings()
        
        # Reinitialize the search service
        await search_service.initialize()
        
        return {
            "message": "Embeddings reset and reinitialized successfully",
            "note": "All documents will need to be reindexed"
        }
        
    except Exception as e:
        logger.error(f"Failed to reset embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/summarize-clause", response_model=SummarizeClauseResponse)
async def summarize_clause(request: SummarizeClauseRequest):
    try:
        summary = await ai_service.summarize_text(request.text)
        return SummarizeClauseResponse(summary=summary)
    except Exception as e:
        logger.error(f"Summarize clause failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to summarize clause")

@app.post("/smart-rename", response_model=SmartRenameResponse)
async def smart_rename(request: SmartRenameRequest, db: Session = Depends(get_db)):
    """Suggest a smart filename for a document based on its summary/content and metadata."""
    # Find the document by file_path
    document = db.query(Document).filter(Document.file_path == request.file_path).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    # Use summary if available, else content
    content = document.summary if document.summary and document.summary.strip() else document.content
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="No content or summary available for this document")
    # Get current filename and extension
    current_name = Path(document.filename).stem
    extension = Path(document.filename).suffix
    # Use AI to suggest a new filename (without extension)
    suggested_base = await ai_service.suggest_filename(content, current_name=current_name)
    # Clean and validate suggestion, preserve extension
    if not suggested_base:
        raise HTTPException(status_code=500, detail="Failed to generate filename suggestion")
    # Remove invalid characters and trim
    valid_base = ''.join(c for c in suggested_base if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
    if not valid_base:
        valid_base = current_name
    # Ensure extension is preserved
    suggested_name = f"{valid_base}{extension}"
    return SmartRenameResponse(suggested_name=suggested_name)

@app.post("/apply-rename", response_model=ApplyRenameResponse)
async def apply_rename(request: ApplyRenameRequest, db: Session = Depends(get_db)):
    """Rename a file on disk, update the database, and reindex the document."""
    # Find the document by file_path
    document = db.query(Document).filter(Document.file_path == request.file_path).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    # Validate new_name
    if not request.new_name or request.new_name.strip() == "":
        raise HTTPException(status_code=400, detail="New name cannot be empty")
    # Ensure extension is preserved
    old_ext = Path(document.filename).suffix
    new_ext = Path(request.new_name).suffix or old_ext
    base_name = Path(request.new_name).stem
    # Remove invalid characters
    valid_base = ''.join(c for c in base_name if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
    if not valid_base:
        valid_base = Path(document.filename).stem
    new_filename = f"{valid_base}{new_ext}"
    # Prevent renaming to the same name
    if new_filename == document.filename:
        raise HTTPException(status_code=400, detail="New name must be different from current name")
    # Compute new file path
    old_path = Path(document.file_path)
    new_path = old_path.with_name(new_filename)
    # Prevent overwrite
    if new_path.exists():
        raise HTTPException(status_code=400, detail="A file with the new name already exists")
    # Rename file on disk
    try:
        os.rename(old_path, new_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to rename file: {e}")
    # Update database
    document.filename = new_filename
    document.file_path = str(new_path)
    db.commit()
    # Reindex in ChromaDB to update metadata
    try:
        await search_service.index_document(document)
    except Exception as e:
        logger.warning(f"Reindex after rename failed: {e}")
    return ApplyRenameResponse(success=True, old_path=str(old_path), new_path=str(new_path), new_name=new_filename)

@app.post("/smart-move", response_model=SmartMoveResponse)
async def smart_move(request: SmartMoveRequest, db: Session = Depends(get_db)):
    """Suggest a smart folder for a document based on its summary/content and metadata."""
    # Find the document by file_path
    document = db.query(Document).filter(Document.file_path == request.file_path).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    # Use summary if available, else content
    content = document.summary if document.summary and document.summary.strip() else document.content
    if not content or not content.strip():
        raise HTTPException(status_code=400, detail="No content or summary available for this document")
    # Get current folder path
    current_path = Path(document.file_path).parent
    # Use AI to suggest a new folder
    suggested_folder = await ai_service.suggest_folder(content, str(current_path))
    # Clean and validate suggestion
    if not suggested_folder:
        raise HTTPException(status_code=500, detail="Failed to generate folder suggestion")
    # Remove invalid characters and trim
    valid_folder = ''.join(c for c in suggested_folder if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
    if not valid_folder:
        valid_folder = "Documents"
    return SmartMoveResponse(suggested_folder=valid_folder)

@app.post("/apply-move", response_model=ApplyMoveResponse)
async def apply_move(request: ApplyMoveRequest, db: Session = Depends(get_db)):
    """Move a file to a new folder on disk, update the database, and reindex the document."""
    import shutil
    
    # Find the document by file_path
    document = db.query(Document).filter(Document.file_path == request.file_path).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Validate new_folder
    if not request.new_folder or request.new_folder.strip() == "":
        raise HTTPException(status_code=400, detail="New folder cannot be empty")
    
    # Clean folder name
    valid_folder = ''.join(c for c in request.new_folder if c.isalnum() or c in (' ', '-', '_')).strip().replace(' ', '_')
    if not valid_folder:
        raise HTTPException(status_code=400, detail="Invalid folder name")
    
    # Compute paths
    old_path = Path(document.file_path)
    new_folder_path = old_path.parent / valid_folder
    new_path = new_folder_path / document.filename
    
    # Prevent moving to the same location
    if new_path == old_path:
        raise HTTPException(status_code=400, detail="New location must be different from current location")
    
    # Create folder if it doesn't exist
    try:
        new_folder_path.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create folder: {e}")
    
    # Prevent overwrite
    if new_path.exists():
        raise HTTPException(status_code=400, detail="A file with the same name already exists in the target folder")
    
    # Move file on disk
    try:
        shutil.move(str(old_path), str(new_path))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to move file: {e}")
    
    # Update database
    document.file_path = str(new_path)
    db.commit()
    
    # Reindex in ChromaDB to update metadata
    try:
        await search_service.index_document(document)
    except Exception as e:
        logger.warning(f"Reindex after move failed: {e}")
    
    return ApplyMoveResponse(
        success=True, 
        old_path=str(old_path), 
        new_path=str(new_path), 
        new_folder=valid_folder
    )

@app.get("/file-tree", response_model=FileTreeResponse)
async def get_file_tree(base_path: str):
    """Get a nested folder tree structure starting from the given base path"""
    try:
        import os
        from pathlib import Path
        from datetime import datetime
        
        # Validate and normalize the base path
        base_path = os.path.abspath(base_path)
        if not os.path.exists(base_path):
            raise HTTPException(status_code=404, detail="Base path does not exist")
        
        def build_tree(path: str, max_depth: int = 3, current_depth: int = 0) -> FileTreeNode:
            """Recursively build the file tree"""
            if current_depth >= max_depth:
                return None
                
            try:
                path_obj = Path(path)
                if not path_obj.exists():
                    return None
                
                # Get basic info
                name = path_obj.name if path_obj.name else path_obj.parts[-1]
                is_file = path_obj.is_file()
                
                node = FileTreeNode(
                    name=name,
                    path=str(path_obj.absolute()),
                    is_file=is_file,
                    children=[]
                )
                
                # If it's a file, add file metadata
                if is_file:
                    try:
                        stat = path_obj.stat()
                        node.size = stat.st_size
                        node.modified = datetime.fromtimestamp(stat.st_mtime).isoformat()
                        node.type = path_obj.suffix.lower() if path_obj.suffix else "unknown"
                    except (OSError, PermissionError):
                        pass
                else:
                    # If it's a directory, recursively add children
                    try:
                        children = []
                        for child_path in path_obj.iterdir():
                            # Skip hidden files and system files
                            if child_path.name.startswith('.') or child_path.name.startswith('$'):
                                continue
                            
                            child_node = build_tree(str(child_path), max_depth, current_depth + 1)
                            if child_node:
                                children.append(child_node)
                        
                        # Sort: directories first, then files, both alphabetically
                        children.sort(key=lambda x: (x.is_file, x.name.lower()))
                        node.children = children
                    except (OSError, PermissionError):
                        pass
                
                return node
                
            except (OSError, PermissionError) as e:
                logger.warning(f"Permission denied or error accessing {path}: {e}")
                return None
        
        # Build the tree
        tree = build_tree(base_path)
        
        if not tree:
            raise HTTPException(status_code=500, detail="Failed to build file tree")
        
        return FileTreeResponse(
            success=True,
            message="File tree retrieved successfully",
            tree=tree
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting file tree: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get file tree: {str(e)}")

@app.get("/files-in-folder", response_model=FilesInFolderResponse)
async def get_files_in_folder(path: str):
    """Get a list of files in the specified folder"""
    try:
        import os
        from pathlib import Path
        from datetime import datetime
        
        # Validate and normalize the path
        folder_path = os.path.abspath(path)
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=404, detail="Folder does not exist")
        
        if not os.path.isdir(folder_path):
            raise HTTPException(status_code=400, detail="Path is not a directory")
        
        files = []
        path_obj = Path(folder_path)
        
        try:
            for item in path_obj.iterdir():
                # Skip hidden files and system files
                if item.name.startswith('.') or item.name.startswith('$'):
                    continue
                restricted = False
                try:
                    stat = item.stat()
                except (OSError, PermissionError):
                    # Mark as restricted if we can't access
                    restricted = True
                    stat = None
                file_item = FileListItem(
                    name=item.name,
                    path=str(item.absolute()),
                    type=item.suffix.lower() if item.suffix else "folder" if item.is_dir() else "unknown",
                    size=stat.st_size if stat else 0,
                    modified=datetime.fromtimestamp(stat.st_mtime).isoformat() if stat else '',
                    is_file=item.is_file(),
                    restricted=restricted if item.is_dir() else False
                )
                files.append(file_item)
            # Sort: directories first, then files, both alphabetically
            files.sort(key=lambda x: (x.is_file, x.name.lower()))
            return FilesInFolderResponse(
                success=True,
                message=f"Found {len(files)} items in folder",
                files=files
            )
        except (OSError, PermissionError) as e:
            logger.warning(f"Permission denied accessing folder {folder_path}: {e}")
            return JSONResponse(status_code=403, content={
                "success": False,
                "message": "Access denied to this folder. This location is restricted by the operating system.",
                "files": []
            })
    except HTTPException as he:
        if he.status_code == 403:
            return JSONResponse(status_code=403, content={
                "success": False,
                "message": "Access denied to this folder. This location is restricted by the operating system.",
                "files": []
            })
        raise
    except Exception as e:
        logger.error(f"Error getting files in folder: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get files in folder: {str(e)}")

@app.get("/read-file-content")
async def read_file_content(path: str):
    """Read file content directly from filesystem for viewing"""
    try:
        import os
        from pathlib import Path
        
        # Validate and normalize the path
        file_path = os.path.abspath(path)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File does not exist")
        
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=400, detail="Path is not a file")
        
        path_obj = Path(file_path)
        file_extension = path_obj.suffix.lower()
        
        # Check if file type is supported
        supported_extensions = ['.txt', '.docx', '.pdf']
        if file_extension not in supported_extensions:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {file_extension}")
        
        try:
            if file_extension == '.txt':
                # Read text file directly
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {
                    "success": True,
                    "content": content,
                    "message": "File content read successfully"
                }
            
            elif file_extension == '.docx':
                # Use existing file service to extract text from DOCX
                if file_service:
                    try:
                        content = await file_service.extract_text_from_docx(file_path)
                        return {
                            "success": True,
                            "content": content,
                            "message": "DOCX content extracted successfully"
                        }
                    except Exception as e:
                        logger.error(f"Error extracting DOCX content: {e}")
                        raise HTTPException(status_code=500, detail=f"Failed to extract DOCX content: {str(e)}")
                else:
                    raise HTTPException(status_code=500, detail="File service not available")
            
            elif file_extension == '.pdf':
                # For PDFs, we'll return a message indicating they need special handling
                # The frontend will use the existing PDF viewer
                return {
                    "success": True,
                    "content": None,
                    "message": "PDF file - use PDF viewer"
                }
            
        except (OSError, PermissionError) as e:
            logger.warning(f"Permission denied reading file {file_path}: {e}")
            raise HTTPException(status_code=403, detail="Permission denied reading file")
        except UnicodeDecodeError as e:
            logger.error(f"Unicode decode error reading file {file_path}: {e}")
            raise HTTPException(status_code=400, detail="File encoding not supported")
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error reading file content: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to read file content: {str(e)}")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000) 