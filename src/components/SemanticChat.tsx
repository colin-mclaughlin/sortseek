import React, { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, Search, FileText, BookOpen, Sparkles, Send, Eye, ChevronDown, ChevronUp, Filter, Pencil, Check, X, Folder } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { semanticSearch, SemanticSearchResult, SemanticSearchFilters, API_BASE_URL, smartMove, applyMove } from '@/lib/api'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Configuration constants
const MIN_CONFIDENCE = 0.80

interface SemanticChatProps {
  className?: string
  onViewDocument?: (filePath: string, fileName: string, fileType: string, content?: string) => void
  onRenameSuccess?: () => void
}

interface ChatMessage {
  id: string
  query: string
  results: SemanticSearchResult[]
  timestamp: Date
}

function formatImportTime(isoString?: string): string {
  return isoString ? new Date(isoString).toLocaleString() : 'Unknown time';
}

export function SemanticChat({ className, onViewDocument, onRenameSuccess }: SemanticChatProps) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([])
  const [collapsedResults, setCollapsedResults] = useState<Set<string>>(new Set())
  const [fileTypeFilter, setFileTypeFilter] = useState<string>('all');
  const [folderFilter, setFolderFilter] = useState('');
  const [importTimeAfter, setImportTimeAfter] = useState('');
  const [importTimeBefore, setImportTimeBefore] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);

  // Add state for smart rename UI
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [suggestedName, setSuggestedName] = useState<string | null>(null);
  const [showRenameInput, setShowRenameInput] = useState(false);
  const [renameInput, setRenameInput] = useState('');
  const [renameSuccess, setRenameSuccess] = useState(false);
  const [renameTargetPath, setRenameTargetPath] = useState<string | null>(null);

  // Add state for smart move UI
  const [moveLoading, setMoveLoading] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [suggestedFolder, setSuggestedFolder] = useState<string | null>(null);
  const [showMoveInput, setShowMoveInput] = useState(false);
  const [moveInput, setMoveInput] = useState('');
  const [moveSuccess, setMoveSuccess] = useState(false);
  const [moveTargetPath, setMoveTargetPath] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!query.trim()) return
    
    const currentQuery = query.trim()
    setLoading(true)
    setError(null)
    
    try {
      const filters: SemanticSearchFilters = {};
      if (fileTypeFilter !== 'all') filters.filetype = fileTypeFilter;
      if (folderFilter.trim()) filters.folder = folderFilter.trim();
      if (importTimeAfter) filters.import_time_after = importTimeAfter;
      if (importTimeBefore) filters.import_time_before = importTimeBefore;
      const results = await semanticSearch(currentQuery, filters);
      
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        query: currentQuery,
        results,
        timestamp: new Date()
      }
      
      setChatHistory(prev => [...prev, newMessage])
      setQuery('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSearch()
    }
  }

  const handleViewDocument = (result: SemanticSearchResult) => {
    if (onViewDocument) {
      // Determine file type from filename
      const fileType = result.filename.toLowerCase().endsWith('.pdf') ? '.pdf' :
                      result.filename.toLowerCase().endsWith('.txt') ? '.txt' :
                      result.filename.toLowerCase().endsWith('.docx') ? '.docx' : '.txt'
      
      onViewDocument(result.file_path, result.filename, fileType)
    }
  }

  const toggleResultsCollapse = (messageId: string) => {
    setCollapsedResults(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  const handleSuggestRename = async (sourcePath: string) => {
    setRenameLoading(true);
    setRenameError(null);
    setRenameSuccess(false);
    setSuggestedName(null);
    setShowRenameInput(false);
    setRenameInput('');
    setRenameTargetPath(sourcePath);
    try {
      const response = await fetch(`${API_BASE_URL}/smart-rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: sourcePath })
      });
      const data = await response.json();
      if (response.ok && data.suggested_name) {
        setSuggestedName(data.suggested_name);
        setRenameInput(data.suggested_name);
        setShowRenameInput(true);
      } else {
        setRenameError(data.detail || 'Failed to get suggestion');
      }
    } catch (e) {
      setRenameError('Network error');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleApplyRename = async (sourcePath: string, currentFilename: string) => {
    if (!sourcePath || !renameInput) return;
    setRenameLoading(true);
    setRenameError(null);
    setRenameSuccess(false);
    try {
      const response = await fetch(`${API_BASE_URL}/apply-rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: sourcePath, new_name: renameInput })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setRenameSuccess(true);
        setShowRenameInput(false);
        setRenameTargetPath(null);
        // Update all chatHistory results in place
        setChatHistory(prevHistory => prevHistory.map(msg => ({
          ...msg,
          results: msg.results.map(result => {
            // Update if filename or source_path matches old values
            if (
              result.filename === currentFilename ||
              result.metadata?.source_path === data.old_path
            ) {
              return {
                ...result,
                filename: data.new_name,
                file_path: data.new_path,
                metadata: {
                  ...result.metadata,
                  source_path: data.new_path,
                  filetype: data.new_name.split('.').pop()?.toUpperCase() || result.metadata?.filetype
                }
              };
            }
            return result;
          })
        })));
        if (onRenameSuccess) onRenameSuccess();
        // Optionally show a toast or inline confirmation here
      } else {
        setRenameError(data.detail || 'Rename failed');
      }
    } catch (e) {
      setRenameError('Network error');
    } finally {
      setRenameLoading(false);
    }
  };

  const handleSuggestMove = async (sourcePath: string) => {
    setMoveLoading(true);
    setMoveError(null);
    setMoveSuccess(false);
    setSuggestedFolder(null);
    setShowMoveInput(false);
    setMoveInput('');
    setMoveTargetPath(sourcePath);
    try {
      const data = await smartMove(sourcePath);
      if (data.suggested_folder) {
        setSuggestedFolder(data.suggested_folder);
        setMoveInput(data.suggested_folder);
        setShowMoveInput(true);
      } else {
        setMoveError('Failed to get suggestion');
      }
    } catch (e) {
      setMoveError('Network error');
    } finally {
      setMoveLoading(false);
    }
  };

  const handleApplyMove = async (sourcePath: string, currentFilename: string) => {
    if (!sourcePath || !moveInput) return;
    setMoveLoading(true);
    setMoveError(null);
    setMoveSuccess(false);
    try {
      const data = await applyMove(sourcePath, moveInput);
      if (data.success) {
        setMoveSuccess(true);
        setShowMoveInput(false);
        setMoveTargetPath(null);
        // Update all chatHistory results in place
        setChatHistory(prevHistory => prevHistory.map(msg => ({
          ...msg,
          results: msg.results.map(result => {
            // Update if filename or source_path matches old values
            if (
              result.filename === currentFilename ||
              result.metadata?.source_path === data.old_path
            ) {
              return {
                ...result,
                file_path: data.new_path,
                metadata: {
                  ...result.metadata,
                  source_path: data.new_path
                }
              };
            }
            return result;
          })
        })));
        if (onRenameSuccess) onRenameSuccess(); // Reuse the same callback for refresh
        // Optionally show a toast or inline confirmation here
      } else {
        setMoveError('Move failed');
      }
    } catch (e) {
      setMoveError('Network error');
    } finally {
      setMoveLoading(false);
    }
  };

  const renderSearchResults = (message: ChatMessage) => {
    // Filter and sort results by confidence threshold
    const filteredResults = message.results
      .filter(result => result.score >= MIN_CONFIDENCE)
      .sort((a, b) => b.score - a.score)

    const bestMatch = filteredResults.length > 0 ? filteredResults[0] : null
    const otherResults = filteredResults.slice(1)
    const isCollapsed = collapsedResults.has(message.id)

    if (filteredResults.length === 0) {
      return (
        <div className="bg-muted rounded-lg px-4 py-3">
          <p className="text-muted-foreground text-sm mb-1">🤔 No strong matches found.</p>
          <p className="text-xs text-muted-foreground">Try rephrasing your question or highlighting specific text.</p>
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {/* Best Match */}
        {bestMatch && (
          <Card className="shadow-md border-2 border-yellow-200 bg-gradient-to-r from-yellow-50 to-orange-50">
            <CardContent className="py-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                  🏆 Best Match
                </div>
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">{bestMatch.filename}</span>
                {typeof bestMatch.page === 'number' && (
                  <span className="ml-2 flex items-center text-xs text-muted-foreground">
                    <BookOpen className="h-3 w-3 mr-1" />
                    Page {bestMatch.page}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">Score: {bestMatch.score.toFixed(2)}</span>
              </div>
              {/* Metadata block below filename/badge */}
              <div className="mt-2 text-sm text-muted-foreground break-words">
                📄 File type: {bestMatch.metadata?.filetype ?? 'Unknown'}<br />
                🕒 Imported: {formatImportTime(bestMatch.metadata?.import_time)}<br />
                📁 {bestMatch.metadata?.source_path ?? 'Unknown path'}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Suggest New Name"
                    onClick={() => {
                      if (bestMatch.metadata?.source_path) {
                        handleSuggestRename(bestMatch.metadata.source_path as string);
                      }
                    }}
                    disabled={renameLoading && renameTargetPath === bestMatch.metadata?.source_path}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Suggest New Name</span>
                  {renameLoading && renameTargetPath === bestMatch.metadata?.source_path && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                </div>
                {showRenameInput && renameTargetPath === bestMatch.metadata?.source_path && (
                  <div className="flex flex-col gap-2 mt-2">
                    <input
                      className="border rounded px-2 py-1 text-sm"
                      value={renameInput}
                      onChange={e => setRenameInput(e.target.value)}
                      disabled={renameLoading}
                      maxLength={80}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (bestMatch.metadata?.source_path) {
                            handleApplyRename(bestMatch.metadata.source_path as string, bestMatch.filename);
                          }
                        }}
                        disabled={renameLoading || !renameInput || renameInput === bestMatch.filename}
                      >
                        <Check className="h-4 w-4 mr-1" />Rename File
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowRenameInput(false); setRenameTargetPath(null); }}
                        disabled={renameLoading}
                      >
                        <X className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    </div>
                    {renameError && <div className="text-xs text-destructive">{renameError}</div>}
                    {renameSuccess && <div className="text-xs text-green-600">File renamed successfully!</div>}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Suggest Folder"
                    onClick={() => {
                      if (bestMatch.metadata?.source_path) {
                        handleSuggestMove(bestMatch.metadata.source_path as string);
                      }
                    }}
                    disabled={moveLoading && moveTargetPath === bestMatch.metadata?.source_path}
                  >
                    <Folder className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground">Suggest Folder</span>
                  {moveLoading && moveTargetPath === bestMatch.metadata?.source_path && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
                </div>
                {showMoveInput && moveTargetPath === bestMatch.metadata?.source_path && (
                  <div className="flex flex-col gap-2 mt-2">
                    <input
                      className="border rounded px-2 py-1 text-sm"
                      value={moveInput}
                      onChange={e => setMoveInput(e.target.value)}
                      disabled={moveLoading}
                      maxLength={30}
                      placeholder="Enter folder name"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          if (bestMatch.metadata?.source_path) {
                            handleApplyMove(bestMatch.metadata.source_path as string, bestMatch.filename);
                          }
                        }}
                        disabled={moveLoading || !moveInput}
                      >
                        <Check className="h-4 w-4 mr-1" />Move File
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => { setShowMoveInput(false); setMoveTargetPath(null); }}
                        disabled={moveLoading}
                      >
                        <X className="h-4 w-4 mr-1" />Cancel
                      </Button>
                    </div>
                    {moveError && <div className="text-xs text-destructive">{moveError}</div>}
                    {moveSuccess && <div className="text-xs text-green-600">File moved successfully!</div>}
                  </div>
                )}
              </div>
              <div className="text-sm text-foreground/90 leading-relaxed mb-3">
                {bestMatch.content.length > 400
                  ? bestMatch.content.slice(0, 400) + '...'
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
        )}

        {/* Other Results */}
        {otherResults.length > 0 && (
          <div className="space-y-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toggleResultsCollapse(message.id)}
              className="w-full justify-between p-2 h-auto text-left"
            >
              <span className="text-sm font-medium">Other Related Results ({otherResults.length})</span>
              {isCollapsed ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
            
            {!isCollapsed && (
              <div className="space-y-2">
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
                      {/* Metadata block below filename */}
                      <div className="mt-2 text-sm text-muted-foreground break-words">
                        📄 File type: {result.metadata?.filetype ?? 'Unknown'}<br />
                        🕒 Imported: {formatImportTime(result.metadata?.import_time)}<br />
                        📁 {result.metadata?.source_path ?? 'Unknown path'}
                      </div>
                      <div className="text-sm text-foreground/90 leading-relaxed mb-2">
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

        {/* Debug Info */}
        {message.results.length > 0 && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <span>Showing {filteredResults.length} of {message.results.length} results (threshold: {MIN_CONFIDENCE})</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col h-full ${className}`}> 
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {chatHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-semibold mb-2">Ask anything about your files</h2>
            <p className="text-muted-foreground max-w-md">
              Use natural language to search through your documents. Ask questions, find specific information, or explore your files.
            </p>
          </div>
        ) : (
          chatHistory.map((message) => (
            <div key={message.id} className="space-y-4">
              {/* User Query */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-2xl">
                  <p className="text-sm">{message.query}</p>
                </div>
              </div>
              
              {/* Search Results */}
              {renderSearchResults(message)}
            </div>
          ))
        )}
        
        {loading && (
          <div className="flex justify-end">
            <div className="bg-muted rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Searching...</span>
            </div>
          </div>
        )}
        
        {error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
            <p className="text-destructive text-sm">{error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setError(null)}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}
      </div>
      
      {/* Bottom Search Bar */}
      <div className="border-t bg-background p-4">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask anything about your files..."
              className="pr-10"
              disabled={loading}
            />
          </div>
          {/* Filter Button and Popover */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" size="icon" className="h-10 w-10" title="Filters">
                <Filter className="h-5 w-5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4 flex flex-col gap-3">
              <div className="font-semibold mb-2">Filters</div>
              <Select value={fileTypeFilter} onValueChange={setFileTypeFilter}>
                <SelectTrigger className="w-full h-10">
                  <SelectValue placeholder="All filetypes" />
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
                className="w-full"
                type="text"
              />
              <div className="flex gap-2">
                <input
                  type="date"
                  value={importTimeAfter}
                  onChange={e => setImportTimeAfter(e.target.value)}
                  className="border rounded px-2 py-1 text-sm h-10 w-full"
                  title="Imported after"
                />
                <input
                  type="date"
                  value={importTimeBefore}
                  onChange={e => setImportTimeBefore(e.target.value)}
                  className="border rounded px-2 py-1 text-sm h-10 w-full"
                  title="Imported before"
                />
              </div>
              <Button type="button" variant="secondary" onClick={() => { setFileTypeFilter('all'); setFolderFilter(''); setImportTimeAfter(''); setImportTimeBefore(''); }}>Clear Filters</Button>
            </PopoverContent>
          </Popover>
          <Button
            type="submit"
            size="icon"
            className="h-10 w-10"
            disabled={loading || !query.trim()}
            title="Search"
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground mt-2 text-center">
          Browse your files below or ask a question above
        </p>
      </div>
    </div>
  )
} 