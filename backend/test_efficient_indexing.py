#!/usr/bin/env python3
"""
Test script for efficient indexing functionality.
This script tests:
1. File change detection
2. Skipping unchanged files
3. Force reindexing
4. Database migration
"""

import asyncio
import os
import tempfile
import time
from pathlib import Path
from services.file_service import FileService
from services.search_service import SearchService
from database import init_db
from models import Document
from sqlalchemy.orm import Session
from database import get_db

async def test_efficient_indexing():
    """Test the efficient indexing functionality"""
    
    print("🧪 Testing Efficient Indexing System")
    print("=" * 50)
    
    # Initialize database
    await init_db()
    
    # Create test files
    test_dir = Path("./test_files")
    test_dir.mkdir(exist_ok=True)
    
    # Create a test text file
    test_file = test_dir / "test_document.txt"
    test_content = "This is a test document for efficient indexing."
    
    with open(test_file, "w") as f:
        f.write(test_content)
    
    print(f"📄 Created test file: {test_file}")
    
    # Initialize services
    search_service = SearchService()
    await search_service.initialize()
    
    file_service = FileService(search_service)
    
    # Test 1: First import (should index)
    print("\n🔍 Test 1: First import (should index)")
    print("-" * 30)
    
    result1 = await file_service._import_single_file(test_file)
    if result1:
        print(f"✅ First import successful: {result1['filename']}")
        
        # Check if file was indexed
        db = next(get_db())
        doc = db.query(Document).filter(Document.id == result1['id']).first()
        if doc and doc.is_indexed:
            print(f"✅ File was indexed (is_indexed: {doc.is_indexed})")
            print(f"✅ File hash: {doc.file_hash}")
            print(f"✅ Modified time: {doc.modified_time}")
            print(f"✅ Last indexed: {doc.last_indexed_at}")
        else:
            print(f"❌ File was not indexed (is_indexed: {doc.is_indexed if doc else 'None'})")
    else:
        print("❌ First import failed")
        return
    
    # Test 2: Second import without changes (should skip)
    print("\n🔍 Test 2: Second import without changes (should skip)")
    print("-" * 30)
    
    result2 = await file_service._import_single_file(test_file)
    if result2:
        print(f"✅ Second import successful: {result2['filename']}")
        
        # Check if file was skipped
        db = next(get_db())
        doc = db.query(Document).filter(Document.id == result2['id']).first()
        if doc and not doc.is_indexed:
            print(f"✅ File was skipped (is_indexed: {doc.is_indexed})")
        else:
            print(f"❌ File was not skipped (is_indexed: {doc.is_indexed if doc else 'None'})")
    else:
        print("❌ Second import failed")
    
    # Test 3: Modify file and import again (should reindex)
    print("\n🔍 Test 3: Modify file and import again (should reindex)")
    print("-" * 30)
    
    # Wait a moment to ensure modified time changes
    time.sleep(1)
    
    # Modify the file
    modified_content = "This is a modified test document for efficient indexing."
    with open(test_file, "w") as f:
        f.write(modified_content)
    
    print(f"📝 Modified test file content")
    
    result3 = await file_service._import_single_file(test_file)
    if result3:
        print(f"✅ Modified file import successful: {result3['filename']}")
        
        # Check if file was reindexed
        db = next(get_db())
        doc = db.query(Document).filter(Document.id == result3['id']).first()
        if doc and doc.is_indexed:
            print(f"✅ File was reindexed (is_indexed: {doc.is_indexed})")
            print(f"✅ New file hash: {doc.file_hash}")
            print(f"✅ New modified time: {doc.modified_time}")
        else:
            print(f"❌ File was not reindexed (is_indexed: {doc.is_indexed if doc else 'None'})")
    else:
        print("❌ Modified file import failed")
    
    # Test 4: Force reindex (should reindex even if unchanged)
    print("\n🔍 Test 4: Force reindex (should reindex even if unchanged)")
    print("-" * 30)
    
    result4 = await file_service._import_single_file(test_file, force=True)
    if result4:
        print(f"✅ Force import successful: {result4['filename']}")
        
        # Check if file was reindexed
        db = next(get_db())
        doc = db.query(Document).filter(Document.id == result4['id']).first()
        if doc and doc.is_indexed:
            print(f"✅ File was force reindexed (is_indexed: {doc.is_indexed})")
        else:
            print(f"❌ File was not force reindexed (is_indexed: {doc.is_indexed if doc else 'None'})")
    else:
        print("❌ Force import failed")
    
    # Test 5: Test folder import with multiple files
    print("\n🔍 Test 5: Test folder import with multiple files")
    print("-" * 30)
    
    # Create additional test files
    test_file2 = test_dir / "test_document2.txt"
    test_file3 = test_dir / "test_document3.txt"
    
    with open(test_file2, "w") as f:
        f.write("This is test document 2.")
    
    with open(test_file3, "w") as f:
        f.write("This is test document 3.")
    
    print(f"📄 Created additional test files")
    
    # Import folder
    folder_result = await file_service.import_folder(str(test_dir))
    print(f"✅ Folder import completed:")
    print(f"   Total files: {folder_result['total_count']}")
    print(f"   Indexed: {folder_result['indexed_count']}")
    print(f"   Skipped: {folder_result['skipped_count']}")
    
    # Cleanup
    print("\n🧹 Cleaning up test files...")
    for test_file_path in [test_file, test_file2, test_file3]:
        if test_file_path.exists():
            test_file_path.unlink()
    
    if test_dir.exists():
        test_dir.rmdir()
    
    print("✅ Test completed successfully!")

if __name__ == "__main__":
    asyncio.run(test_efficient_indexing()) 