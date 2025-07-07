import React, { useState, useEffect } from 'react'
import { Loader2, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { summarizeDocument, SummarizeResponse, PageSummary } from '@/lib/api'

interface SummarizationModalProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  fileName: string
}

export function SummarizationModal({ isOpen, onClose, filePath, fileName }: SummarizationModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [summaries, setSummaries] = useState<PageSummary[]>([])
  const [totalPages, setTotalPages] = useState(0)

  useEffect(() => {
    if (isOpen && filePath) {
      generateSummaries()
    }
  }, [isOpen, filePath])

  const generateSummaries = async () => {
    setLoading(true)
    setError(null)
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
      
      console.log(`✅ Generated ${response.summaries.length} summaries`)
      
    } catch (error) {
      console.error('❌ Summarization failed:', error)
      setError(error instanceof Error ? error.message : 'Failed to generate summaries')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setLoading(false)
    setError(null)
    setSummaries([])
    setTotalPages(0)
    onClose()
  }

  const handleRetry = () => {
    generateSummaries()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[90vw] p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            AI Summaries - {fileName}
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col flex-1 min-h-0 p-6 pt-0">
          {loading && (
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

          {error && (
            <div className="flex flex-col items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertCircle className="h-12 w-12 text-red-500" />
                <div>
                  <h3 className="text-lg font-medium mb-2">Summarization Failed</h3>
                  <p className="text-muted-foreground max-w-md mb-4">{error}</p>
                  <Button onClick={handleRetry} variant="outline">
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {!loading && !error && summaries.length > 0 && (
            <div className="flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-sm text-muted-foreground">
                    Generated {summaries.length} summaries
                    {totalPages > summaries.length && ` (showing first ${summaries.length} of ${totalPages} pages)`}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={handleRetry}>
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

          {!loading && !error && summaries.length === 0 && (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <p className="text-muted-foreground">No summaries generated</p>
                <Button onClick={handleRetry} variant="outline" className="mt-2">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 