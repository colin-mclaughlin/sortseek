import React, { useState, useEffect } from 'react'
import { FolderOpen, FileText, Settings, RefreshCw, Loader2, Eye, RotateCcw, Trash2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { getBackendStatus, importFolder, getDocuments, refreshDocument, deleteDocument } from '@/lib/api'
import { Document } from '@/lib/types'
import { IntegratedDocumentViewer } from '@/components/IntegratedDocumentViewer'
import { SemanticSearchPanel } from '@/components/SemanticSearchPanel'
import { SemanticChat } from '@/components/SemanticChat'
import { DeleteConfirmDialog } from '@/components/DeleteConfirmDialog'
import { FileExplorer } from '@/components/FileExplorer'

function App(): React.JSX.Element {
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedDocument, setSelectedDocument] = useState<{ filePath: string; fileName: string; fileType: string; content?: string } | null>(null)
  const [isDocumentViewerOpen, setIsDocumentViewerOpen] = useState(false)
  const [isSemanticSearchOpen, setIsSemanticSearchOpen] = useState(false)
  
  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Refresh state
  const [refreshingDocuments, setRefreshingDocuments] = useState<Set<number>>(new Set())

  const checkBackendStatus = async () => {
    setIsCheckingBackend(true)
    setBackendError(null)
    
    try {
      const status = await getBackendStatus()
      setIsBackendConnected(status.status === 'ok')
      console.log('Backend status:', status)
    } catch (error) {
      setIsBackendConnected(false)
      setBackendError(error instanceof Error ? error.message : 'Unknown error')
      console.error('Backend connection failed:', error)
    } finally {
      setIsCheckingBackend(false)
    }
  }

  const handleImportFolder = async () => {
    setIsImporting(true)
    setImportError(null)
    
    try {
      // Use Electron API to select folder and get file paths
      // @ts-ignore
      const result = await window.api?.fileSystem?.selectFolder()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to select folder')
      }
      
      console.log('Selected folder:', result.folderPath)
      console.log('Supported files found:', result.filePaths)
      
      if (!result.filePaths || result.filePaths.length === 0) {
        throw new Error('No supported files (.pdf, .docx, .txt) found in the selected folder')
      }
      
      // Send file paths to backend
      const importResult = await importFolder(result.filePaths!)
      
      if (!importResult.success) {
        throw new Error(importResult.message || 'Failed to import files')
      }
      
      console.log('Import successful:', importResult)
      
      // Refresh documents list
      await loadDocuments()
      
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unknown error')
      console.error('Import failed:', error)
    } finally {
      setIsImporting(false)
    }
  }
  
  const loadDocuments = async () => {
    try {
      const result = await getDocuments()
      console.log('Documents fetched:', result)
      setDocuments(result.documents || [])
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const handleViewDocument = (doc: Document) => {
    // Normalize file type to lowercase with dot prefix for consistent comparison
    const normalizedFileType = doc.file_type.toLowerCase().startsWith('.') 
      ? doc.file_type.toLowerCase() 
      : `.${doc.file_type.toLowerCase()}`
    
    setSelectedDocument({ 
      filePath: doc.file_path, 
      fileName: doc.filename, 
      fileType: normalizedFileType,
      content: doc.content
    })
    setIsDocumentViewerOpen(true)
  }

  const handleViewDocumentFromSearch = (filePath: string, fileName: string, fileType: string, content?: string) => {
    // Find the document in our documents list to get the full content
    const doc = documents.find(d => d.file_path === filePath)
    
    setSelectedDocument({ 
      filePath, 
      fileName, 
      fileType,
      content: content || doc?.content
    })
    setIsDocumentViewerOpen(true)
  }

  const handleCloseDocumentViewer = () => {
    setIsDocumentViewerOpen(false)
    setSelectedDocument(null)
  }

  const handleRefreshDocument = async (doc: Document) => {
    try {
      setRefreshingDocuments(prev => new Set(prev).add(doc.id))
      
      const result = await refreshDocument(doc.id)
      
      if (result.success) {
        // Update the document in the local state
        setDocuments(prev => prev.map(d => 
          d.id === doc.id ? { ...d, content: result.document.content, file_size: result.document.file_size } : d
        ))
        
        // If this document is currently open, update its content
        if (selectedDocument && selectedDocument.filePath === doc.file_path) {
          setSelectedDocument(prev => prev ? { ...prev, content: result.document.content } : null)
        }
        
        console.log('Document refreshed successfully:', result.message)
      }
    } catch (error) {
      console.error('Failed to refresh document:', error)
      // You could add a toast notification here
    } finally {
      setRefreshingDocuments(prev => {
        const newSet = new Set(prev)
        newSet.delete(doc.id)
        return newSet
      })
    }
  }

  const handleDeleteDocument = (doc: Document) => {
    setDocumentToDelete(doc)
    setDeleteDialogOpen(true)
  }

  const handleConfirmDelete = async (deleteFile: boolean) => {
    if (!documentToDelete) return
    
    try {
      setIsDeleting(true)
      
      const result = await deleteDocument(documentToDelete.id, deleteFile)
      
      if (result.success) {
        // Remove from local state
        setDocuments(prev => prev.filter(d => d.id !== documentToDelete.id))
        
        // If this document is currently open, close the viewer
        if (selectedDocument && selectedDocument.filePath === documentToDelete.file_path) {
          setIsDocumentViewerOpen(false)
          setSelectedDocument(null)
        }
        
        console.log('Document deleted successfully:', result.message)
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      // You could add a toast notification here
    } finally {
      setIsDeleting(false)
      setDeleteDialogOpen(false)
      setDocumentToDelete(null)
    }
  }

  const handleRenameSuccess = () => {
    loadDocuments();
    // Optionally: show a toast or UI notification here
  };

  // Debug function to test document viewer
  const handleTestDocumentViewer = () => {
    // Test with a sample document path - you can replace this with an actual document path
    const testPath = 'C:/test.pdf' // Replace with actual path for testing
    setSelectedDocument({ 
      filePath: testPath, 
      fileName: 'Test Document',
      fileType: '.pdf'
    })
    setIsDocumentViewerOpen(true)
  }

  const handleViewFileFromExplorer = (filePath: string, fileName: string, fileType: string) => {
    setSelectedDocument({ 
      filePath, 
      fileName, 
      fileType,
      content: undefined // Will be loaded by the viewer
    })
    setIsDocumentViewerOpen(true)
  }

  const handleImportFileFromExplorer = async (filePath: string) => {
    try {
      setIsImporting(true)
      setImportError(null)
      
      const importResult = await importFolder([filePath])
      
      if (!importResult.success) {
        throw new Error(importResult.message || 'Failed to import file')
      }
      
      console.log('File imported successfully:', importResult)
      
      // Refresh documents list
      await loadDocuments()
      
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Unknown error')
      console.error('Import failed:', error)
    } finally {
      setIsImporting(false)
    }
  }

  useEffect(() => {
    // Check backend status on component mount
    checkBackendStatus()
    // Load documents
    loadDocuments()
  }, [])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">SortSeek</h1>
              <p className="text-sm text-muted-foreground">File Assistant</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isBackendConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isBackendConnected ? 'Connected' : 'Disconnected'}
              </span>
              {backendError && (
                <span className="text-xs text-red-500 ml-2" title={backendError}>
                  {backendError}
                </span>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={checkBackendStatus}
              disabled={isCheckingBackend}
              title="Test Backend Connection"
            >
              <RefreshCw className={`h-4 w-4 ${isCheckingBackend ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="icon">
              <Settings className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSemanticSearchOpen(true)}
              title="Semantic Search"
            >
              <Sparkles className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleTestDocumentViewer}
              title="Test Document Viewer"
            >
              <FileText className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-card">
          <div className="p-4">
            <Button 
              className="w-full justify-start" 
              variant="outline"
              onClick={handleImportFolder}
              disabled={isImporting || !isBackendConnected}
            >
              {isImporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FolderOpen className="mr-2 h-4 w-4" />
              )}
              {isImporting ? 'Importing...' : 'Import Folder'}
            </Button>
            {importError && (
              <p className="text-xs text-red-500 mt-2">{importError}</p>
            )}
          </div>
          
          <Separator />
          
          <nav className="p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Documents</h3>
            <div className="space-y-1">
              <Button variant="ghost" className="w-full justify-start text-sm">
                All Documents
              </Button>
              <Button variant="ghost" className="w-full justify-start text-sm">
                Recent
              </Button>
              <Button variant="ghost" className="w-full justify-start text-sm">
                Favorites
              </Button>
            </div>
          </nav>
        </aside>

        {/* Main Area */}
        <main className="flex-1 flex flex-col">
          {/* Content Area */}
          <div className="flex-1">
            <Tabs defaultValue="chat" className="h-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="chat">AI Chat</TabsTrigger>
                <TabsTrigger value="documents">Documents</TabsTrigger>
              </TabsList>
              
              <TabsContent value="chat" className="mt-6 h-[calc(100vh-200px)]">
                <SemanticChat
                  className="flex-1"
                  onViewDocument={handleViewDocumentFromSearch}
                  onRenameSuccess={handleRenameSuccess}
                />
              </TabsContent>
              
              <TabsContent value="documents" className="mt-6 h-[calc(100vh-200px)]">
                <FileExplorer
                  onViewFile={handleViewFileFromExplorer}
                  onImportFile={handleImportFileFromExplorer}
                  className="h-full"
                />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      {/* Integrated Document Viewer Modal */}
      {selectedDocument && (
        <IntegratedDocumentViewer
          isOpen={isDocumentViewerOpen}
          onClose={handleCloseDocumentViewer}
          filePath={selectedDocument.filePath}
          fileName={selectedDocument.fileName}
          fileType={selectedDocument.fileType}
          content={selectedDocument.content}
        />
      )}
      <SemanticSearchPanel
        isOpen={isSemanticSearchOpen}
        onClose={() => setIsSemanticSearchOpen(false)}
        onViewDocument={handleViewDocumentFromSearch}
      />
      
      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        isOpen={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={handleConfirmDelete}
        fileName={documentToDelete?.filename || ''}
        isLoading={isDeleting}
      />
    </div>
  )
}

export default App 