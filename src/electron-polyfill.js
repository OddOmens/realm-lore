async function fetchElectronAPI(action, payload = {}) {
  const res = await fetch('/api/electron', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, payload })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Electron API Mock Error');
  }
  return data;
}

if (typeof window !== 'undefined' && !window.electronAPI) {
  window.electronAPI = {
    // Worlds
    listWorlds: async () => {
      const data = await fetchElectronAPI('worlds:list');
      return data;
    },
    createWorld: async (name) => {
      return fetchElectronAPI('worlds:create', { name });
    },
    openWorld: async () => {
      return fetchElectronAPI('worlds:open');
    },
    deleteWorld: async (name) => {
      return fetchElectronAPI('worlds:delete', { name });
    },

    // Filesystem
    fsRead: async (filePath) => {
      return fetchElectronAPI('fs:read', { filePath });
    },
    fsWrite: async (filePath, content) => {
      return fetchElectronAPI('fs:write', { filePath, content });
    },
    fsDelete: async (filePath) => {
      return fetchElectronAPI('fs:delete', { filePath });
    },

    // Trash
    trashList: async (world) => {
      return fetchElectronAPI('fs:trash:list', { world });
    },
    trashRestore: async (path) => {
      return fetchElectronAPI('fs:trash:restore', { path });
    },
    trashPurge: async (path) => {
      return fetchElectronAPI('fs:trash:purge', { path });
    },

    // Backup
    runBackup: async (opts) => {
      return fetchElectronAPI('backup:run', opts);
    },

    // Stamps
    stampsList: async () => {
      return fetchElectronAPI('stamps:list');
    },
    stampsImage: async (rel) => {
      return fetchElectronAPI('stamps:image', { rel });
    },

    // Map images
    readMapImage: async (filePath) => {
      return fetchElectronAPI('fs:readMapImage', { filePath });
    },

    // App info
    getPaths: async () => {
      return fetchElectronAPI('app:getPaths');
    },
    openWorldsFolder: () => {
      console.log('openWorldsFolder not supported in browser');
    },

    // App info push (one-shot event from main after load)
    onAppInfo: (cb) => {
      // Mocking first launch as false and returning the worlds path
      cb({ firstLaunch: false, worldsPath: 'Worlds' });
    },

    // Auto-updater events (stubbed out for browser)
    onUpdateAvailable: (cb) => {},
    onUpdateProgress: (cb) => {},
    onUpdateDownloaded: (cb) => {},
    installUpdate: () => {},

    // Plugins
    pluginsScan: async () => {
      return fetchElectronAPI('plugins:scan');
    },
    pluginsGetSettings: async () => {
      return fetchElectronAPI('plugins:getSettings');
    },
    pluginsSetEnabled: async (enabled) => {
      return fetchElectronAPI('plugins:getSettings'); // just return settings
    },
    pluginsSetPluginEnabled: async (id, enabled) => {
      return fetchElectronAPI('plugins:getSettings');
    },
    pluginsOpenDir: async () => {
      console.log('pluginsOpenDir not supported in browser');
    },
    pluginsGetPanels: async () => {
      return fetchElectronAPI('plugins:getPanels');
    },
    pluginsReadPanelFile: async (pluginDir, panelFile) => {
      return { source: '', filePath: '' };
    },
  };
}
