import React, { useState, useEffect, useCallback } from 'react'
import { FileText, AlertCircle, Loader2, Sparkles, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
// import { SummarizationModal } from '@/components/SummarizationModal' // Removed
import * as mammoth from 'mammoth'

interface TextViewerProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  fileName: string
  fileType: string
  content?: string
}

export function TextViewer({ isOpen, onClose, filePath, fileName, fileType, content }: TextViewerProps) {
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [renderedContent, setRenderedContent] = useState<string>('')
  // const [isSummarizationOpen, setIsSummarizationOpen] = useState(false) // Removed
  const [copied, setCopied] = useState(false)

  // Load content when component mounts or content changes
  useEffect(() => {
    if (isOpen) {
      console.log('🔄 TextViewer: Modal opened, processing content for:', fileName)
      processContent()
    }
  }, [isOpen, content, fileType])

  const processContent = async () => {
    setLoading(true)
    setError(null)
    setRenderedContent('')
    
    console.log('🔍 TextViewer processing:', { fileType, fileName, hasContent: !!content })
    
    try {
      if (fileType === '.txt') {
        // For TXT files, use the content directly
        if (!content) {
          throw new Error('No content available for this text file')
        }
        setRenderedContent(content)
        console.log('✅ TextViewer: TXT content processed')
             } else if (fileType === '.docx') {
         // For DOCX files, we'll display the extracted text
         // Note: For full DOCX formatting, we would need the raw file
         // and use mammoth.convertToHtml() on the client side
         if (!content) {
           throw new Error('No content available for this DOCX file')
         }
         
         setRenderedContent(content)
         console.log('✅ TextViewer: DOCX content processed (extracted text)')
       } else {
        console.warn(`TextViewer received unsupported file type: ${fileType}`)
        throw new Error(`Preview not supported for ${fileType.toUpperCase()} files. Please use the PDF viewer for PDF files.`)
      }
    } catch (error) {
      console.error('❌ TextViewer: Error processing content:', error)
      setError(error instanceof Error ? error.message : 'Failed to process content')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = useCallback(() => {
    console.log('🔄 TextViewer: Closing modal')
    setLoading(false)
    setError(null)
    setRenderedContent('')
    // setIsSummarizationOpen(false) // Removed
    setCopied(false)
    onClose()
  }, [onClose])

  // const handleSummarize = useCallback(() => {
  //   console.log('🔄 TextViewer: Opening summarization modal')
  //   setIsSummarizationOpen(true)
  // }, [])

  const handleCopyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(renderedContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy content:', error)
    }
  }, [renderedContent])

  // Debug logging
  useEffect(() => {
    console.log('🔍 TextViewer: State update:', {
      loading,
      error,
      contentLength: renderedContent.length,
      fileType,
      isOpen
    })
  }, [loading, error, renderedContent, fileType, isOpen])

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[95vh] w-[95vw] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {fileName}
            <span className="text-sm text-muted-foreground font-normal">
              ({fileType.toUpperCase()})
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0">
          {/* Text Navigation */}
          <div className="flex items-center justify-between px-6 py-2 border-b bg-muted/50 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {renderedContent.length} characters
              </span>
            </div>
            
            <div className="flex items-center gap-2">
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
              {/* Summarize button removed */}
            </div>
          </div>

          {/* Text Content */}
          <div className="flex-1 overflow-auto p-6 min-h-0">
            {loading && (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Processing {fileType.toUpperCase()} file...</span>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-2 text-center">
                  <AlertCircle className="h-12 w-12 text-red-500" />
                  <h3 className="text-lg font-medium">Error Loading {fileType.toUpperCase()}</h3>
                  <p className="text-muted-foreground max-w-md">{error}</p>
                  <Button variant="outline" onClick={processContent}>
                    Try Again
                  </Button>
                </div>
              </div>
            )}

            {!loading && !error && renderedContent && (
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
                ) : (
                  <div className="text-center py-8">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Preview Not Supported</h3>
                    <p className="text-muted-foreground">
                      Preview is not available for {fileType.toUpperCase()} files.
                    </p>
                  </div>
                )}
              </div>
            )}

            {!loading && !error && !renderedContent && (
              <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Preparing {fileType.toUpperCase()} viewer...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
      {/* SummarizationModal removed */}
    </Dialog>
  )
} 