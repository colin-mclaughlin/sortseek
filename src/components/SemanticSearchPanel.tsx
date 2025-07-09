import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Search, FileText, BookOpen, Sparkles, Eye, ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { semanticSearch, SemanticSearchResult, SemanticSearchFilters } from '@/lib/api'

// Configuration constants
const MIN_CONFIDENCE = 0.80

interface SemanticSearchPanelProps {
  isOpen: boolean
  onClose: () => void
  onViewDocument?: (filePath: string, fileName: string, fileType: string, content?: string) => void
}

export function SemanticSearchPanel({ isOpen, onClose, onViewDocument }: SemanticSearchPanelProps) {
  const [query, setQuery] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all')
  const [results, setResults] = useState<SemanticSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)
  const [showOtherResults, setShowOtherResults] = useState(true)
  const [folderFilter, setFolderFilter] = useState('');
  const [importTimeAfter, setImportTimeAfter] = useState('');
  const [importTimeBefore, setImportTimeBefore] = useState('');

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResults([])
    setSearched(false)
    try {
      // Prepare filters
      const filters: SemanticSearchFilters = {}
      if (fileTypeFilter !== 'all') filters.filetype = fileTypeFilter;
      if (folderFilter.trim()) filters.folder = folderFilter.trim();
      if (importTimeAfter) filters.import_time_after = importTimeAfter;
      if (importTimeBefore) filters.import_time_before = importTimeBefore;
      const res = await semanticSearch(query, filters)
      setResults(res)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  // Filter and sort results by confidence threshold
  const filteredResults = results
    .filter(result => result.score >= MIN_CONFIDENCE)
    .sort((a, b) => b.score - a.score)

  const bestMatch = filteredResults.length > 0 ? filteredResults[0] : null
  const otherResults = filteredResults.slice(1)

  const handleViewDocument = (result: SemanticSearchResult) => {
    if (onViewDocument) {
      // Determine file type from filename
      const fileType = result.filename.toLowerCase().endsWith('.pdf') ? '.pdf' :
                      result.filename.toLowerCase().endsWith('.txt') ? '.txt' :
                      result.filename.toLowerCase().endsWith('.docx') ? '.docx' : '.txt'
      
      onViewDocument(result.file_path, result.filename, fileType)
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
        <div className="px-6 pb-2 text-2xl">🦄 RANDOM TEST EMOJI</div>
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-2 px-6 pb-4">
          {/* Filetype filter inside the search bar */}
          <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
            <SelectTrigger className="w-24 h-10 mr-2">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pdf">PDF</SelectItem>
              <SelectItem value="txt">TXT</SelectItem>
              <SelectItem value="docx">DOCX</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={folderFilter}
            onChange={e => setFolderFilter(e.target.value)}
            placeholder="Folder/path"
            className="w-32"
            type="text"
          />
          <input
            type="date"
            value={importTimeAfter}
            onChange={e => setImportTimeAfter(e.target.value)}
            className="border rounded px-2 py-1 text-sm h-10"
            title="Imported after"
            style={{ minWidth: 120 }}
          />
          <input
            type="date"
            value={importTimeBefore}
            onChange={e => setImportTimeBefore(e.target.value)}
            className="border rounded px-2 py-1 text-sm h-10"
            title="Imported before"
            style={{ minWidth: 120 }}
          />
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
          {!loading && !error && searched && filteredResults.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <span className="text-muted-foreground mb-2">🤔 No strong matches found.</span>
              <span className="text-sm text-muted-foreground">Try rephrasing your question or highlighting specific text.</span>
            </div>
          )}
          {!loading && !error && filteredResults.length > 0 && (
            <div className="space-y-4">
              {/* Best Match Section */}
              {bestMatch && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                      🏆 Best Match
                    </div>
                    <span className="text-sm text-muted-foreground">Score: {bestMatch.score.toFixed(2)}</span>
                  </div>
                  <Card className="shadow-md border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">{bestMatch.filename}</span>
                        {typeof bestMatch.page === 'number' && (
                          <span className="ml-2 flex items-center text-xs text-muted-foreground">
                            <BookOpen className="h-3 w-3 mr-1" />
                            Page {bestMatch.page}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground/90 leading-relaxed mb-3">
                        {bestMatch.content.length > 500
                          ? bestMatch.content.slice(0, 500) + '...'
                          : bestMatch.content}
                      </div>
                      <Button 
                        onClick={() => handleViewDocument(bestMatch)}
                        className="w-full"
                        size="sm"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Document
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Other Results Section */}
              {otherResults.length > 0 && (
                <div className="space-y-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowOtherResults(!showOtherResults)}
                    className="w-full justify-between p-2 h-auto"
                  >
                    <span className="text-sm font-medium">Other Related Results ({otherResults.length})</span>
                    {showOtherResults ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                  
                  {showOtherResults && (
                    <div className="space-y-3">
                      {otherResults.map((result, idx) => (
                        <Card key={idx} className="shadow-sm">
                          <CardContent className="py-3">
                            <div className="flex items-center gap-2 mb-1">
                              <FileText className="h-4 w-4 text-primary" />
                              <span className="font-medium text-sm">{result.filename}</span>
                              {typeof result.page === 'number' && (
                                <span className="ml-2 flex items-center text-xs text-muted-foreground">
                                  <BookOpen className="h-3 w-3 mr-1" />
                                  Page {result.page}
                                </span>
                              )}
                              <span className="ml-auto text-xs text-muted-foreground">Score: {result.score.toFixed(2)}</span>
                            </div>
                            <div className="text-sm text-foreground/90 line-clamp-3 mb-2">
                              {result.content.length > 300
                                ? result.content.slice(0, 300) + '...'
                                : result.content}
                            </div>
                            <Button 
                              onClick={() => handleViewDocument(result)}
                              variant="outline"
                              size="sm"
                              className="w-full"
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              View Document
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Debug Info (can be hidden in production) */}
              {results.length > 0 && (
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  <span>Showing {filteredResults.length} of {results.length} results (threshold: {MIN_CONFIDENCE})</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
} 