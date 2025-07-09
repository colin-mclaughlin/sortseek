from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime
import os
from pathlib import Path

# Database configuration
DATABASE_URL = "sqlite:///./sortseek.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Database session dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

async def init_db():
    """Initialize the database and create tables"""
    # Create tables
    Base.metadata.create_all(bind=engine)
    
    # Run migration to add new columns if needed
    try:
        from migrate_db import migrate_database
        migrate_database()
    except Exception as e:
        print(f"Migration warning: {e}")
    
    # Create data directory if it doesn't exist
    data_dir = Path("./data")
    data_dir.mkdir(exist_ok=True)
    
    # Create embeddings directory
    embeddings_dir = data_dir / "embeddings"
    embeddings_dir.mkdir(exist_ok=True)
    
    # Create documents directory
    documents_dir = data_dir / "documents"
    documents_dir.mkdir(exist_ok=True)
    
    print("Database initialized successfully") 