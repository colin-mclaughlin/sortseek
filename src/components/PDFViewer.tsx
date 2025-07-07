import React, { useState, useCallback, useEffect } from 'react'
import { Document, Page } from 'react-pdf'
import { pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, Loader2, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

// Set up PDF.js worker for Electron - use local worker to avoid CSP issues
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js'
console.log('✅ PDFViewer: Worker configured with version:', pdfjs.version)
console.log('✅ PDFViewer: Worker URL:', pdfjs.GlobalWorkerOptions.workerSrc)

// Test PDF.js functionality
console.log('✅ PDFViewer: PDF.js version:', pdfjs.version)
console.log('✅ PDFViewer: PDF.js build:', pdfjs.build)

interface PDFViewerProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  fileName: string
}

export function PDFViewer({ isOpen, onClose, filePath, fileName }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null)
  const [documentLoading, setDocumentLoading] = useState<boolean>(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)

  // Load PDF file when component mounts or filePath changes
  useEffect(() => {
    if (isOpen && filePath) {
      console.log('🔄 PDFViewer: Modal opened, loading file:', filePath)
      loadPdfFile()
    }
  }, [isOpen, filePath])

  const loadPdfFile = async () => {
    console.log('📄 PDFViewer: Starting to load PDF file')
    setLoading(true)
    setError(null)
    setPdfData(null)
    setNumPages(0)
    setPageNumber(1)
    
    try {
      console.log('📄 PDFViewer: Calling Electron API for file:', filePath)
      
      const result = await window.api?.fileSystem?.readPdfFile(filePath)
      console.log('📄 PDFViewer: Electron API result:', result)
      
      if (!result?.success) {
        throw new Error(result?.message || 'Failed to read PDF file')
      }
      
      if (!result.data || !Array.isArray(result.data)) {
        throw new Error('No PDF data received or invalid data format')
      }
      
      const uint8Array = new Uint8Array(result.data)
      console.log(`✅ PDFViewer: PDF data loaded: ${uint8Array.length} bytes`)
      
      // Verify it's actually a PDF by checking the first few bytes
      const header = Array.from(uint8Array.slice(0, 4)).map(b => String.fromCharCode(b)).join('')
      console.log('📄 PDFViewer: File header:', header)
      
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
      console.log('✅ PDFViewer: Created data URL (length:', dataUrl.length, ')')
      
    } catch (error) {
      console.error('❌ PDFViewer: Error loading PDF:', error)
      setError(error instanceof Error ? error.message : 'Failed to load PDF file')
      setLoading(false)
      setDocumentLoading(false)
    }
  }

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log(`✅ PDFViewer: PDF loaded successfully: ${numPages} pages`)
    setNumPages(numPages)
    setPageNumber(1)
    setDocumentLoading(false)
    setError(null)
  }, [])

  const onDocumentLoadError = useCallback((error: Error) => {
    console.error('❌ PDFViewer: PDF load error:', error)
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
    console.log('🔄 PDFViewer: Closing modal')
    setPageNumber(1)
    setLoading(false)
    setDocumentLoading(false)
    setError(null)
    setPdfData(null)
    setNumPages(0)
    setPdfUrl(null)
    onClose()
  }, [onClose])

  // Debug logging
  useEffect(() => {
    console.log('🔍 PDFViewer: State update:', {
      loading,
      documentLoading,
      error,
      pdfData: pdfData ? `${pdfData.length} bytes` : null,
      numPages,
      pageNumber,
      isOpen
    })
  }, [loading, documentLoading, error, pdfData, numPages, pageNumber, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {fileName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* PDF Navigation */}
          <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/50 flex-shrink-0">
            <div className="flex items-center gap-2">
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
            </div>
          </div>

          {/* PDF Content */}
          <div className="flex-1 overflow-auto p-6 min-h-0">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Loading PDF file...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-2 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                  <h3 className="text-lg font-medium">Error Loading PDF</h3>
                  <p className="text-muted-foreground max-w-md">{error}</p>
                  <Button variant="outline" onClick={loadPdfFile}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && pdfUrl && (
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
                      width={Math.min(window.innerWidth * 0.8, 800)}
                      renderTextLayer={false}
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

            {!loading && !error && !pdfData && (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Preparing PDF viewer...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
} 