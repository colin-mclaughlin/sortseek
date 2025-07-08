#!/usr/bin/env python3
"""
Test script for the new refresh and delete document endpoints
"""

import requests
import json
import time

BASE_URL = "http://localhost:8000"

def test_refresh_delete_endpoints():
    print("🧪 Testing Refresh and Delete Document Endpoints")
    print("=" * 50)
    
    # First, get all documents to see what's available
    print("\n1. Getting all documents...")
    try:
        response = requests.get(f"{BASE_URL}/documents")
        if response.status_code == 200:
            documents = response.json()
            print(f"✅ Found {len(documents.get('documents', []))} documents")
            
            if not documents.get('documents'):
                print("❌ No documents found. Please import some documents first.")
                return
            
            # Use the first document for testing
            test_doc = documents['documents'][0]
            doc_id = test_doc['id']
            filename = test_doc['filename']
            
            print(f"📄 Using document for testing: {filename} (ID: {doc_id})")
            
        else:
            print(f"❌ Failed to get documents: {response.status_code}")
            return
            
    except Exception as e:
        print(f"❌ Error getting documents: {e}")
        return
    
    # Test refresh endpoint
    print(f"\n2. Testing refresh endpoint for document {doc_id}...")
    try:
        response = requests.post(f"{BASE_URL}/documents/{doc_id}/refresh")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Refresh successful: {result.get('message')}")
            print(f"   Updated content length: {len(result.get('document', {}).get('content', ''))} characters")
        else:
            print(f"❌ Refresh failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Error during refresh: {e}")
    
    # Test delete endpoint (without actually deleting the file)
    print(f"\n3. Testing delete endpoint for document {doc_id} (dry run)...")
    try:
        response = requests.delete(f"{BASE_URL}/documents/{doc_id}?delete_file=false")
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Delete successful: {result.get('message')}")
            print(f"   File deleted from disk: {result.get('deleted_file')}")
        else:
            print(f"❌ Delete failed: {response.status_code} - {response.text}")
            
    except Exception as e:
        print(f"❌ Error during delete: {e}")
    
    # Test error cases
    print(f"\n4. Testing error cases...")
    
    # Test refresh with non-existent document
    print("   Testing refresh with non-existent document...")
    try:
        response = requests.post(f"{BASE_URL}/documents/99999/refresh")
        if response.status_code == 404:
            print("   ✅ Correctly returned 404 for non-existent document")
        else:
            print(f"   ❌ Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # Test delete with non-existent document
    print("   Testing delete with non-existent document...")
    try:
        response = requests.delete(f"{BASE_URL}/documents/99999")
        if response.status_code == 404:
            print("   ✅ Correctly returned 404 for non-existent document")
        else:
            print(f"   ❌ Expected 404, got {response.status_code}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n🎉 Test completed!")

if __name__ == "__main__":
    test_refresh_delete_endpoints() 