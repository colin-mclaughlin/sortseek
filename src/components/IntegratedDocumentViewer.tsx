import { useState, useCallback, useEffect } from 'react'
import { Document, Page } from 'react-pdf'
import { pdfjs } from 'react-pdf'
import { 
  ChevronLeft, 
  ChevronRight, 
  Loader2, 
  FileText, 
  AlertCircle, 
  Sparkles, 
  Copy, 
  Check,
  X,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { summarizeDocument, SummarizeResponse, PageSummary } from '@/lib/api'


// Set up PDF.js worker for Electron
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'

interface IntegratedDocumentViewerProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  fileName: string
  fileType: string
  content?: string
}

export function IntegratedDocumentViewer({ 
  isOpen, 
  onClose, 
  filePath, 
  fileName, 
  fileType, 
  content 
}: IntegratedDocumentViewerProps) {
  // PDF-specific state
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  
  // Common state
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [renderedContent, setRenderedContent] = useState<string>('')
  const [documentLoading, setDocumentLoading] = useState<boolean>(false)
  const [copied, setCopied] = useState(false)
  
  // Summary panel state
  const [showSummaryPanel, setShowSummaryPanel] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<PageSummary[]>([])
  const [totalPages, setTotalPages] = useState(0)

  // Load document when component mounts or filePath changes
  useEffect(() => {
    if (isOpen && filePath) {
      console.log('🔄 IntegratedDocumentViewer: Modal opened, loading file:', filePath)
      loadDocument()
    }
  }, [isOpen, filePath])

  const loadDocument = async () => {
    setLoading(true)
    setError(null)
    setRenderedContent('')
    setPdfData(null)
    setNumPages(0)
    setPageNumber(1)
    setPdfUrl(null)
    
    try {
      if (fileType === '.pdf') {
        await loadPdfFile()
      } else if (fileType === '.txt' || fileType === '.docx') {
        await loadTextFile()
      } else {
        throw new Error(`Unsupported file type: ${fileType}`)
      }
    } catch (error) {
      console.error('❌ IntegratedDocumentViewer: Error loading document:', error)
      setError(error instanceof Error ? error.message : 'Failed to load document')
      setLoading(false)
      setDocumentLoading(false)
    }
  }

  const loadPdfFile = async () => {
    console.log('📄 IntegratedDocumentViewer: Starting to load PDF file')
    
    try {
      console.log('📄 IntegratedDocumentViewer: Calling Electron API for file:', filePath)
      
      const result = await window.api?.fileSystem?.readPdfFile(filePath)
      console.log('📄 IntegratedDocumentViewer: Electron API result:', result)
      
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to read PDF file')
      }
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('No PDF data received or invalid data format')
      }
      
      const uint8Array = new Uint8Array(result.data)
      console.log(`✅ IntegratedDocumentViewer: PDF data loaded: ${uint8Array.length} bytes`)
      
      // Verify it's actually a PDF by checking the first few bytes
      const header = Array.from(uint8Array.slice(0, 4)).map(b => String.fromCharCode(b)).join('')
      console.log('📄 IntegratedDocumentViewer: File header:', header)
      
      if (header !== '%PDF') {
        throw new Error('File does not appear to be a valid PDF')
      }
      
      setPdfData(uint8Array)
      setLoading(false)
      setDocumentLoading(true) // Start document loading state
      
      // Create data URL for react-pdf@7.0.0 (avoids CSP issues with blob URLs)
      const base64 = btoa(String.fromCharCode(...uint8Array))
      const dataUrl = `data:application/pdf;base64,${base64}`
      setPdfUrl(dataUrl)
      console.log('✅ IntegratedDocumentViewer: Created data URL (length:', dataUrl.length, ')')
      
    } catch (error) {
      throw error
    }
  }

  const loadTextFile = async () => {
    console.log('🔍 IntegratedDocumentViewer processing:', { fileType, fileName, hasContent: !!content })
    
    try {
      if (fileType === '.txt') {
        // For TXT files, use the content directly
        if (!content) {
          throw new Error('No content available for this text file')
        }
        setRenderedContent(content)
        console.log('✅ IntegratedDocumentViewer: TXT content processed')
      } else if (fileType === '.docx') {
        // For DOCX files, we'll display the extracted text
        if (!content) {
          throw new Error('No content available for this DOCX file')
        }
        
        setRenderedContent(content)
        console.log('✅ IntegratedDocumentViewer: DOCX content processed (extracted text)')
      }
      
      setLoading(false)
      setDocumentLoading(false)
    } catch (error) {
      throw error
    }
  }

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log(`✅ IntegratedDocumentViewer: PDF loaded successfully: ${numPages} pages`)
    setNumPages(numPages)
    setPageNumber(1)
    setDocumentLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('❌ IntegratedDocumentViewer: PDF load error:', error)
    setError(`Failed to load PDF document: ${error.message}`)
    setDocumentLoading(false)
  }, [])

  const goToPrevPage = useCallback(() => {
    setPageNumber(prev => Math.max(prev - 1, 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber(prev => Math.min(prev + 1, numPages))
  }, [numPages])

  const handleClose = useCallback(() => {
    console.log('🔄 IntegratedDocumentViewer: Closing modal')
    setPageNumber(1)
    setLoading(false)
    setDocumentLoading(false)
    setError(null)
    setPdfData(null)
    setNumPages(0)
    setPdfUrl(null)
    setRenderedContent('')
    setShowSummaryPanel(false)
    setSummaryLoading(false)
    setSummaryError(null)
    setSummaries([])
    setTotalPages(0)
    setCopied(false)
    onClose()
  }, [onClose])

  const handleCopyContent = useCallback(async () => {
    try {
      const contentToCopy = fileType === '.pdf' ? 'PDF content' : renderedContent
      await navigator.clipboard.writeText(contentToCopy)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
  }, [renderedContent, fileType])

  const toggleSummaryPanel = useCallback(() => {
    setShowSummaryPanel(prev => !prev)
  }, [])

  const generateSummaries = async () => {
    setSummaryLoading(true)
    setSummaryError(null)
    setSummaries([])
    setTotalPages(0)

    try {
      console.log('🔄 Starting document summarization for:', filePath)
      
      const response: SummarizeResponse = await summarizeDocument({
        filePath,
        maxPages: 5 // Limit to first 5 pages for performance
      })

      if (!response.success) {
        throw new Error(response.message || 'Summarization failed')
      }

      setSummaries(response.summaries)
      setTotalPages(response.totalPages)
      setShowSummaryPanel(true) // Show the panel when summaries are generated
      
      console.log(`✅ Generated ${response.summaries.length} summaries`)
      
    } catch (error) {
      console.error('❌ Summarization failed:', error)
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summaries')
    } finally {
      setSummaryLoading(false)
    }
  }

  const handleRetrySummaries = () => {
    generateSummaries()
  }

  // Debug logging
  useEffect(() => {
    console.log('🔍 IntegratedDocumentViewer: State update:', {
      loading,
      documentLoading,
      error,
      fileType,
      numPages,
      pageNumber,
      showSummaryPanel,
      summaryLoading,
      isOpen
    })
  }, [loading, documentLoading, error, fileType, numPages, pageNumber, showSummaryPanel, summaryLoading, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] w-[95vw] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {fileName}
            <span className="text-sm text-muted-foreground font-normal">
              ({fileType.toUpperCase()})
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 min-h-0">
          {/* Document Viewer Panel */}
          <div className={`flex flex-col flex-1 min-h-0 ${showSummaryPanel ? 'border-r' : ''}`}>
            {/* Navigation Bar */}
            <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/50 flex-shrink-0">
              <div className="flex items-center gap-2">
                {fileType === '.pdf' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToPrevPage}
                      disabled={pageNumber <= 1 || documentLoading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    
                    <span className="text-sm text-muted-foreground">
                      Page {pageNumber} of {numPages}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={goToNextPage}
                      disabled={pageNumber >= numPages || documentLoading}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </>
                )}
                
                {fileType !== '.pdf' && (
                  <span className="text-sm text-muted-foreground">
                    {renderedContent.length} characters
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {fileType !== '.pdf' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopyContent}
                    disabled={loading || !renderedContent}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 mr-1" />
                    ) : (
                      <Copy className="h-4 w-4 mr-1" />
                    )}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                )}
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={generateSummaries}
                  disabled={documentLoading || loading || summaryLoading}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  {summaryLoading ? 'Generating...' : 'Summarize'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSummaryPanel}
                  disabled={summaries.length === 0}
                >
                  {showSummaryPanel ? (
                    <PanelLeftClose className="h-4 w-4" />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Document Content */}
            <div className="flex-1 overflow-auto p-6 min-h-0">
              {loading && (
                <div className="flex items-center justify-center h-64">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Loading {fileType.toUpperCase()} file...</span>
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center justify-center h-64">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500" />
                    <h3 className="text-lg font-medium">Error Loading {fileType.toUpperCase()}</h3>
                    <p className="text-muted-foreground max-w-md">{error}</p>
                    <Button variant="outline" onClick={loadDocument}>
                      Try Again
                    </Button>
                  </div>
                </div>
              )}

              {/* PDF Content */}
              {!loading && !error && fileType === '.pdf' && pdfUrl && (
                <div className="flex justify-center">
                  <Document
                    file={pdfUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="flex items-center justify-center h-64">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-6 w-6 animate-spin" />
                          <span>Processing PDF...</span>
                        </div>
                      </div>
                    }
                    error={
                      <div className="flex items-center justify-center h-64">
                        <div className="flex flex-col items-center gap-2 text-center">
                          <AlertCircle className="h-12 w-12 text-red-500" />
                          <h3 className="text-lg font-medium">Error Processing PDF</h3>
                          <p className="text-muted-foreground max-w-md">
                            Unable to process the PDF document. Please check if the file is corrupted.
                          </p>
                        </div>
                      </div>
                    }
                  >
                    {numPages > 0 && (
                      <Page
                        pageNumber={pageNumber}
                        width={Math.min(window.innerWidth * 0.6, 600)}
                        renderTextLayer={true}
                        renderAnnotationLayer={false}
                        loading={
                          <div className="flex items-center justify-center h-64">
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-6 w-6 animate-spin" />
                              <span>Rendering page...</span>
                            </div>
                          </div>
                        }
                      />
                    )}
                  </Document>
                </div>
              )}

              {/* Text Content */}
              {!loading && !error && fileType !== '.pdf' && renderedContent && (
                <div className="max-w-none">
                  {fileType === '.txt' ? (
                    // TXT files: Use monospace font with preserved whitespace
                    <pre className="whitespace-pre-wrap font-mono text-sm bg-muted/30 p-4 rounded-lg border overflow-auto max-h-[60vh]">
                      {renderedContent}
                    </pre>
                  ) : fileType === '.docx' ? (
                    // DOCX files: Use regular text with HTML formatting
                    <div className="prose prose-sm max-w-none bg-muted/30 p-4 rounded-lg border overflow-auto max-h-[60vh]">
                      <div 
                        className="whitespace-pre-wrap"
                        dangerouslySetInnerHTML={{ 
                          __html: renderedContent.replace(/\n/g, '<br>') 
                        }} 
                      />
                    </div>
                  ) : null}
                </div>
              )}

              {!loading && !error && !pdfData && !renderedContent && (
                <div className="flex items-center justify-center h-64">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Preparing {fileType.toUpperCase()} viewer...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Summary Panel */}
          {showSummaryPanel && (
            <div className="w-96 flex flex-col min-h-0 border-l">
              <div className="p-4 border-b bg-muted/50 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">AI Summaries</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleSummaryPanel}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 overflow-auto p-4">
                {summaryLoading && (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="flex items-center gap-2 mb-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="text-lg">Generating summaries...</span>
                    </div>
                    <p className="text-sm text-muted-foreground text-center max-w-md">
                      This may take a few moments as we analyze each page of your document.
                    </p>
                  </div>
                )}

                {summaryError && (
                  <div className="flex flex-col items-center justify-center h-64">
                    <div className="flex flex-col items-center gap-4 text-center">
                      <AlertCircle className="h-12 w-12 text-red-500" />
                      <div>
                        <h3 className="text-lg font-medium mb-2">Summarization Failed</h3>
                        <p className="text-muted-foreground max-w-md mb-4">{summaryError}</p>
                        <Button onClick={handleRetrySummaries} variant="outline">
                          Try Again
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!summaryLoading && !summaryError && summaries.length > 0 && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500" />
                        <span className="text-sm text-muted-foreground">
                          Generated {summaries.length} summaries
                          {totalPages > summaries.length && ` (showing first ${summaries.length} of ${totalPages} pages)`}
                        </span>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleRetrySummaries}>
                        Regenerate
                      </Button>
                    </div>

                    <div className="space-y-4">
                      {summaries.map((summary) => (
                        <Card key={summary.page}>
                          <CardHeader className="pb-3">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <span className="bg-primary text-primary-foreground px-2 py-1 rounded text-sm font-medium">
                                Page {summary.page}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm leading-relaxed">{summary.summary}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {!summaryLoading && !summaryError && summaries.length === 0 && (
                  <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                      <p className="text-muted-foreground">No summaries generated</p>
                      <Button onClick={handleRetrySummaries} variant="outline" className="mt-2">
                        Try Again
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 