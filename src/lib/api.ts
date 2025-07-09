export const API_BASE_URL = 'http://localhost:8000'

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
  metadata?: {
    filetype?: string;
    import_time?: string;
    source_path?: string;
    [key: string]: any;
  };
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

export interface SemanticSearchFilters {
  filetype?: string;
  folder?: string;
  import_time_after?: string; // ISO date string
  import_time_before?: string; // ISO date string
}

export async function semanticSearch(query: string, filters?: SemanticSearchFilters): Promise<SemanticSearchResult[]> {
  try {
    const requestBody: any = { query }
    if (filters) {
      requestBody.filters = filters
    }
    
    const response = await fetch(`${API_BASE_URL}/semantic-search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
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

/**
 * Refresh a document by re-reading from disk
 */
export async function refreshDocument(documentId: number): Promise<{ success: boolean; message: string; document: any }> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to refresh document:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to refresh document'
    )
  }
}

/**
 * Delete a document from the database and optionally from disk
 */
export async function deleteDocument(documentId: number, deleteFile: boolean = false): Promise<{ success: boolean; message: string; deleted_file: boolean }> {
  try {
    const response = await fetch(`${API_BASE_URL}/documents/${documentId}?delete_file=${deleteFile}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Failed to delete document:', error)
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to delete document'
    )
  }
}

export async function summarizeClause(text: string): Promise<{ summary: string }> {
  const response = await fetch(`${API_BASE_URL}/summarize-clause`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
}