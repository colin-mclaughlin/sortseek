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
import uvicorn

from database import init_db, get_db
from models import Document, SearchResult
from services.file_service import FileService
from services.search_service import SearchService
from services.ai_service import AIService

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

@app.post("/import/folder")
async def import_folder(folder_path: str):
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

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    ) 