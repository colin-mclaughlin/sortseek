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
  filepath: string
  fileSize: number
  createdAt: string
  updatedAt: string
}

export interface DocumentsResponse {
  documents: Document[]
  total: number
} 