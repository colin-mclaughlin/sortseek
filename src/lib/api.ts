const API_BASE_URL = 'http://localhost:8000'

export interface BackendStatus {
  status: string
}

export interface ApiError {
  message: string
  status?: number
}

import { ImportFolderRequest, ImportFolderResponse, DocumentsResponse } from '@/lib/types'

/**
 * Check if the backend is running by calling the /ping endpoint
 */
export async function getBackendStatus(): Promise<BackendStatus> {
  try {
    const response = await fetch(`${API_BASE_URL}/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data as BackendStatus
  } catch (error) {
    console.error('Failed to check backend status:', error)
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to connect to backend'
    )
  }
}

/**
 * Get detailed health information from the backend
 */
export async function getBackendHealth(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get backend health:', error)
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to get backend health'
    )
  }
}

/**
 * Import a list of file paths to the backend
 */
export async function importFolder(filePaths: string[]): Promise<ImportFolderResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/import`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePaths } as ImportFolderRequest),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data as ImportFolderResponse
  } catch (error) {
    console.error('Failed to import folder:', error)
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to import folder'
    )
  }
}

/**
 * Get all documents from the backend
 */
export async function getDocuments(): Promise<DocumentsResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Failed to get documents:', error)
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to get documents'
    )
  }
} 