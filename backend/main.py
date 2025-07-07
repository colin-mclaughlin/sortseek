import os
import asyncio
from pathlib import Path
from typing import List, Optional
import logging
from fastapi import FastAPI, HTTPException, UploadFile, File
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
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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
    return {"status": "ok"}

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
        
        for file_path in request.filePaths:
            try:
                logger.info(f"Processing file: {file_path}")
                
                # Check if file exists
                if not os.path.exists(file_path):
                    logger.warning(f"File does not exist: {file_path}")
                    continue
                
                # Get file info
                file_size = os.path.getsize(file_path)
                filename = os.path.basename(file_path)
                file_type = os.path.splitext(filename)[1].lower().lstrip('.')
                
                # Check if document already exists
                existing_doc = db.query(Document).filter(Document.file_path == file_path).first()
                if existing_doc:
                    logger.info(f"Document already exists: {file_path}")
                    imported_files.append(file_path)
                    continue
                
                # Create new document record
                new_document = Document(
                    filename=filename,
                    file_path=file_path,
                    file_type=file_type,
                    file_size=file_size,
                    content="",  # TODO: Extract content from file
                    summary=None,  # TODO: Generate summary
                    is_indexed=False
                )
                
                db.add(new_document)
                logger.info(f"Added document to database: {filename}")
                imported_files.append(file_path)
                
            except Exception as e:
                logger.error(f"Error processing file {file_path}: {e}")
                continue
        
        # Commit all changes
        db.commit()
        logger.info(f"Successfully imported {len(imported_files)} files")
        
        return ImportFolderResponse(
            success=True,
            message=f"Successfully imported {len(imported_files)} files",
            importedFiles=imported_files,
            count=len(imported_files)
        )
    except Exception as e:
        logger.error(f"Import failed: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import/folder")
async def import_folder_legacy(folder_path: str):
    """Import all supported documents from a folder recursively"""
    try:
        if file_service is None:
            raise HTTPException(status_code=503, detail="FileService not initialized")
            
        if not os.path.exists(folder_path):
            raise HTTPException(status_code=400, detail="Folder path does not exist")
        
        logger.info(f"Starting folder import: {folder_path}")
        imported_files = await file_service.import_folder(folder_path)
        
        return {
            "message": f"Successfully imported {len(imported_files)} documents",
            "imported_files": imported_files
        }
    except Exception as e:
        logger.error(f"Folder import failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/import/file")
async def import_file(file: UploadFile = File(...)):
    """Import a single file"""
    try:
        if file_service is None:
            raise HTTPException(status_code=503, detail="FileService not initialized")
            
        logger.info(f"Importing file: {file.filename}")
        result = await file_service.import_file(file)
        
        return {
            "message": "File imported successfully",
            "file": result
        }
    except Exception as e:
        logger.error(f"File import failed: {e}")
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
    """Summarize a PDF document by pages using AI"""
    try:
        logger.info(f"Received summarization request for: {request.filePath}")
        
        if not ai_service.is_available():
            raise HTTPException(status_code=503, detail="AI service not available")
        
        if not os.path.exists(request.filePath):
            raise HTTPException(status_code=404, detail="File not found")
        
        # Import fitz here to avoid issues if PyMuPDF is not installed
        try:
            import fitz
        except ImportError:
            raise HTTPException(status_code=500, detail="PyMuPDF not available")
        
        # Open the PDF document
        doc = fitz.open(request.filePath)
        total_pages = len(doc)
        logger.info(f"PDF has {total_pages} pages")
        
        # Limit to maxPages for performance
        pages_to_summarize = min(request.maxPages, total_pages)
        summaries = []
        
        for page_num in range(pages_to_summarize):
            try:
                logger.info(f"Processing page {page_num + 1}")
                
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
                logger.error(f"Error processing page {page_num + 1}: {e}")
                summaries.append(PageSummary(
                    page=page_num + 1,
                    summary=f"Error processing this page: {str(e)}"
                ))
        
        doc.close()
        
        logger.info(f"Successfully summarized {len(summaries)} pages")
        
        return SummarizeResponse(
            success=True,
            message=f"Successfully summarized {len(summaries)} pages",
            summaries=summaries,
            totalPages=total_pages
        )
        
    except Exception as e:
        logger.error(f"Document summarization failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    ) 