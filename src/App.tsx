import React, { useState, useEffect } from 'react'
import { Search, FolderOpen, FileText, Settings, Menu, RefreshCw, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { getBackendStatus, getBackendHealth, importFolder, getDocuments } from '@/lib/api'
import { Document } from '@/lib/types'

function App(): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [isBackendConnected, setIsBackendConnected] = useState(false)
  const [isCheckingBackend, setIsCheckingBackend] = useState(false)
  const [backendError, setBackendError] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)

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
      console.log('PDF files found:', result.filePaths)
      
      if (result.filePaths.length === 0) {
        throw new Error('No PDF files found in the selected folder')
      }
      
      // Send file paths to backend
      const importResult = await importFolder(result.filePaths)
      
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
                  Error
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
          {/* Search Bar */}
          <div className="p-6 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search your documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 p-6">
            <Tabs defaultValue="documents" className="h-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="documents">Documents</TabsTrigger>
                <TabsTrigger value="search">Search Results</TabsTrigger>
                <TabsTrigger value="insights">Insights</TabsTrigger>
              </TabsList>
              
              <TabsContent value="documents" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Your Documents ({documents.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {documents.length === 0 ? (
                      <div className="text-center py-12">
                        <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">No documents yet</h3>
                        <p className="text-muted-foreground mb-4">
                          Import a folder to get started with SortSeek
                        </p>
                        <Button 
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
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center space-x-3">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                              <div>
                                <p className="font-medium">{doc.filename}</p>
                                <p className="text-sm text-muted-foreground">{doc.file_path}</p>
                              </div>
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {(doc.file_size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="search" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Search Results</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      Search results will appear here when you search for documents.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="insights" className="mt-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Document Insights</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground">
                      AI-powered insights about your documents will appear here.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App 