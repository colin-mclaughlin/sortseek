#!/usr/bin/env python3
"""
Test script to verify file reading functionality
"""

import requests
import json
import os

def test_file_reading():
    """Test the file reading endpoint"""
    
    # Create a test text file
    test_content = "This is a test file for SortSeek.\nIt contains multiple lines.\nThis should be readable by the file explorer."
    test_file_path = "test_file.txt"
    
    try:
        # Create test file
        with open(test_file_path, 'w', encoding='utf-8') as f:
            f.write(test_content)
        
        print(f"✅ Created test file: {test_file_path}")
        
        # Test the read-file-content endpoint
        url = "http://localhost:8000/read-file-content"
        params = {"path": os.path.abspath(test_file_path)}
        
        print(f"🔍 Testing endpoint: {url}")
        print(f"📁 File path: {params['path']}")
        
        response = requests.get(url, params=params)
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data.get('success')}")
            print(f"📝 Content length: {len(data.get('content', ''))}")
            print(f"💬 Message: {data.get('message')}")
            
            if data.get('content'):
                print(f"📄 Content preview: {data['content'][:100]}...")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")
    
    finally:
        # Clean up test file
        if os.path.exists(test_file_path):
            os.remove(test_file_path)
            print(f"🧹 Cleaned up test file: {test_file_path}")

def test_file_tree():
    """Test the file tree endpoint"""
    
    try:
        # Test with current directory
        current_dir = os.getcwd()
        url = "http://localhost:8000/file-tree"
        params = {"base_path": current_dir}
        
        print(f"\n🔍 Testing file tree endpoint: {url}")
        print(f"📁 Base path: {current_dir}")
        
        response = requests.get(url, params=params)
        
        print(f"📊 Response status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success: {data.get('success')}")
            print(f"💬 Message: {data.get('message')}")
            
            if data.get('tree'):
                tree = data['tree']
                print(f"📂 Root name: {tree.get('name')}")
                print(f"📂 Root path: {tree.get('path')}")
                print(f"📂 Children count: {len(tree.get('children', []))}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Test failed: {e}")

if __name__ == "__main__":
    print("🧪 Testing SortSeek file reading functionality...")
    print("=" * 50)
    
    test_file_reading()
    test_file_tree()
    
    print("\n✅ Test completed!") 