import { useState } from 'react'
import { AlertTriangle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DeleteConfirmDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (deleteFile: boolean) => void
  fileName: string
  isLoading?: boolean
}

export function DeleteConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  fileName, 
  isLoading = false 
}: DeleteConfirmDialogProps) {
  const [deleteFile, setDeleteFile] = useState(false)

  const handleConfirm = () => {
    onConfirm(deleteFile)
  }

  const handleClose = () => {
    setDeleteFile(false) // Reset state when closing
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Delete Document
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{fileName}</strong>? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex items-center space-x-2 py-4">
          <Button
            type="button"
            variant={deleteFile ? "default" : "outline"}
            size="sm"
            onClick={() => setDeleteFile(!deleteFile)}
            className="flex items-center gap-2"
          >
            <div className={`w-4 h-4 border-2 rounded ${deleteFile ? 'bg-primary border-primary' : 'border-muted-foreground'}`}>
              {deleteFile && <div className="w-2 h-2 bg-primary-foreground rounded-sm m-0.5" />}
            </div>
            Also delete the file from disk
          </Button>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleConfirm}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {isLoading ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
} 