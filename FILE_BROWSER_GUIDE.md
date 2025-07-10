# SortSeek Enhanced File Browser Guide

## Overview

The SortSeek file browser has been redesigned to behave like a full file browser, allowing users to navigate their file system, view files directly, and use AI-powered features without requiring files to be indexed first.

## 🎯 Key Features

### 📁 Full File System Navigation
- **Root Folder Selection**: Choose any folder on your system as the root directory
- **Collapsible Folder Tree**: Navigate through subfolders with expand/collapse functionality
- **Breadcrumb Navigation**: Click on any part of the path to navigate directly
- **Back/Home Navigation**: Use arrow buttons to go back or return to root
- **File Search**: Search for files within the current folder

### 📄 Direct File Viewing
- **No Indexing Required**: View files directly from the filesystem
- **Supported Formats**: PDF, DOCX, TXT files
- **Integrated Viewer**: Opens files in a modal with full functionality
- **Content Extraction**: Automatically extracts text from DOCX files

### 🤖 AI-Powered Features
- **Document Summarization**: Generate AI summaries of entire documents
- **Selection Summarization**: Select text and get AI-powered TLDR
- **Clause-level Analysis**: Get summaries of specific text selections

## 🚀 How to Use

### 1. Setting Up the File Browser

1. **Select Root Folder**:
   - Click "Set Root Folder" in the file explorer
   - Choose any folder on your system (e.g., `C:/MyDocs`)
   - The folder tree will load automatically

2. **Navigate Folders**:
   - Use the left panel to browse the folder tree
   - Click on folders to expand/collapse them
   - Click on a folder to view its contents in the main panel

### 2. File Navigation

#### Breadcrumb Navigation
- Click on any part of the breadcrumb path to jump directly to that folder
- Use the back arrow (←) to go to the parent folder
- Use the home button (🏠) to return to the root folder
- Use the refresh button (🔄) to reload the current folder

#### File Search
- Type in the search box to filter files in the current folder
- Search is case-insensitive and matches file names
- Clear the search to see all files again

### 3. File Operations

#### Viewing Files
- Click on any supported file (PDF, DOCX, TXT) to open it
- Files open in a modal with full viewing capabilities
- No need to import files first - they're read directly from disk

#### File Actions (Right-click menu)
- **View**: Open file in the integrated viewer
- **Summarize**: Generate AI summary of the entire file
- **Import to Library**: Add file to the SortSeek document library
- **Copy Path**: Copy the file path to clipboard

### 4. AI Features

#### Document Summarization
1. Open any supported file
2. Click the "Summarize" button in the viewer
3. AI will generate page-by-page summaries
4. View summaries in the side panel

#### Selection Summarization
1. Select any text in a document
2. Click "Summarize Selection" button that appears
3. Get AI-powered TLDR of the selected text

## 🔧 Technical Details

### Backend Endpoints

#### File Tree Operations
- `GET /file-tree?base_path={path}` - Get folder tree structure
- `GET /files-in-folder?path={path}` - Get files in specific folder
- `GET /read-file-content?path={path}` - Read file content directly

#### File Content Reading
- **TXT Files**: Read directly as UTF-8 text
- **DOCX Files**: Extract text using python-docx
- **PDF Files**: Use existing PDF viewer (Electron API)

### Frontend Components

#### FileExplorer.tsx
- Main file browser component
- Handles folder navigation and file listing
- Manages breadcrumbs and search functionality

#### IntegratedDocumentViewer.tsx
- Enhanced to read files directly from filesystem
- Supports all AI features (summarization, selection analysis)
- Handles PDF, DOCX, and TXT files

### File Selection
- **Single Click**: Select a file
- **Ctrl/Cmd + Click**: Multi-select files
- **Selected files** are highlighted with a blue ring

## 🎨 UI Improvements

### Enhanced Layout
- **Left Panel**: Collapsible folder tree (1/3 width)
- **Right Panel**: File grid with search and navigation (2/3 width)
- **Responsive Grid**: Files display in 1-4 columns based on screen size

### Visual Enhancements
- **File Icons**: Different colors for different file types
- **File Cards**: Show name, type, size, and modification date
- **Loading States**: Spinners and progress indicators
- **Error Handling**: Clear error messages with retry options

### Navigation Features
- **Breadcrumbs**: Clickable path navigation
- **Action Buttons**: Back, Home, Refresh, Search
- **Status Indicators**: Loading states and error messages

## 🔒 Security & Performance

### Security
- File paths are validated and normalized
- Permission checks prevent access to unauthorized files
- No file content is stored permanently without user consent

### Performance
- Lazy loading of folder trees (max depth: 3 levels)
- Efficient file listing with pagination support
- Cached file tree structure for faster navigation

## 🐛 Troubleshooting

### Common Issues

1. **"Permission denied" errors**:
   - Check file/folder permissions
   - Try running as administrator if needed

2. **Files not loading**:
   - Verify file exists and is accessible
   - Check if file type is supported
   - Ensure backend is running

3. **Search not working**:
   - Clear search box and try again
   - Check if files are in the current folder

### Backend Requirements
- Python 3.8+
- Required packages: `fastapi`, `uvicorn`, `python-docx`
- Backend must be running on `http://localhost:8000`

## 🚀 Future Enhancements

### Planned Features
- **File Preview**: Thumbnail previews for images
- **Batch Operations**: Select multiple files for operations
- **File Filtering**: Filter by file type, size, date
- **Favorites**: Mark frequently used folders
- **Recent Files**: Quick access to recently viewed files

### Performance Improvements
- **Virtual Scrolling**: For large file lists
- **Background Indexing**: Optional file indexing for search
- **Caching**: Improved file content caching

## 📝 API Reference

### FileExplorer Props
```typescript
interface FileExplorerProps {
  onViewFile?: (filePath: string, fileName: string, fileType: string) => void
  onImportFile?: (filePath: string) => void
  className?: string
}
```

### File Operations
```typescript
// Read file content
const result = await readFileContent(filePath)

// Get file tree
const tree = await getFileTree(basePath)

// Get files in folder
const files = await getFilesInFolder(folderPath)
```

## 🎉 Getting Started

1. **Start the backend**:
   ```bash
   cd backend
   python main.py
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   ```

3. **Open the app** and navigate to the "Documents" tab

4. **Select a root folder** and start exploring!

---

The enhanced file browser provides a complete file management experience with AI-powered features, making it easy to navigate, view, and analyze documents without the complexity of traditional indexing systems. 