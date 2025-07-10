#!/usr/bin/env python3
"""
Test script to verify enhanced file browser functionality
"""

import requests
import json
import os
import tempfile

def test_file_browser_features():
    """Test the enhanced file browser features"""
    
    print("🧪 Testing Enhanced File Browser Features")
    print("=" * 50)
    
    # Test 1: File tree with mixed content
    print("\n1️⃣ Testing file tree with mixed content...")
    test_mixed_folder()
    
    # Test 2: Empty folder handling
    print("\n2️⃣ Testing empty folder handling...")
    test_empty_folder()
    
    # Test 3: Unsupported files only
    print("\n3️⃣ Testing unsupported files only...")
    test_unsupported_files_only()
    
    # Test 4: File content reading
    print("\n4️⃣ Testing file content reading...")
    test_file_content_reading()

def test_mixed_folder():
    """Test a folder with mixed content (folders, supported files, unsupported files)"""
    
    # Create a temporary directory with mixed content
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create subdirectories
        subdir1 = os.path.join(temp_dir, "Documents")
        subdir2 = os.path.join(temp_dir, "Images")
        os.makedirs(subdir1, exist_ok=True)
        os.makedirs(subdir2, exist_ok=True)
        
        # Create supported files
        with open(os.path.join(temp_dir, "test.txt"), "w") as f:
            f.write("This is a test text file")
        
        with open(os.path.join(subdir1, "document.pdf"), "w") as f:
            f.write("%PDF-1.4\nTest PDF content")
        
        # Create unsupported files
        with open(os.path.join(temp_dir, "image.jpg"), "w") as f:
            f.write("Fake JPEG content")
        
        with open(os.path.join(subdir2, "video.mp4"), "w") as f:
            f.write("Fake MP4 content")
        
        # Test file tree
        url = "http://localhost:8000/file-tree"
        params = {"base_path": temp_dir}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                print(f"✅ File tree created successfully")
                print(f"   📂 Root: {data.get('tree', {}).get('name', 'Unknown')}")
                print(f"   📄 Children: {len(data.get('tree', {}).get('children', []))}")
            else:
                print(f"❌ File tree failed: {response.status_code}")
        except Exception as e:
            print(f"❌ File tree test failed: {e}")
        
        # Test files in folder
        url = "http://localhost:8000/files-in-folder"
        params = {"path": temp_dir}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])
                print(f"✅ Files in folder: {len(files)} items")
                
                # Count different types
                folders = [f for f in files if not f.get('is_file', True)]
                supported_files = [f for f in files if f.get('is_file') and f.get('type', '').lower() in ['.pdf', '.docx', '.txt']]
                unsupported_files = [f for f in files if f.get('is_file') and f.get('type', '').lower() not in ['.pdf', '.docx', '.txt']]
                
                print(f"   📁 Folders: {len(folders)}")
                print(f"   📄 Supported files: {len(supported_files)}")
                print(f"   ⚠️  Unsupported files: {len(unsupported_files)}")
            else:
                print(f"❌ Files in folder failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Files in folder test failed: {e}")

def test_empty_folder():
    """Test handling of empty folders"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        url = "http://localhost:8000/files-in-folder"
        params = {"path": temp_dir}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])
                print(f"✅ Empty folder test: {len(files)} items (should be 0)")
            else:
                print(f"❌ Empty folder test failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Empty folder test failed: {e}")

def test_unsupported_files_only():
    """Test folder with only unsupported files"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create only unsupported files
        with open(os.path.join(temp_dir, "image.png"), "w") as f:
            f.write("Fake PNG content")
        
        with open(os.path.join(temp_dir, "archive.zip"), "w") as f:
            f.write("Fake ZIP content")
        
        url = "http://localhost:8000/files-in-folder"
        params = {"path": temp_dir}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                files = data.get('files', [])
                supported_files = [f for f in files if f.get('is_file') and f.get('type', '').lower() in ['.pdf', '.docx', '.txt']]
                unsupported_files = [f for f in files if f.get('is_file') and f.get('type', '').lower() not in ['.pdf', '.docx', '.txt']]
                
                print(f"✅ Unsupported files test: {len(supported_files)} supported, {len(unsupported_files)} unsupported")
            else:
                print(f"❌ Unsupported files test failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Unsupported files test failed: {e}")

def test_file_content_reading():
    """Test reading file content"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a test text file
        test_file = os.path.join(temp_dir, "test.txt")
        test_content = "This is a test file for the enhanced file browser.\nIt contains multiple lines.\nThis should be readable."
        
        with open(test_file, "w", encoding="utf-8") as f:
            f.write(test_content)
        
        url = "http://localhost:8000/read-file-content"
        params = {"path": test_file}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                if data.get('success'):
                    content = data.get('content', '')
                    print(f"✅ File content reading: {len(content)} characters")
                    print(f"   📄 Preview: {content[:50]}...")
                else:
                    print(f"❌ File content reading failed: {data.get('message')}")
            else:
                print(f"❌ File content reading failed: {response.status_code}")
        except Exception as e:
            print(f"❌ File content reading test failed: {e}")

if __name__ == "__main__":
    test_file_browser_features()
    print("\n✅ Enhanced file browser tests completed!") 