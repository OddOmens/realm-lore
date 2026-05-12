import { contextBridge, ipcRenderer } from 'electron';

// Expose a safe API to the renderer under window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Worlds
  listWorlds:   ()           => ipcRenderer.invoke('worlds:list'),
  createWorld:  (name)       => ipcRenderer.invoke('worlds:create', { name }),
  deleteWorld:  (name)       => ipcRenderer.invoke('worlds:delete', { name }),

  // Filesystem
  fsRead:       (filePath)            => ipcRenderer.invoke('fs:read',  { filePath }),
  fsWrite:      (filePath, content)   => ipcRenderer.invoke('fs:write', { filePath, content }),
  fsDelete:     (filePath)            => ipcRenderer.invoke('fs:delete', { filePath }),

  // Trash
  trashList:    (world)      => ipcRenderer.invoke('fs:trash:list',    { world }),
  trashRestore: (path)       => ipcRenderer.invoke('fs:trash:restore', { path }),
  trashPurge:   (path)       => ipcRenderer.invoke('fs:trash:purge',   { path }),

  // Backup
  runBackup:    (opts)       => ipcRenderer.invoke('backup:run', opts),

  // Stamps
  stampsList:   ()           => ipcRenderer.invoke('stamps:list'),
  stampsImage:  (rel)        => ipcRenderer.invoke('stamps:image', { rel }),

  // Map images
  readMapImage: (filePath)   => ipcRenderer.invoke('fs:readMapImage', { filePath }),
});
