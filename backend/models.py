from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any, Optional
from database import Base

class Document(Base):
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, index=True)
    file_path = Column(String, unique=True, index=True)
    file_type = Column(String)  # pdf, docx, txt
    file_size = Column(Integer)
    content = Column(Text)
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_indexed = Column(Boolean, default=False)
    embedding_path = Column(String, nullable=True)
    
    # New fields for efficient indexing
    imported_at = Column(DateTime, default=datetime.utcnow)  # When file was first imported
    modified_time = Column(Float, nullable=True)  # File's last modified timestamp
    file_hash = Column(String, nullable=True)  # MD5 hash of file contents
    last_indexed_at = Column(DateTime, nullable=True)  # When file was last indexed
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert document to dictionary"""
        return {
            "id": self.id,
            "filename": self.filename,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "content": self.content,
            "summary": self.summary,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_indexed": self.is_indexed,
            "embedding_path": self.embedding_path,
            "imported_at": self.imported_at.isoformat() if self.imported_at else None,
            "modified_time": self.modified_time,
            "file_hash": self.file_hash,
            "last_indexed_at": self.last_indexed_at.isoformat() if self.last_indexed_at else None
        }

class SearchResult:
    """Search result model"""
    def __init__(
        self,
        document_id: int,
        filename: str,
        file_path: str,
        content: str,
        score: float,
        matched_text: str
    ):
        self.document_id = document_id
        self.filename = filename
        self.file_path = file_path
        self.content = content
        self.score = score
        self.matched_text = matched_text
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert search result to dictionary"""
        return {
            "document_id": self.document_id,
            "filename": self.filename,
            "file_path": self.file_path,
            "content": self.content,
            "score": self.score,
            "matched_text": self.matched_text
        }

class SearchHistory(Base):
    __tablename__ = "search_history"
    
    id = Column(Integer, primary_key=True, index=True)
    query = Column(String, index=True)
    results_count = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert search history to dictionary"""
        return {
            "id": self.id,
            "query": self.query,
            "results_count": self.results_count,
            "created_at": self.created_at.isoformat() if self.created_at else None
        } 