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
  HardDrive
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu'
import { getFileTree, getFilesInFolder, FileTreeNode, FileListItem } from '@/lib/api'

interface FileExplorerProps {
  onViewFile?: (filePath: string, fileName: string, fileType: string) => void
  onImportFile?: (filePath: string) => void
  className?: string
}

export function FileExplorer({ onViewFile, onImportFile, className }: FileExplorerProps) {
  const [rootPath, setRootPath] = useState<string | null>(null)
  const [fileTree, setFileTree] = useState<FileTreeNode | null>(null)
  const [currentFolder, setCurrentFolder] = useState<string | null>(null)
  const [filesInCurrentFolder, setFilesInCurrentFolder] = useState<FileListItem[]>([])
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load root path from localStorage on mount
  useEffect(() => {
    const savedRootPath = localStorage.getItem('sortseek_root_path')
    if (savedRootPath) {
      setRootPath(savedRootPath)
      loadFileTree(savedRootPath)
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
    if (onViewFile) {
      onViewFile(file.path, file.name, file.type)
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
        return <File className="h-4 w-4 text-gray-500" />
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

  const renderTreeNode = (node: FileTreeNode, depth: number = 0) => {
    const isExpanded = expandedFolders.has(node.path)
    const hasChildren = node.children && node.children.length > 0
    
    return (
      <div key={node.path}>
        <div 
          className={`flex items-center space-x-2 px-2 py-1 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer ${
            currentFolder === node.path ? 'bg-accent text-accent-foreground' : ''
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
              className="p-0.5 hover:bg-background rounded"
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
          <div className="flex items-center justify-between">
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
          <p className="text-sm text-muted-foreground mt-1 truncate" title={rootPath}>
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
        <div className="p-4 border-b">
          <h3 className="font-medium">
            {currentFolder ? (
              <span className="truncate" title={currentFolder}>
                {currentFolder.split('\\').pop() || currentFolder.split('/').pop() || currentFolder}
              </span>
            ) : (
              'Select a folder'
            )}
          </h3>
          {currentFolder && (
            <p className="text-sm text-muted-foreground mt-1 truncate" title={currentFolder}>
              {currentFolder}
            </p>
          )}
        </div>
        
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
          ) : filesInCurrentFolder.length === 0 ? (
            <div className="text-center py-8">
              <Folder className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No files in this folder</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filesInCurrentFolder.map((file) => (
                <Card key={file.path} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        {getFileIcon(file.type, file.is_file)}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate" title={file.name}>
                            {file.name}
                          </p>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="secondary" className="text-xs">
                              {file.type.toUpperCase()}
                            </Badge>
                            {file.is_file && (
                              <span className="text-xs text-muted-foreground">
                                {formatFileSize(file.size)}
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
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {file.is_file && onViewFile && (
                            <DropdownMenuItem onClick={() => handleFileClick(file)}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                          )}
                          {file.is_file && onImportFile && (
                            <DropdownMenuItem onClick={() => onImportFile(file.path)}>
                              <FolderOpen className="mr-2 h-4 w-4" />
                              Import
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
} 