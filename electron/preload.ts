import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

console.log('🔌 Preload script starting...')

// Custom APIs for renderer
const api = {
  backend: {
    start: () => ipcRenderer.invoke('start-backend'),
    stop: () => ipcRenderer.invoke('stop-backend')
  },
  fileSystem: {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    importFolder: (filePaths: string[]) => ipcRenderer.invoke('import-folder', filePaths)
  }
}

console.log('🔌 Setting up context bridge...')

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
    console.log('✅ Context bridge setup completed successfully')
  } catch (error) {
    console.error('❌ Context bridge setup failed:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
  console.log('✅ APIs exposed to window (context isolation disabled)')
}

console.log('🔌 Preload script completed') 