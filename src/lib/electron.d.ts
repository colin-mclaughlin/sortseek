declare global {
  interface Window {
    api: {
      backend: {
        start: () => Promise<{ success: boolean }>
        stop: () => Promise<{ success: boolean }>
      }
      fileSystem: {
        selectFolder: () => Promise<{
          success: boolean
          folderPath?: string
          filePaths?: string[]
          message?: string
        }>
        importFolder: (filePaths: string[]) => Promise<{
          success: boolean
          message?: string
          importedFiles?: string[]
          count?: number
        }>
        readPdfFile: (filePath: string) => Promise<{
          success: boolean
          data?: number[]
          message?: string
        }>
      }
    }
  }
}

export {} 