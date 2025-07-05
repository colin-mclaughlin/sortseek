export interface ImportFolderRequest {
  filePaths: string[]
}

export interface ImportFolderResponse {
  success: boolean
  message: string
  importedFiles: string[]
  count: number
}

export interface Document {
  id: number
  filename: string
  file_path: string
  file_type: string
  file_size: number
  content: string
  summary: string | null
  created_at: string
  updated_at: string
  is_indexed: boolean
  embedding_path: string | null
}

export interface DocumentsResponse {
  documents: Document[]
  total: number
} 