import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Loader2, Search, FileText, BookOpen, Sparkles } from 'lucide-react'
import { semanticSearch, SemanticSearchResult } from '@/lib/api'

interface SemanticSearchPanelProps {
  isOpen: boolean
  onClose: () => void
}

export function SemanticSearchPanel({ isOpen, onClose }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SemanticSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    setSearched(false)
    try {
      const res = await semanticSearch(query)
      setResults(res)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full p-0 flex flex-col">
        <DialogHeader className="p-6 pb-4 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Semantic Search
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSearch} className="flex items-center gap-2 px-6 pb-4">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your documents..."
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={loading || !query.trim()}>
            <Search className="h-4 w-4 mr-1" />
            Search
          </Button>
        </form>
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {loading && (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Searching...</span>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-red-500 font-medium mb-2">{error}</span>
              <Button variant="outline" onClick={handleSearch}>
                Try Again
              </Button>
            </div>
          )}
          {!loading && !error && searched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-muted-foreground">No results found.</span>
            </div>
          )}
          {!loading && !error && results.length > 0 && (
            <div className="space-y-4">
              {results.map((result, idx) => (
                <Card key={idx} className="shadow-sm">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="font-semibold text-sm">{result.filename}</span>
                      {typeof result.page === 'number' && (
                        <span className="ml-2 flex items-center text-xs text-muted-foreground">
                          <BookOpen className="h-3 w-3 mr-1" />
                          Page {result.page}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">Score: {result.score.toFixed(2)}</span>
                    </div>
                    <div className="text-sm text-foreground/90 line-clamp-4">
                      {result.content.length > 400
                        ? result.content.slice(0, 400) + '...'
                        : result.content}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 