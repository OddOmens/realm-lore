import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Worlds
  listWorlds:   ()           => ipcRenderer.invoke('worlds:list'),
  createWorld:  (name)       => ipcRenderer.invoke('worlds:create', { name }),
  openWorld:    ()           => ipcRenderer.invoke('worlds:open'),
  exportWorld:  (name)       => ipcRenderer.invoke('worlds:export', { name }),
  importWorld:  ()           => ipcRenderer.invoke('worlds:import'),
  deleteWorld:  (name)       => ipcRenderer.invoke('worlds:delete', { name }),

  // Filesystem
  fsRead:       (filePath)            => ipcRenderer.invoke('fs:read',  { filePath }),
  fsReadDirContent: (dirPath, extension) => ipcRenderer.invoke('fs:readDirContent', { dirPath, extension }),
  fsReadDirIndex:   (dirPath, extension) => ipcRenderer.invoke('fs:readDirIndex',   { dirPath, extension }),
  fsWrite:      (filePath, content)   => ipcRenderer.invoke('fs:write', { filePath, content }),
  fsWriteBatch: (items)               => ipcRenderer.invoke('fs:writeBatch', { items }),
  fsDelete:     (filePath)            => ipcRenderer.invoke('fs:delete', { filePath }),

  // Trash
  trashList:    (world)      => ipcRenderer.invoke('fs:trash:list',    { world }),
  trashRestore: (path)       => ipcRenderer.invoke('fs:trash:restore', { path }),
  trashPurge:   (path)       => ipcRenderer.invoke('fs:trash:purge',   { path }),

  // Backup
  runBackup: (opts) => ipcRenderer.invoke('backup:run', opts),

  // Assets
  listAssets: (opts) => ipcRenderer.invoke('assets:list', opts),
  importAsset: (opts) => ipcRenderer.invoke('assets:import', opts),
  deleteAsset: (opts) => ipcRenderer.invoke('assets:delete', opts),

  // Export
  exportPdf: (opts) => ipcRenderer.invoke('app:exportPdf', opts),
  exportEpub: (opts) => ipcRenderer.invoke('app:exportEpub', opts),

  // Plugins
  stampsList:   ()           => ipcRenderer.invoke('stamps:list'),
  stampsImage:  (rel)        => ipcRenderer.invoke('stamps:image', { rel }),

  // Map images
  readMapImage: (filePath)   => ipcRenderer.invoke('fs:readMapImage', { filePath }),

  // App info & Settings
  getPaths: ()               => ipcRenderer.invoke('app:getPaths'),
  openWorldsFolder: ()       => ipcRenderer.send('app:openWorldsFolder'),
  getSettings: ()            => ipcRenderer.invoke('app:getSettings'),
  saveSettings: (settings)   => ipcRenderer.invoke('app:saveSettings', settings),

  // Server
  startServer: ()            => ipcRenderer.invoke('server:start'),
  stopServer: ()             => ipcRenderer.invoke('server:stop'),
  getServerStatus: ()        => ipcRenderer.invoke('server:status'),

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
