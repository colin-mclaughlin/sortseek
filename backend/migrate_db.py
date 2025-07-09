#!/usr/bin/env python3
"""
Database migration script to add new columns for efficient indexing.
This script adds the following columns to the documents table:
- imported_at: When file was first imported
- modified_time: File's last modified timestamp  
- file_hash: MD5 hash of file contents
- last_indexed_at: When file was last indexed
"""

import sqlite3
import os
from datetime import datetime
from pathlib import Path

def migrate_database():
    """Migrate the database to add new columns for efficient indexing"""
    
    db_path = "./sortseek.db"
    
    if not os.path.exists(db_path):
        print(f"Database file {db_path} not found. Creating new database...")
        return
    
    print(f"Migrating database: {db_path}")
    
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Check if columns already exist
        cursor.execute("PRAGMA table_info(documents)")
        columns = [column[1] for column in cursor.fetchall()]
        
        print(f"Existing columns: {columns}")
        
        # Add new columns if they don't exist
        new_columns = [
            ("imported_at", "TEXT"),
            ("modified_time", "REAL"),
            ("file_hash", "TEXT"),
            ("last_indexed_at", "TEXT")
        ]
        
        for column_name, column_type in new_columns:
            if column_name not in columns:
                print(f"Adding column: {column_name} ({column_type})")
                cursor.execute(f"ALTER TABLE documents ADD COLUMN {column_name} {column_type}")
                
                # For existing records, set default values
                if column_name == "imported_at":
                    # Set imported_at to created_at for existing records
                    cursor.execute(f"UPDATE documents SET {column_name} = created_at WHERE {column_name} IS NULL")
                elif column_name == "modified_time":
                    # Set modified_time to 0 for existing records (will be updated on next import)
                    cursor.execute(f"UPDATE documents SET {column_name} = 0 WHERE {column_name} IS NULL")
                elif column_name == "file_hash":
                    # Set file_hash to NULL for existing records (will be calculated on next import)
                    cursor.execute(f"UPDATE documents SET {column_name} = NULL WHERE {column_name} IS NULL")
                elif column_name == "last_indexed_at":
                    # Set last_indexed_at to NULL for existing records
                    cursor.execute(f"UPDATE documents SET {column_name} = NULL WHERE {column_name} IS NULL")
            else:
                print(f"Column {column_name} already exists, skipping...")
        
        # Commit changes
        conn.commit()
        
        # Verify the migration
        cursor.execute("PRAGMA table_info(documents)")
        final_columns = [column[1] for column in cursor.fetchall()]
        print(f"Final columns: {final_columns}")
        
        # Count documents
        cursor.execute("SELECT COUNT(*) FROM documents")
        doc_count = cursor.fetchone()[0]
        print(f"Total documents in database: {doc_count}")
        
        print("Database migration completed successfully!")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    migrate_database() 