#!/usr/bin/env python3
"""
Test script to verify tree synchronization functionality
"""

import requests
import json
import os
import tempfile

def test_tree_sync_features():
    """Test the enhanced tree synchronization features"""
    
    print("🧪 Testing Tree Synchronization Features")
    print("=" * 50)
    
    # Test 1: Deep folder structure
    print("\n1️⃣ Testing deep folder structure...")
    test_deep_folder_structure()
    
    # Test 2: Tree expansion
    print("\n2️⃣ Testing tree expansion...")
    test_tree_expansion()
    
    # Test 3: Path navigation
    print("\n3️⃣ Testing path navigation...")
    test_path_navigation()
    
    # Test 4: Mixed content with indexing
    print("\n4️⃣ Testing mixed content with indexing...")
    test_mixed_content_with_indexing()

def test_deep_folder_structure():
    """Test navigation through a deep folder structure"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a deep folder structure
        deep_path = os.path.join(temp_dir, "Level1", "Level2", "Level3", "Level4")
        os.makedirs(deep_path, exist_ok=True)
        
        # Create files at different levels
        with open(os.path.join(temp_dir, "Level1", "file1.txt"), "w") as f:
            f.write("Level 1 file")
        
        with open(os.path.join(temp_dir, "Level1", "Level2", "file2.txt"), "w") as f:
            f.write("Level 2 file")
        
        with open(os.path.join(deep_path, "file4.txt"), "w") as f:
            f.write("Level 4 file")
        
        # Test file tree
        url = "http://localhost:8000/file-tree"
        params = {"base_path": temp_dir}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                tree = data.get('tree', {})
                print(f"✅ Deep folder structure created")
                print(f"   📂 Root: {tree.get('name', 'Unknown')}")
                print(f"   📄 Children: {len(tree.get('children', []))}")
                
                # Test navigation to deep folder
                deep_folder_url = "http://localhost:8000/files-in-folder"
                deep_params = {"path": deep_path}
                
                deep_response = requests.get(deep_folder_url, params=deep_params)
                if deep_response.status_code == 200:
                    deep_data = deep_response.json()
                    files = deep_data.get('files', [])
                    print(f"   📁 Deep folder contains: {len(files)} items")
                else:
                    print(f"   ❌ Deep folder navigation failed: {deep_response.status_code}")
            else:
                print(f"❌ Deep folder structure failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Deep folder test failed: {e}")

def test_tree_expansion():
    """Test tree expansion functionality"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create nested folders
        nested_path = os.path.join(temp_dir, "Parent", "Child", "Grandchild")
        os.makedirs(nested_path, exist_ok=True)
        
        # Add files to each level
        with open(os.path.join(temp_dir, "Parent", "parent.txt"), "w") as f:
            f.write("Parent file")
        
        with open(os.path.join(temp_dir, "Parent", "Child", "child.txt"), "w") as f:
            f.write("Child file")
        
        with open(os.path.join(nested_path, "grandchild.txt"), "w") as f:
            f.write("Grandchild file")
        
        # Test tree structure
        url = "http://localhost:8000/file-tree"
        params = {"base_path": temp_dir}
        
        try:
            response = requests.get(url, params=params)
            if response.status_code == 200:
                data = response.json()
                tree = data.get('tree', {})
                print(f"✅ Nested folder structure created")
                print(f"   📂 Root: {tree.get('name', 'Unknown')}")
                
                # Count nested levels
                children = tree.get('children', [])
                if children:
                    first_child = children[0]
                    grand_children = first_child.get('children', [])
                    if grand_children:
                        great_grand_children = grand_children[0].get('children', [])
                        print(f"   📁 Nesting levels: {len(great_grand_children) + 3}")
                    else:
                        print(f"   📁 Nesting levels: {len(grand_children) + 2}")
                else:
                    print(f"   📁 Nesting levels: 1")
            else:
                print(f"❌ Nested folder test failed: {response.status_code}")
        except Exception as e:
            print(f"❌ Nested folder test failed: {e}")

def test_path_navigation():
    """Test path-based navigation"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create a complex structure
        structure = {
            "Documents": {
                "Work": ["report.pdf", "presentation.pptx"],
                "Personal": ["diary.txt", "photos.jpg"]
            },
            "Downloads": {
                "Software": ["app.exe", "setup.msi"],
                "Media": ["video.mp4", "music.mp3"]
            }
        }
        
        # Build the structure
        for main_folder, sub_folders in structure.items():
            main_path = os.path.join(temp_dir, main_folder)
            os.makedirs(main_path, exist_ok=True)
            
            for sub_folder, files in sub_folders.items():
                sub_path = os.path.join(main_path, sub_folder)
                os.makedirs(sub_path, exist_ok=True)
                
                for file in files:
                    file_path = os.path.join(sub_path, file)
                    with open(file_path, "w") as f:
                        f.write(f"Content for {file}")
        
        # Test navigation to different levels
        test_paths = [
            os.path.join(temp_dir, "Documents"),
            os.path.join(temp_dir, "Documents", "Work"),
            os.path.join(temp_dir, "Downloads", "Media")
        ]
        
        print(f"✅ Complex structure created")
        
        for i, test_path in enumerate(test_paths, 1):
            try:
                url = "http://localhost:8000/files-in-folder"
                params = {"path": test_path}
                
                response = requests.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    files = data.get('files', [])
                    folders = [f for f in files if not f.get('is_file', True)]
                    file_count = len(files) - len(folders)
                    
                    print(f"   📂 Path {i}: {len(folders)} folders, {file_count} files")
                else:
                    print(f"   ❌ Path {i} failed: {response.status_code}")
            except Exception as e:
                print(f"   ❌ Path {i} test failed: {e}")

def test_mixed_content_with_indexing():
    """Test mixed content with indexing indicators"""
    
    with tempfile.TemporaryDirectory() as temp_dir:
        # Create folders with different content types
        folders = {
            "Indexed": ["document.pdf", "report.docx", "notes.txt"],
            "Unindexed": ["image.png", "video.mp4", "archive.zip"],
            "Mixed": ["important.pdf", "photo.jpg", "data.xlsx"]
        }
        
        for folder_name, files in folders.items():
            folder_path = os.path.join(temp_dir, folder_name)
            os.makedirs(folder_path, exist_ok=True)
            
            for file in files:
                file_path = os.path.join(folder_path, file)
                with open(file_path, "w") as f:
                    f.write(f"Content for {file}")
        
        # Test each folder
        print(f"✅ Mixed content structure created")
        
        for folder_name in folders.keys():
            try:
                url = "http://localhost:8000/files-in-folder"
                params = {"path": os.path.join(temp_dir, folder_name)}
                
                response = requests.get(url, params=params)
                if response.status_code == 200:
                    data = response.json()
                    files = data.get('files', [])
                    
                    # Count supported vs unsupported files
                    supported = [f for f in files if f.get('is_file') and f.get('type', '').lower() in ['.pdf', '.docx', '.txt']]
                    unsupported = [f for f in files if f.get('is_file') and f.get('type', '').lower() not in ['.pdf', '.docx', '.txt']]
                    
                    print(f"   📁 {folder_name}: {len(supported)} supported, {len(unsupported)} unsupported")
                else:
                    print(f"   ❌ {folder_name} failed: {response.status_code}")
            except Exception as e:
                print(f"   ❌ {folder_name} test failed: {e}")

if __name__ == "__main__":
    test_tree_sync_features()
    print("\n✅ Tree synchronization tests completed!") 