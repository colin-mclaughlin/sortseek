# Tree Synchronization Features

## Overview

The enhanced FileExplorer now provides seamless synchronization between the left sidebar folder tree and the right panel file browser, with visual indicators for indexed content and smooth navigation experience.

## 🎯 Key Features

### 1. Auto-Expansion of Folder Tree
- **Automatic Expansion**: When navigating to any folder via the right panel, the corresponding path in the left sidebar tree automatically expands
- **Path Tracking**: The system tracks the full path and expands each folder in the hierarchy to ensure the current folder is visible
- **Smart Expansion**: Only expands the necessary folders, preserving user's manual expansion/collapse preferences for other branches

### 2. Active Folder Highlighting
- **Visual Feedback**: The currently active folder in the right panel is highlighted in the left sidebar tree
- **Consistent Styling**: Active folder uses accent background and medium font weight for clear identification
- **Real-time Updates**: Highlighting updates immediately when navigating between folders

### 3. Smooth Scrolling to Active Folder
- **Auto-scroll**: When the active folder changes, the sidebar automatically scrolls to bring it into view
- **Smooth Animation**: Uses smooth scrolling behavior for a polished user experience
- **Centered View**: The active folder is centered in the viewport when possible

### 4. Indexing Indicators
- **Brain Icon**: 🧠 icon appears next to indexed folders and files
- **Tooltip Information**: Hover over the brain icon to see "Indexed for AI search" tooltip
- **Visual Distinction**: Indexed items are visually distinguished from non-indexed content
- **Mock Data**: Currently uses mock indexed paths for demonstration (easily replaceable with real backend data)

### 5. Bidirectional Navigation
- **Left to Right**: Clicking folders in the sidebar updates the right panel
- **Right to Left**: Navigating via breadcrumbs, back/home buttons, or folder cards updates the sidebar
- **Consistent State**: Both panels always reflect the same current location

## 🔧 Technical Implementation

### State Management
```typescript
// Core state variables
const [currentFolder, setCurrentFolder] = useState<string | null>(null)
const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
const [indexedPaths] = useState<Set<string>>(new Set([...]))

// Refs for scrolling
const treeContainerRef = useRef<HTMLDivElement>(null)
const activeFolderRef = useRef<HTMLDivElement>(null)
```

### Auto-Expansion Logic
```typescript
const expandPathToFolder = (targetPath: string) => {
  if (!fileTree) return
  
  const pathParts = targetPath.split(/[\\/]/).filter(Boolean)
  const rootPart = pathParts[0] + (pathParts.length > 1 ? '\\' : '')
  
  let currentPath = rootPart
  const newExpandedFolders = new Set(expandedFolders)
  
  // Expand each folder in the path
  for (let i = 1; i < pathParts.length; i++) {
    currentPath += (currentPath.endsWith('\\') ? '' : '\\') + pathParts[i]
    newExpandedFolders.add(currentPath)
  }
  
  setExpandedFolders(newExpandedFolders)
}
```

### Scrolling to Active Folder
```typescript
useEffect(() => {
  if (activeFolderRef.current && treeContainerRef.current) {
    setTimeout(() => {
      activeFolderRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      })
    }, 100)
  }
}, [currentFolder])
```

### Indexing Detection
```typescript
const isIndexed = (path: string): boolean => {
  return indexedPaths.has(path)
}
```

## 🎨 Visual Enhancements

### Tree Node Rendering
- **Active State**: Current folder highlighted with accent background
- **Indexing Icon**: Brain icon for indexed items
- **Hover Effects**: Smooth transitions on hover
- **Consistent Spacing**: Proper indentation for nested levels

### File Card Rendering
- **Indexing Indicator**: Brain icon next to indexed files
- **Supported vs Unsupported**: Clear visual distinction
- **Interactive Elements**: Hover states and click feedback

## 🧪 Testing Features

### Test Scenarios
1. **Deep Folder Navigation**: Navigate through 4+ levels of nested folders
2. **Tree Expansion**: Verify automatic expansion of folder paths
3. **Scrolling Behavior**: Test smooth scrolling to active folders
4. **Indexing Indicators**: Verify brain icons appear for indexed content
5. **Bidirectional Sync**: Test navigation from both left and right panels

### Test Commands
```bash
# Run the tree synchronization test
python test_tree_sync.py

# Start the backend server
cd backend && python main.py

# Start the frontend
npm run dev
```

## 🔄 Integration Points

### Backend API Endpoints
- `GET /file-tree?base_path={path}` - Get folder tree structure
- `GET /files-in-folder?path={path}` - Get files in specific folder
- `GET /read-file-content?path={path}` - Read file content for viewing

### Frontend Components
- `FileExplorer.tsx` - Main component with tree synchronization
- `IntegratedDocumentViewer.tsx` - File viewing component
- `api.ts` - API client functions

### Future Enhancements
- **Real Indexing Data**: Replace mock indexed paths with real backend metadata
- **Indexing Status API**: New endpoint to get indexing status for folders/files
- **Bulk Operations**: Select multiple items and check indexing status
- **Indexing Progress**: Show progress indicators for ongoing indexing operations

## 🚀 Usage Examples

### Basic Navigation
1. Select a root folder using "Set Root Folder"
2. Navigate by clicking folders in either panel
3. Observe automatic tree expansion and highlighting
4. Use breadcrumbs for quick navigation

### Advanced Features
1. **Search Filtering**: Use the search box to filter files
2. **Multi-selection**: Ctrl+click to select multiple files
3. **Context Menus**: Right-click for file actions
4. **Keyboard Navigation**: Use arrow keys and Enter for tree navigation

### Indexing Workflow
1. Navigate to a folder containing documents
2. Look for brain icons indicating indexed content
3. Use "Import to Library" to index new documents
4. Observe brain icons appear after indexing

## 🐛 Troubleshooting

### Common Issues
1. **Tree Not Expanding**: Check if the folder path exists in the tree structure
2. **Scrolling Not Working**: Verify the active folder ref is properly set
3. **Indexing Icons Missing**: Check if the path is in the indexedPaths set
4. **Performance Issues**: Large folder trees may need virtualization

### Debug Information
- Check browser console for JavaScript errors
- Verify API responses in Network tab
- Use React DevTools to inspect component state
- Check backend logs for server-side issues

## 📋 Configuration

### Mock Indexed Paths
```typescript
const [indexedPaths] = useState<Set<string>>(new Set([
  'C:\\Users\\Documents\\Work',
  'C:\\Users\\Documents\\Personal',
  'C:\\Users\\Downloads\\Important',
]))
```

### Styling Customization
- Modify CSS classes in the component for visual changes
- Adjust scroll behavior in the useEffect hook
- Customize indexing icon appearance

### Performance Tuning
- Adjust scroll timeout (currently 100ms)
- Optimize tree rendering for large structures
- Implement virtual scrolling for very large trees

## 🎯 Success Metrics

### User Experience
- ✅ Seamless navigation between panels
- ✅ Clear visual feedback for current location
- ✅ Smooth animations and transitions
- ✅ Intuitive indexing indicators

### Technical Performance
- ✅ Fast tree expansion and navigation
- ✅ Responsive scrolling behavior
- ✅ Consistent state synchronization
- ✅ Graceful error handling

### Accessibility
- ✅ Keyboard navigation support
- ✅ Screen reader friendly
- ✅ High contrast visual indicators
- ✅ Clear focus management 