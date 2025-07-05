import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { existsSync, readdirSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
// import icon from '../../resources/icon.png?asset'

console.log('🚀 Electron main process starting...')

// Disable GPU hardware acceleration to prevent GPU process errors
app.disableHardwareAcceleration()

// Disable GPU cache to prevent "Access is denied" errors
app.commandLine.appendSwitch('disable-gpu-cache')
app.commandLine.appendSwitch('disable-gpu-sandbox')
app.commandLine.appendSwitch('disable-software-rasterizer')

// Add unhandled exception handlers
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error)
  app.quit()
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  app.quit()
})

function createWindow(): void {
  console.log('📱 Creating Electron window...')
  console.log('📂 Current working directory:', process.cwd())
  console.log('📂 __dirname:', __dirname)
  
  try {
    // Check if preload file exists
    const preloadPath = join(__dirname, 'preload.cjs')
    console.log('📍 Preload path:', preloadPath)
    console.log('📁 Preload file exists:', existsSync(preloadPath))
    
    if (!existsSync(preloadPath)) {
      console.error('❌ Preload file not found!')
      throw new Error(`Preload file not found at: ${preloadPath}`)
    }
    
    // Create the browser window.
    const mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      show: false,
      autoHideMenuBar: true,
      // ...(process.platform === 'linux' ? { icon } : {}), // Commented out until icon is available
      webPreferences: {
        preload: preloadPath,
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
        // Disable GPU acceleration for this window
        webSecurity: true,
        allowRunningInsecureContent: false
      }
    })

    console.log('✅ BrowserWindow created successfully')

    mainWindow.on('ready-to-show', () => {
      console.log('🎯 Window ready to show')
      mainWindow.show()
    })

    mainWindow.on('closed', () => {
      console.log('🔒 Window closed')
    })

    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
      console.error('❌ Failed to load URL:', validatedURL, 'Error:', errorCode, errorDescription)
    })

    mainWindow.webContents.on('did-finish-load', () => {
      console.log('✅ Window content loaded successfully')
    })

    mainWindow.webContents.setWindowOpenHandler((details) => {
      console.log('🔗 Opening external URL:', details.url)
      shell.openExternal(details.url)
      return { action: 'deny' }
    })

    // HMR for renderer base on electron-vite cli.
    // Load the remote URL for development or the local html file for production.
    console.log('🌐 Loading URL...')
    console.log('🔧 is.dev:', is.dev)
    console.log('🔧 ELECTRON_RENDERER_URL:', process.env['ELECTRON_RENDERER_URL'])
    
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      console.log('📡 Loading from ELECTRON_RENDERER_URL:', process.env['ELECTRON_RENDERER_URL'])
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else if (is.dev) {
      // Development mode - load from Vite dev server
      console.log('🚀 Loading from Vite dev server: http://localhost:5173')
      mainWindow.loadURL('http://localhost:5173')
    } else {
      // Production mode - load from built files
      const filePath = join(__dirname, '../dist/index.html')
      console.log('📦 Loading from production file:', filePath)
      mainWindow.loadFile(filePath)
    }

    console.log('✅ Window creation completed')
    
  } catch (error) {
    console.error('❌ Error creating window:', error)
    throw error
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
console.log('⏳ Waiting for app to be ready...')

app.whenReady().then(() => {
  console.log('✅ App is ready!')
  
  try {
    // Set app user model id for windows
    electronApp.setAppUserModelId('com.sortseek.app')
    console.log('🏷️ App user model ID set')

    // Default open or close DevTools by F12 in development
    // and ignore CommandOrControl + R in production.
    // see https://github.com/alex8088/quick-start/tree/master/packages/main-process#electron-devtools-installer
    if (is.dev && !process.env['ELECTRON_RENDERER_URL']) {
      console.log('🔧 Dev mode detected, DevTools available')
      // mainWindow.webContents.openDevTools()
    }

    console.log('🎬 Creating main window...')
    createWindow()
    console.log('✅ Main window creation initiated')

    app.on('activate', function () {
      console.log('🔄 App activated')
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (BrowserWindow.getAllWindows().length === 0) {
        console.log('🔄 Recreating window (no windows open)')
        createWindow()
      }
    })
    
    console.log('✅ App.whenReady() completed successfully')
    
  } catch (error) {
    console.error('❌ Error in app.whenReady():', error)
    throw error
  }
}).catch((error) => {
  console.error('❌ App.whenReady() failed:', error)
  app.quit()
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  console.log('🚪 All windows closed')
  if (process.platform !== 'darwin') {
    console.log('🔄 Quitting app (not macOS)')
    app.quit()
  }
})

// Handle GPU process crashes gracefully
app.on('gpu-process-crashed', (event, killed) => {
  console.log('💥 GPU process crashed:', { killed })
})

app.on('render-process-gone', (event, webContents, details) => {
  console.log('💥 Render process gone:', details.reason)
})

app.on('child-process-gone', (event, details) => {
  console.log('💥 Child process gone:', details.type, details.reason)
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

// IPC handlers for backend communication
ipcMain.handle('start-backend', async () => {
  // This will be implemented to start the Python backend
  console.log('🐍 Starting Python backend...')
  return { success: true }
})

ipcMain.handle('stop-backend', async () => {
  // This will be implemented to stop the Python backend
  console.log('🐍 Stopping Python backend...')
  return { success: true }
})

// IPC handlers for file system operations
ipcMain.handle('select-folder', async () => {
  try {
    console.log('📁 Opening folder selection dialog...')
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select folder to import'
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const folderPath = result.filePaths[0]
      console.log('📁 Selected folder:', folderPath)
      
      // Scan for PDF files in the selected folder
      const pdfFiles = scanForPdfFiles(folderPath)
      console.log(`📄 Found ${pdfFiles.length} PDF files`)
      
      return {
        success: true,
        folderPath,
        filePaths: pdfFiles
      }
    } else {
      console.log('📁 Folder selection cancelled')
      return {
        success: false,
        message: 'No folder selected'
      }
    }
  } catch (error) {
    console.error('❌ Error selecting folder:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

ipcMain.handle('import-folder', async (event, filePaths: string[]) => {
  try {
    console.log('📤 Importing folder with file paths:', filePaths)
    
    // Send file paths to backend via HTTP
    const response = await fetch('http://localhost:8000/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filePaths }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    console.log('✅ Import result:', result)
    
    return result
  } catch (error) {
    console.error('❌ Error importing folder:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error'
    }
  }
})

// Helper function to scan for PDF files in a folder
function scanForPdfFiles(folderPath: string): string[] {
  try {
    const files = readdirSync(folderPath)
    const pdfFiles = files
      .filter(file => file.toLowerCase().endsWith('.pdf'))
      .map(file => join(folderPath, file))
    
    return pdfFiles
  } catch (error) {
    console.error('❌ Error scanning folder:', error)
    return []
  }
}

console.log('🎯 Main process setup completed') 