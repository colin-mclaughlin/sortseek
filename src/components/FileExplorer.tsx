import React, { useState, useEffect } from 'react'
import { 
  Folder, 
  File, 
  ChevronRight, 
  ChevronDown, 
  FolderOpen, 
  FileText, 
  Image, 
  Video, 
  Music, 
  Archive,
  Eye, 
  Trash2, 
  MoreHorizontal,
  Calendar,
  HardDrive,
  ArrowLeft,
  Home,
  Search,
  RefreshCw,
  Download,
  Copy,
  Sparkles,
  AlertCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu'
import { getFileTree, getFilesInFolder, FileTreeNode, FileListItem } from '@/lib/api'

interface FileExplorerProps {
  onViewFile?: (filePath: string, fileName: string, fileType: string) => void
  onImportFile?: (filePath: string) => void
  className?: string
}

interface BreadcrumbItem {
  name: string
  path: string
}

export function FileExplorer({ onViewFile, onImportFile, className }: FileExplorerProps) {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [filesInCurrentFolder, setFilesInCurrentFolder] = useState<FileListItem[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())

  // Load root path from localStorage on mount
  useEffect(() => {
    const savedRootPath = localStorage.getItem('sortseek_root_path')
    if (savedRootPath) {
      setRootPath(savedRootPath)
      loadFileTree(savedRootPath)
      setCurrentFolder(savedRootPath)
      loadFilesInFolder(savedRootPath)
      updateBreadcrumbs(savedRootPath)
    }
  }, [])

  const handleSelectRootFolder = async () => {
    try {
      // @ts-ignore
      const result = await window.api?.fileSystem?.selectRootFolder()
      
      if (!result.success) {
        throw new Error(result.message || 'Failed to select root folder')
      }
      
      const selectedPath = result.rootPath
      setRootPath(selectedPath)
      localStorage.setItem('sortseek_root_path', selectedPath)
      await loadFileTree(selectedPath)
      setCurrentFolder(selectedPath)
      await loadFilesInFolder(selectedPath)
      updateBreadcrumbs(selectedPath)
      
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to select root folder')
      console.error('Error selecting root folder:', error)
    }
  }

  const loadFileTree = async (basePath: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await getFileTree(basePath)
      
      if (response.success && response.tree) {
        setFileTree(response.tree)
      } else {
        throw new Error(response.message || 'Failed to load file tree')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load file tree')
      console.error('Error loading file tree:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadFilesInFolder = async (folderPath: string) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await getFilesInFolder(folderPath)
      
      if (response.success) {
        setFilesInCurrentFolder(response.files)
        setCurrentFolder(folderPath)
        updateBreadcrumbs(folderPath)
      } else {
        throw new Error(response.message || 'Failed to load files')
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load files')
      console.error('Error loading files in folder:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const updateBreadcrumbs = (path: string) => {
    const pathParts = path.split(/[\\/]/).filter(Boolean)
    const breadcrumbItems: BreadcrumbItem[] = []
    
    let currentPath = ''
    pathParts.forEach((part, index) => {
      if (index === 0) {
        // Handle Windows drive letter
        currentPath = part + (pathParts.length > 1 ? '\\' : '')
      } else {
        currentPath += (currentPath.endsWith('\\') ? '' : '\\') + part
      }
      breadcrumbItems.push({
        name: part,
        path: currentPath
      })
    })
    
    setBreadcrumbs(breadcrumbItems)
  }

  const handleBreadcrumbClick = (path: string) => {
    loadFilesInFolder(path)
  }

  const handleGoBack = () => {
    if (currentFolder && breadcrumbs.length > 1) {
      const parentPath = breadcrumbs[breadcrumbs.length - 2].path
      loadFilesInFolder(parentPath)
    }
  }

  const handleGoHome = () => {
    if (rootPath) {
      loadFilesInFolder(rootPath)
    }
  }

  const toggleFolder = (folderPath: string) => {
    setExpandedFolders(prev => {
      const newSet = new Set(prev)
      if (newSet.has(folderPath)) {
        newSet.delete(folderPath)
      } else {
        newSet.add(folderPath)
      }
      return newSet
    })
  }

  const handleFolderClick = (folderPath: string) => {
    loadFilesInFolder(folderPath)
  }

  const handleFileClick = (file: FileListItem) => {
    if (onViewFile && isSupportedFile(file.type)) {
      onViewFile(file.path, file.name, file.type)
    }
  }

  const handleFileSelect = (filePath: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      // Multi-select
      setSelectedFiles(prev => {
        const newSet = new Set(prev)
        if (newSet.has(filePath)) {
          newSet.delete(filePath)
        } else {
          newSet.add(filePath)
        }
        return newSet
      })
    } else {
      // Single select
      setSelectedFiles(new Set([filePath]))
    }
  }

  const handleCardClick = (file: FileListItem, event: React.MouseEvent) => {
    // Handle file selection
    handleFileSelect(file.path, event)
    
    // If it's a folder, navigate to it
    if (!file.is_file) {
      handleFolderClick(file.path)
    }
    // If it's a supported file, open it
    else if (isSupportedFile(file.type)) {
      handleFileClick(file)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (error) {
      console.error('Failed to copy to clipboard:', error)
    }
  }

  const getFileIcon = (fileType: string, isFile: boolean) => {
    if (!isFile) {
      return <Folder className="h-4 w-4 text-blue-500" />
    }
    
    switch (fileType.toLowerCase()) {
      case '.pdf':
        return <FileText className="h-4 w-4 text-red-500" />
      case '.doc':
      case '.docx':
        return <FileText className="h-4 w-4 text-blue-500" />
      case '.txt':
        return <FileText className="h-4 w-4 text-gray-500" />
      case '.jpg':
      case '.jpeg':
      case '.png':
      case '.gif':
      case '.bmp':
        return <Image className="h-4 w-4 text-green-500" />
      case '.mp4':
      case '.avi':
      case '.mov':
      case '.wmv':
        return <Video className="h-4 w-4 text-purple-500" />
      case '.mp3':
      case '.wav':
      case '.flac':
        return <Music className="h-4 w-4 text-orange-500" />
      case '.zip':
      case '.rar':
      case '.7z':
        return <Archive className="h-4 w-4 text-yellow-500" />
      default:
        return <File className="h-4 w-4 text-gray-400" />
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const isSupportedFile = (fileType: string): boolean => {
    const supportedTypes = ['.pdf', '.docx', '.txt']
    return supportedTypes.includes(fileType.toLowerCase())
  }

  const filteredFiles = filesInCurrentFolder.filter(file => 
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const supportedFiles = filteredFiles.filter(file => file.is_file && isSupportedFile(file.type))
  const unsupportedFiles = filteredFiles.filter(file => file.is_file && !isSupportedFile(file.type))
  const folders = filteredFiles.filter(file => !file.is_file)

  const renderFileCard = (file: FileListItem) => {
    const isSelected = selectedFiles.has(file.path)
    const isSupported = isSupportedFile(file.type)
    const isFolder = !file.is_file
    
    return (
      <Card 
        key={file.path} 
        className={`group hover:shadow-lg transition-all duration-200 cursor-pointer ${
          isSelected ? 'ring-2 ring-primary bg-accent' : ''
        } ${!isSupported && file.is_file ? 'opacity-60' : ''}`}
        onClick={(e) => handleCardClick(file, e)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              {getFileIcon(file.type, file.is_file)}
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${!isSupported && file.is_file ? 'text-muted-foreground' : ''}`} title={file.name}>
                  {file.name}
                </p>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge 
                    variant={!isSupported && file.is_file ? "outline" : "secondary"} 
                    className={`text-xs ${!isSupported && file.is_file ? 'text-muted-foreground' : ''}`}
                  >
                    {file.type.toUpperCase()}
                  </Badge>
                  {file.is_file && (
                    <span className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </span>
                  )}
                  {!isSupported && file.is_file && (
                    <span className="text-xs text-muted-foreground">
                      Unsupported
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1 mt-1">
                  <Calendar className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {formatDate(file.modified)}
                  </span>
                </div>
              </div>
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {file.is_file && isSupported && onViewFile && (
                  <DropdownMenuItem onClick={() => handleFileClick(file)}>
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </DropdownMenuItem>
                )}
                {file.is_file && isSupported && (
                  <DropdownMenuItem onClick={() => handleFileClick(file)}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Summarize
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {file.is_file && onImportFile && (
                  <DropdownMenuItem onClick={() => onImportFile(file.path)}>
                    <Download className="mr-2 h-4 w-4" />
                    Import to Library
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => copyToClipboard(file.path)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Path
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderTreeNode = (node: FileTreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)
    const hasChildren = node.children && node.children.length > 0
    const isCurrentFolder = currentFolder === node.path
    
    return (
      <div key={node.path}>
        <div 
          className={`flex items-center space-x-2 px-2 py-1 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer transition-colors ${
            isCurrentFolder ? 'bg-accent text-accent-foreground font-medium' : ''
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => node.is_file ? handleFileClick(node as any) : handleFolderClick(node.path)}
        >
          {!node.is_file && hasChildren && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                toggleFolder(node.path)
              }}
              className="p-0.5 hover:bg-background rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
            </button>
          )}
          {!node.is_file && !hasChildren && (
            <div className="w-3 h-3" />
          )}
          {getFileIcon(node.type || '', node.is_file)}
          <span className="text-sm truncate">{node.name}</span>
        </div>
        
        {!node.is_file && isExpanded && hasChildren && (
          <div>
            {node.children.map(child => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    )
  }

  const renderEmptyState = () => {
    if (searchQuery) {
      return (
        <div className="text-center py-8">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">No files match your search</p>
        </div>
      )
    }

    if (folders.length === 0 && supportedFiles.length === 0 && unsupportedFiles.length === 0) {
      return (
        <div className="text-center py-8">
          <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground">This folder is empty.</p>
        </div>
      )
    }

    if (folders.length === 0 && supportedFiles.length === 0 && unsupportedFiles.length > 0) {
      return (
        <div className="text-center py-8">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground mb-2">No supported files here.</p>
          <p className="text-sm text-muted-foreground">Supported formats: .pdf, .docx, .txt</p>
        </div>
      )
    }

    return null
  }

  if (!rootPath) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <HardDrive className="h-5 w-5" />
            <span>File Explorer</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <FolderOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No root folder selected</h3>
            <p className="text-muted-foreground mb-4">
              Select a root folder to start browsing your file system
            </p>
            <Button onClick={handleSelectRootFolder}>
              <FolderOpen className="mr-2 h-4 w-4" />
              Set Root Folder
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={`flex h-full ${className}`}>
      {/* Left Panel - Folder Tree */}
      <div className="w-1/3 border-r bg-card">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium">Folder Tree</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSelectRootFolder}
            >
              <FolderOpen className="mr-2 h-4 w-4" />
              Change Root
            </Button>
          </div>
          <p className="text-sm text-muted-foreground truncate" title={rootPath}>
            Root: {rootPath}
          </p>
        </div>
        
        <div className="p-2 overflow-y-auto h-[calc(100vh-300px)]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-500">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => loadFileTree(rootPath)}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : fileTree ? (
            <div>
              {renderTreeNode(fileTree)}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No file tree available</p>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - File List */}
      <div className="flex-1 flex flex-col">
        {/* Header with breadcrumbs and actions */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoBack}
                disabled={breadcrumbs.length <= 1}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGoHome}
              >
                <Home className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => currentFolder && loadFilesInFolder(currentFolder)}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
            </div>
          </div>
          
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                <button
                  onClick={() => handleBreadcrumbClick(crumb.path)}
                  className={`hover:text-primary transition-colors ${
                    index === breadcrumbs.length - 1 ? 'text-foreground font-medium' : 'text-muted-foreground'
                  }`}
                >
                  {crumb.name}
                </button>
                {index < breadcrumbs.length - 1 && (
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* File List */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-sm text-red-500">{error}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => currentFolder && loadFilesInFolder(currentFolder)}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          ) : (
            <>
              {renderEmptyState()}
              {filteredFiles.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredFiles.map(renderFileCard)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
} 