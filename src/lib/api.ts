const API_BASE_URL = 'http://localhost:8000'

export interface BackendStatus {
  status: string
}

export interface ApiError {
  message: string
  status?: number
}

import { ImportFolderRequest, ImportFolderResponse, DocumentsResponse } from '@/lib/types'

export interface SummarizeRequest {
  filePath: string
  maxPages?: number
}

export interface PageSummary {
  page: number
  summary: string
}

export interface SummarizeResponse {
  success: boolean
  message: string
  summaries: PageSummary[]
  totalPages: number
}

export interface SemanticSearchResult {
  filename: string
  file_path: string
  page?: number
  content: string
  score: number
}

/**
 * Check if the backend is running by calling the /ping endpoint
 */
export async function getBackendStatus(): Promise<BackendStatus> {
  console.log('[API] getBackendStatus called')
  try {
    const response = await fetch(`${API_BASE_URL}/ping`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      console.error(`[API] getBackendStatus HTTP error: ${response.status}`)
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    console.log('[API] getBackendStatus response:', data)
    return data as BackendStatus
  } catch (error) {
    console.error('[API] getBackendStatus failed:', error)
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

/**
 * Summarize a PDF document by pages using AI
 */
export async function summarizeDocument(request: SummarizeRequest): Promise<SummarizeResponse> {
  try {
    const response = await fetch(`${API_BASE_URL}/summarize-document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data as SummarizeResponse
  } catch (error) {
    console.error('Failed to summarize document:', error)
    throw new Error(
      error instanceof Error 
        ? error.message 
        : 'Failed to summarize document'
    )
  }
} 

export async function semanticSearch(query: string): Promise<SemanticSearchResult[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/semantic-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }
    const data = await response.json()
    return data.results as SemanticSearchResult[]
  } catch (error) {
    console.error('Failed to perform semantic search:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to perform semantic search'
    )
  }
} 