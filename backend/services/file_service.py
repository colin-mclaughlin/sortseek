import os
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from fastapi import UploadFile
import pdfplumber
from docx import Document as DocxDocument
import logging

from database import get_db
from models import Document
from services.search_service import SearchService

logger = logging.getLogger(__name__)

DOCUMENTS_DIR = Path("data/documents")

class FileService:
    """Service for handling file operations and document parsing"""
    
    SUPPORTED_EXTENSIONS = {'.pdf', '.docx', '.txt'}
    
    def __init__(self, search_service: SearchService = None):
        self.data_dir = DOCUMENTS_DIR
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.search_service = search_service
        if self.search_service is None:
            logger.warning("FileService initialized without SearchService - indexing will be disabled")
    
    async def import_folder(self, folder_path: str) -> List[Dict[str, Any]]:
        """Import all supported documents from a folder recursively"""
        folder = Path(folder_path)
        if not folder.exists():
            raise ValueError(f"Folder {folder_path} does not exist")
        
        imported_files = []
        
        # Walk through all files in the folder
        for file_path in folder.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS:
                try:
                    doc_dict = await self._import_single_file(file_path)
                    if doc_dict and not doc_dict.get("is_indexed", False):
                        # Fetch the document from DB to pass to indexer
                        db = next(get_db())
                        document = db.query(Document).filter(Document.id == doc_dict["id"]).first()
                        if document and self.search_service:
                            try:
                                await self.search_service.index_document(document)
                                logger.info(f"Import and indexing completed for document {document.id}: {document.filename}")
                            except Exception as e:
                                logger.warning(f"Failed to index document {document.id} ({document.filename}): {e}")
                        elif document and not self.search_service:
                            logger.warning(f"Document {document.id} ({document.filename}) imported but not indexed - SearchService not available")
                        imported_files.append(doc_dict)
                except Exception as e:
                    logger.error(f"Failed to import {file_path}: {e}")
                    continue
        
        return imported_files
    
    async def import_file(self, file: UploadFile) -> Dict[str, Any]:
        """Import a single uploaded file"""
        temp_path = DOCUMENTS_DIR / file.filename
        with open(temp_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        try:
            doc_dict = await self._import_single_file(temp_path)
            if doc_dict and not doc_dict.get("is_indexed", False):
                db = next(get_db())
                document = db.query(Document).filter(Document.id == doc_dict["id"]).first()
                if document and self.search_service:
                    try:
                        await self.search_service.index_document(document)
                        logger.info(f"Import and indexing completed for document {document.id}: {document.filename}")
                    except Exception as e:
                        logger.warning(f"Failed to index document {document.id} ({document.filename}): {e}")
                elif document and not self.search_service:
                    logger.warning(f"Document {document.id} ({document.filename}) imported but not indexed - SearchService not available")
            return doc_dict
        finally:
            if temp_path.exists():
                temp_path.unlink()
    
    async def _import_single_file(self, file_path: Path) -> Optional[Dict[str, Any]]:
        """Import a single file and extract its content"""
        try:
            # Check if file already exists in database
            db = next(get_db())
            existing_doc = db.query(Document).filter(Document.file_path == str(file_path)).first()
            if existing_doc:
                logger.info(f"File {file_path} already imported")
                return existing_doc.to_dict()
            
            # Extract content based on file type
            content = await self._extract_content(file_path)
            if not content:
                logger.warning(f"Could not extract content from {file_path}")
                return None
            
            # Create document record
            document = Document(
                filename=file_path.name,
                file_path=str(file_path),
                file_type=file_path.suffix.lower(),
                file_size=file_path.stat().st_size,
                content=content,
                is_indexed=False
            )
            
            db.add(document)
            db.commit()
            db.refresh(document)
            
            logger.info(f"Successfully imported {file_path}")
            return document.to_dict()
            
        except Exception as e:
            logger.error(f"Error importing {file_path}: {e}")
            return None
    
    async def _extract_content(self, file_path: Path) -> Optional[str]:
        """Extract text content from different file types"""
        try:
            extension = file_path.suffix.lower()
            
            if extension == '.pdf':
                return await self._extract_pdf_content(file_path)
            elif extension == '.docx':
                return await self._extract_docx_content(file_path)
            elif extension == '.txt':
                return await self._extract_txt_content(file_path)
            else:
                logger.warning(f"Unsupported file type: {extension}")
                return None
                
        except Exception as e:
            logger.error(f"Error extracting content from {file_path}: {e}")
            return None
    
    async def _extract_pdf_content(self, file_path: Path) -> str:
        """Extract text content from PDF file"""
        try:
            with pdfplumber.open(file_path) as pdf:
                text_parts = []
                for page in pdf.pages:
                    text = page.extract_text()
                    if text:
                        text_parts.append(text)
                return '\n'.join(text_parts)
        except Exception as e:
            logger.error(f"Error extracting PDF content: {e}")
            return ""
    
    async def _extract_docx_content(self, file_path: Path) -> str:
        """Extract text content from DOCX file"""
        try:
            doc = DocxDocument(file_path)
            text_parts = []
            for paragraph in doc.paragraphs:
                if paragraph.text.strip():
                    text_parts.append(paragraph.text)
            return '\n'.join(text_parts)
        except Exception as e:
            logger.error(f"Error extracting DOCX content: {e}")
            return ""
    
    async def _extract_txt_content(self, file_path: Path) -> str:
        """Extract text content from TXT file"""
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                return f.read()
        except UnicodeDecodeError:
            # Try with different encoding
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Error reading TXT file with latin-1 encoding: {e}")
                return ""
        except Exception as e:
            logger.error(f"Error extracting TXT content: {e}")
            return ""
    
    def get_document_by_id(self, document_id: int) -> Optional[Document]:
        """Get a document by its ID"""
        try:
            db = next(get_db())
            return db.query(Document).filter(Document.id == document_id).first()
        except Exception as e:
            logger.error(f"Error getting document {document_id}: {e}")
            return None
    
    def get_all_documents(self, skip: int = 0, limit: int = 100) -> List[Document]:
        """Get all documents with pagination"""
        try:
            db = next(get_db())
            return db.query(Document).offset(skip).limit(limit).all()
        except Exception as e:
            logger.error(f"Error getting documents: {e}")
            return [] 