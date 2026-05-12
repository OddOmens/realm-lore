import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Worlds
  listWorlds:   ()           => ipcRenderer.invoke('worlds:list'),
  createWorld:  (name)       => ipcRenderer.invoke('worlds:create', { name }),
  openWorld:    ()           => ipcRenderer.invoke('worlds:open'),
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

  // App info
  getPaths: ()               => ipcRenderer.invoke('app:getPaths'),
  openWorldsFolder: ()       => ipcRenderer.send('app:openWorldsFolder'),

  // App info push (one-shot event from main after load)
  onAppInfo: (cb) => {
    ipcRenderer.once('app:info', (_, data) => cb(data));
  },

  // Auto-updater events
  onUpdateAvailable:  (cb) => ipcRenderer.on('updater:available',  (_, d) => cb(d)),
  onUpdateProgress:   (cb) => ipcRenderer.on('updater:progress',   (_, d) => cb(d)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('updater:downloaded', (_, d) => cb(d)),
  installUpdate: ()        => ipcRenderer.send('updater:install'),

  // Plugins
  pluginsScan:            ()                       => ipcRenderer.invoke('plugins:scan'),
  pluginsGetSettings:     ()                       => ipcRenderer.invoke('plugins:getSettings'),
  pluginsSetEnabled:      (enabled)                => ipcRenderer.invoke('plugins:setEnabled',      { enabled }),
  pluginsSetPluginEnabled:(id, enabled)            => ipcRenderer.invoke('plugins:setPluginEnabled', { id, enabled }),
  pluginsOpenDir:         ()                       => ipcRenderer.invoke('plugins:openDir'),
  pluginsGetPanels:       ()                       => ipcRenderer.invoke('plugins:getPanels'),
  pluginsReadPanelFile:   (pluginDir, panelFile)   => ipcRenderer.invoke('plugins:readPanelFile', { pluginDir, panelFile }),
});
