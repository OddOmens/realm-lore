import { app, BrowserWindow, ipcMain, shell, Menu, dialog, protocol, net } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { exec } from 'child_process';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import AdmZip from 'adm-zip';
import { loadPlugins, scanPlugins } from './pluginLoader.js';
import { startServer, stopServer, getLocalIP } from './server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// ── Crash logger ──────────────────────────────────────────────────────────────
const crashLogFile = path.join(app.getPath('userData'), 'crash.log');

function writeCrashLog(type, err) {
  try {
    const line = `[${new Date().toISOString()}] ${type}: ${err?.stack || err}\n`;
    fs.appendFileSync(crashLogFile, line);
  } catch { /* never throw in a crash handler */ }
}

process.on('uncaughtException',  err => { writeCrashLog('uncaughtException',  err); });
process.on('unhandledRejection', err => { writeCrashLog('unhandledRejection', err); });

// ── Paths ─────────────────────────────────────────────────────────────────────
const dataRoot   = isDev ? path.resolve(__dirname, '..') : app.getPath('userData');
const appSettingsFile = path.join(app.getPath('userData'), 'app-settings.json');

function loadAppSettings() {
  try { return JSON.parse(fs.readFileSync(appSettingsFile, 'utf-8')); } catch { return { worldsDir: path.join(dataRoot, 'Worlds'), externalWorlds: [], serverEnabled: false }; }
}
function saveAppSettings(settings) {
  fs.writeFileSync(appSettingsFile, JSON.stringify(settings, null, 2));
}
let appSettings = loadAppSettings();

function getWorldsDir() {
  return appSettings.worldsDir || path.join(dataRoot, 'Worlds');
}
function getExternalWorlds() {
  return appSettings.externalWorlds || [];
}
function resolveWorldPath(worldName) {
  const ext = getExternalWorlds().find(w => w.name === worldName);
  if (ext) return ext.path;
  return path.join(getWorldsDir(), worldName);
}
function resolveFilePath(filePath) {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const rest = parts.slice(1);
  return path.join(resolveWorldPath(worldName), ...rest);
}
function isPathAllowed(full, worldName) {
  const root = resolveWorldPath(worldName);
  return full.startsWith(root);
}

const stampsRoot = path.join(dataRoot, 'customStamps');
const pluginsDir = path.join(dataRoot, 'plugins');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(getWorldsDir());
ensureDir(stampsRoot);
ensureDir(pluginsDir);

// ── Plugin state ──────────────────────────────────────────────────────────────
const pluginSettingsFile = path.join(app.getPath('userData'), 'plugin-settings.json');

function loadPluginSettings() {
  try { return JSON.parse(fs.readFileSync(pluginSettingsFile, 'utf-8')); } catch { return { enabled: true, enabledIds: [] }; }
}

function savePluginSettings(settings) {
  fs.writeFileSync(pluginSettingsFile, JSON.stringify(settings, null, 2));
}

let pluginSettings = loadPluginSettings();
let activePanels = [];  // panels registered by currently-loaded plugins

async function reloadPlugins() {
  const loaded = await loadPlugins({
    pluginsDir,
    worldsDir: getWorldsDir(),
    enabledIds: pluginSettings.enabledIds,
    pluginsEnabled: pluginSettings.enabled,
  });
  activePanels = loaded.flatMap(p => p.panels || []);
  return loaded;
}

function expandPath(p) {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(1));
  return p;
}

// ── Window state ──────────────────────────────────────────────────────────────
const winStateFile = path.join(app.getPath('userData'), 'window-state.json');

function loadWinState() {
  try { return JSON.parse(fs.readFileSync(winStateFile, 'utf-8')); } catch { return {}; }
}

function saveWinState(w) {
  if (w.isMaximized() || w.isMinimized()) return;
  fs.writeFileSync(winStateFile, JSON.stringify(w.getBounds()));
}

// ── First-launch flag ─────────────────────────────────────────────────────────
const firstLaunchFile = path.join(app.getPath('userData'), 'launched.json');
function isFirstLaunch() {
  if (fs.existsSync(firstLaunchFile)) return false;
  fs.writeFileSync(firstLaunchFile, JSON.stringify({ at: new Date().toISOString() }));
  return true;
}

// ── Auto-updater ──────────────────────────────────────────────────────────────
function setupUpdater(win) {
  if (isDev) return; // don't check for updates in dev

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Tell electron-updater where your GitHub repo is
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'OddOmens',
    repo: 'realm-lore',
  });

  autoUpdater.on('update-available', info => {
    win.webContents.send('updater:available', { version: info.version });
  });

  autoUpdater.on('download-progress', progress => {
    win.webContents.send('updater:progress', { percent: Math.round(progress.percent) });
  });

  autoUpdater.on('update-downloaded', info => {
    win.webContents.send('updater:downloaded', { version: info.version });
  });

  autoUpdater.on('error', err => {
    console.error('Auto-updater error:', err.message);
  });

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdates().catch(() => {});
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

ipcMain.on('updater:install', () => {
  autoUpdater.quitAndInstall();
});

// ── App menu ──────────────────────────────────────────────────────────────────
function buildMenu(win) {
  const isMac = process.platform === 'darwin';

  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        {
          label: 'About Realm Lore',
          click: () => showAbout(),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    }] : []),

    // File
    {
      label: 'File',
      submenu: [
        {
          label: 'Open Worlds Folder',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => shell.openPath(worldsDir),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },

    // Edit
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },

    // View
    {
      label: 'View',
      submenu: [
        ...(isDev ? [
          { role: 'reload' },
          { role: 'forceReload' },
          { role: 'toggleDevTools' },
          { type: 'separator' },
        ] : []),
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },

    // Window
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
        ] : []),
      ],
    },

    // Help
    {
      role: 'help',
      submenu: [
        {
          label: 'View on GitHub',
          click: () => shell.openExternal('https://github.com/OddOmens/realm-lore'),
        },
        {
          label: 'Report an Issue',
          click: () => shell.openExternal('https://github.com/OddOmens/realm-lore/issues'),
        },
        { type: 'separator' },
        {
          label: 'Open Worlds Folder',
          click: () => shell.openPath(worldsDir),
        },
        ...(!isMac ? [
          { type: 'separator' },
          { label: 'About Realm Lore', click: () => showAbout() },
        ] : []),
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── About window ──────────────────────────────────────────────────────────────
function showAbout() {
  dialog.showMessageBox({
    type: 'none',
    icon: path.join(__dirname, '../public/icon.icns'),
    title: 'About Realm Lore',
    message: 'Realm Lore',
    detail: [
      `Version ${app.getVersion()}`,
      '',
      'A local-first worldbuilding tool for writers and game masters.',
      'Your data lives on your machine as plain Markdown files.',
      '',
      '© 2025 OddOmens',
    ].join('\n'),
    buttons: ['OK', 'View on GitHub'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 1) shell.openExternal('https://github.com/OddOmens/realm-lore');
  });
}

// ── Window ────────────────────────────────────────────────────────────────────
let win;

function createWindow() {
  const saved = loadWinState();
  win = new BrowserWindow({
    width:  saved.width  || 1280,
    height: saved.height || 800,
    x: saved.x,
    y: saved.y,
    minWidth: 820,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5180');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', () => saveWinState(win));

  // Send first-launch and version info once the page is ready
  win.webContents.once('did-finish-load', () => {
    win.webContents.send('app:info', {
      version: app.getVersion(),
      firstLaunch: isFirstLaunch(),
      worldsPath: getWorldsDir(),
    });
  });

  buildMenu(win);
  setupUpdater(win);
}

app.whenReady().then(() => {
  protocol.handle('asset', (request) => {
    const urlStr = request.url.replace(/^asset:\/\//, '');
    const firstSlash = urlStr.indexOf('/');
    if (firstSlash === -1) return new Response('Bad Request', { status: 400 });
    const worldName = decodeURIComponent(urlStr.substring(0, firstSlash));
    const restPath = decodeURIComponent(urlStr.substring(firstSlash + 1));
    const worldRoot = resolveWorldPath(worldName);
    const fullPath = path.join(worldRoot, restPath);

    if (fullPath.endsWith('.img') && fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.startsWith('data:image/')) {
          const match = content.match(/^data:(image\/[^;]+);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const buffer = Buffer.from(match[2], 'base64');
            return new Response(buffer, { headers: { 'Content-Type': mimeType } });
          }
        }
      } catch (err) {
        console.error('Failed to parse .img file as asset', err);
      }
    }

    return net.fetch('file://' + fullPath);
  });

  createWindow();
  reloadPlugins().catch(console.error);
  if (appSettings.serverEnabled) {
    startServer(5181, {
      resolveFilePath, resolveWorldPath, getWorldsDir, getExternalWorlds, stampsRoot, pluginsDir,
      distDir: path.join(__dirname, '../dist')
    }).catch(console.error);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      exec(`pkill -P ${process.pid}`);
    } else if (process.platform === 'win32') {
      exec(`taskkill /F /T /PID ${process.pid}`);
    }
  } catch (e) {
    // Ignore errors during process cleanup
  }
});


// ── App Settings & Server IPC ─────────────────────────────────────────────────
ipcMain.handle('app:getSettings', () => appSettings);

ipcMain.handle('app:saveSettings', (_, settings) => {
  appSettings = settings;
  saveAppSettings(appSettings);
  return appSettings;
});

ipcMain.handle('server:start', async () => {
  try {
    await startServer(5181, {
      resolveFilePath,
      resolveWorldPath,
      getWorldsDir,
      getExternalWorlds,
      stampsRoot,
      pluginsDir,
      distDir: path.join(__dirname, '../dist'),
    });
    return { success: true, ip: getLocalIP(), port: 5181 };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:stop', () => {
  stopServer();
  return { success: true };
});

ipcMain.handle('server:status', () => {
  return { ip: getLocalIP(), port: 5181 };
});

// ── IPC: app info ─────────────────────────────────────────────────────────────
ipcMain.handle('app:getPaths', () => ({
  worlds: getWorldsDir(),
  userData: app.getPath('userData'),
}));

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.on('app:openWorldsFolder', () => shell.openPath(getWorldsDir()));

// ── IPC: filesystem ───────────────────────────────────────────────────────────

ipcMain.handle('worlds:list', () => {
  const masterDir = getWorldsDir();
  ensureDir(masterDir);
  const files = fs.readdirSync(masterDir);
  const masterWorlds = files.filter(f =>
    !f.startsWith('.') && !f.startsWith('_') &&
    fs.statSync(path.join(masterDir, f)).isDirectory()
  );
  const external = getExternalWorlds().map(w => w.name);
  const worlds = [...new Set([...masterWorlds, ...external])];
  const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps','assets'];
  worlds.forEach(world => {
    required.forEach(folder => ensureDir(path.join(resolveWorldPath(world), folder)));
  });
  return { worlds };
});

ipcMain.handle('worlds:create', (_, { name }) => {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = resolveWorldPath(safeName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps','assets'].forEach(f => {
      ensureDir(path.join(dir, f));
    });
  }
  return { success: true, world: safeName };
});
ipcMain.handle('worlds:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open World Folder',
    defaultPath: getWorldsDir(),
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Open as World',
  });
  if (canceled || !filePaths.length) return { canceled: true };

  const chosen = filePaths[0];
  const worldName = path.basename(chosen);
  const dest = path.join(getWorldsDir(), worldName);

  if (chosen === dest || chosen.startsWith(getWorldsDir() + path.sep)) {
    // Already inside worldsDir — just ensure sub-folders exist
    const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];
    required.forEach(f => ensureDir(path.join(dest, f)));
    return { success: true, world: worldName };
  }

  // External folder — copy it in
  if (fs.existsSync(dest)) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Overwrite'],
      defaultId: 0,
      cancelId: 0,
      title: 'World Already Exists',
      message: `A world named "${worldName}" already exists.`,
      detail: 'Do you want to overwrite it? This will replace all existing data in this world with the imported folder. This action cannot be undone.'
    });
    if (response !== 1) {
      return { canceled: true };
    }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  fs.cpSync(chosen, dest, { recursive: true });
  const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];
  required.forEach(f => ensureDir(path.join(dest, f)));
  return { success: true, world: worldName };
});

ipcMain.handle('worlds:delete', (_, { name }) => {
  const target = resolveWorldPath(name);
  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
    const exts = getExternalWorlds();
    if (exts.find(w => w.name === name)) {
      appSettings.externalWorlds = exts.filter(w => w.name !== name);
      saveAppSettings(appSettings);
    }
    return { success: true };
  }
  throw new Error('World not found');
});

ipcMain.handle('worlds:export', async (_, { name }) => {
  const target = resolveWorldPath(name);
  if (!fs.existsSync(target)) throw new Error('World not found');
  
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export World as ZIP',
    defaultPath: `${name}.zip`,
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }]
  });
  
  if (canceled || !filePath) return { canceled: true };
  
  try {
    const zip = new AdmZip();
    zip.addLocalFolder(target);
    zip.writeZip(filePath);
    return { success: true, filePath };
  } catch (err) {
    throw new Error('Failed to create ZIP archive: ' + err.message);
  }
});

ipcMain.handle('worlds:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import World from ZIP',
    defaultPath: app.getPath('desktop'),
    filters: [{ name: 'ZIP Archives', extensions: ['zip'] }],
    properties: ['openFile']
  });
  
  if (canceled || !filePaths.length) return { canceled: true };
  
  const zipPath = filePaths[0];
  const worldName = path.basename(zipPath, '.zip').replace(/[^a-zA-Z0-9_-]/g, '_');
  const dest = path.join(getWorldsDir(), worldName);
  
  if (fs.existsSync(dest)) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Cancel', 'Overwrite'],
      defaultId: 0,
      cancelId: 0,
      title: 'World Already Exists',
      message: `A world named "${worldName}" already exists.`,
      detail: 'Do you want to overwrite it? This will replace all existing data in this world with the imported ZIP. This action cannot be undone.'
    });
    if (response !== 1) {
      return { canceled: true };
    }
    fs.rmSync(dest, { recursive: true, force: true });
  }
  
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dest, true);
    
    // Ensure all required folders exist just in case
    const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];
    required.forEach(f => ensureDir(path.join(dest, f)));
    
    return { success: true, world: worldName };
  } catch (err) {
    // Clean up if it fails midway
    if (fs.existsSync(dest)) fs.rmSync(dest, { recursive: true, force: true });
    throw new Error('Failed to extract ZIP archive: ' + err.message);
  }
});



ipcMain.handle('fs:read', (_, { filePath }) => {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(filePath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  if (fs.statSync(full).isDirectory()) return { isDir: true, files: fs.readdirSync(full) };
  return { isDir: false, content: fs.readFileSync(full, 'utf-8') };
});

ipcMain.handle('fs:readDirContent', async (_, { dirPath, extension }) => {
  const parts = dirPath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(dirPath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  try { if (!(await fs.promises.stat(full)).isDirectory()) return []; } catch { return []; }

  let files = await fs.promises.readdir(full);
  if (extension) files = files.filter(f => f.endsWith(extension));

  const results = await Promise.all(files.map(async file => {
    const filePath = path.join(full, file);
    try {
      if ((await fs.promises.stat(filePath)).isDirectory()) return null;
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return { fileName: file, content };
    } catch { return null; }
  }));
  return results.filter(Boolean);
});

ipcMain.handle('fs:readDirIndex', async (_, { dirPath, extension }) => {
  const parts = dirPath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(dirPath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  try { if (!(await fs.promises.stat(full)).isDirectory()) return []; } catch { return []; }

  let files = await fs.promises.readdir(full);
  if (extension) files = files.filter(f => f.endsWith(extension));

  const results = await Promise.all(files.map(async file => {
    const filePath = path.join(full, file);
    try {
      if ((await fs.promises.stat(filePath)).isDirectory()) return null;
      const raw = await fs.promises.readFile(filePath, 'utf-8');
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      return { fileName: file, frontmatter: fmMatch ? fmMatch[1] : '' };
    } catch { return null; }
  }));
  return results.filter(Boolean);
});

ipcMain.handle('fs:write', async (_, { filePath, content }) => {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(filePath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  ensureDir(path.dirname(full));
  if (fs.existsSync(full)) fs.copyFileSync(full, full + '.bak');
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, full);

  try {
    if (parts.length >= 3) {
      const match = content.match(/^---\n([\s\S]*?)\n---/);
      const meta = {};
      if (match) {
        for (const line of match[1].split('\n')) {
          const idx = line.indexOf(':');
          if (idx === -1) continue;
          const k = line.slice(0, idx).trim();
          let v = line.slice(idx + 1).trim();
          try { v = JSON.parse(v); } catch { /* keep raw */ }
          meta[k] = v;
        }
      }
      callHook('onEntitySave', {
        type: parts[1],
        world: parts[0],
        name: meta.name || parts[2].replace('.md', ''),
        id: meta.id || parts[2].replace('.md', ''),
        ...meta,
      }).catch(() => {});
    }
  } catch { /* never block a save due to a plugin error */ }

  return { success: true };
});

ipcMain.handle('fs:writeBatch', async (_, { items }) => {
  // Validate all paths first before writing any files
  const resolved = items.map(({ filePath, content }) => {
    const parts = filePath.replace(/\\\\/g, '/').split('/');
    const worldName = parts[0];
    const full = resolveFilePath(filePath);
    if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
    return { full, content };
  });

  await Promise.all(resolved.map(async ({ full, content }) => {
    ensureDir(path.dirname(full));
    if (fs.existsSync(full)) fs.copyFileSync(full, full + '.bak');
    const tmp = full + '.tmp';
    await fs.promises.writeFile(tmp, content, 'utf-8');
    await fs.promises.rename(tmp, full);
  }));

  return { success: true };
});

ipcMain.handle('fs:delete', (_, { filePath }) => {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(filePath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return { success: true };

  const restPath = parts.slice(1).join('/');
  if (parts.length < 3) throw new Error('Invalid trash path');

  const trashFull = path.join(resolveWorldPath(worldName), 'trash', restPath);
  ensureDir(path.dirname(trashFull));

  let dest = trashFull;
  if (fs.existsSync(dest)) {
    dest = path.join(path.dirname(trashFull), `${Date.now()}_${path.basename(trashFull)}`);
  }
  fs.renameSync(full, dest);
  if (fs.existsSync(full + '.bak')) fs.unlinkSync(full + '.bak');
  return { success: true };
});

ipcMain.handle('fs:trash:list', (_, { world }) => {
  if (!world || world.includes('..') || world.includes('/') || world.includes('\\\\')) throw new Error('Invalid world');
  const trashRoot = path.join(resolveWorldPath(world), 'trash');
  const items = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel  = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) { walk(full, rel); continue; }
      if (!name.endsWith('.md')) continue;
      const segs = rel.replace(/\\\\/g, '/').split('/');
      items.push({ trashPath: `${world}/trash/${rel.replace(/\\\\/g, '/')}`, collection: segs[0] || '', id: name.replace(/\.md$/i, '') });
    }
  }
  walk(trashRoot, '');
  return { items };
});


ipcMain.handle('fs:trash:restore', (_, { path: relPath }) => {
  const normalized = relPath.replace(/\\\\/g, '/');
  const idx = normalized.indexOf('/trash/');
  if (idx === -1) throw new Error('Not a trash path');
  const worldName = normalized.slice(0, idx);
  const rest = normalized.slice(idx + '/trash/'.length);
  const fullTrash = path.join(resolveWorldPath(worldName), 'trash', rest);
  if (!isPathAllowed(fullTrash, worldName)) throw new Error('Forbidden');
  if (!fs.existsSync(fullTrash)) throw new Error('Trash entry not found');
  const dest = path.join(resolveWorldPath(worldName), rest);
  if (!isPathAllowed(dest, worldName)) throw new Error('Forbidden');
  if (fs.existsSync(dest)) throw new Error('A file already exists at the restore destination.');
  ensureDir(path.dirname(dest));
  fs.renameSync(fullTrash, dest);
  const restoredRel = worldName + '/' + rest;
  return { success: true, restoredPath: restoredRel };
});

ipcMain.handle('fs:trash:purge', (_, { path: relPath }) => {
  const normalized = relPath.replace(/\\\\/g, '/');
  if (!normalized.includes('/trash/')) throw new Error('Not a trash path');
  const parts = normalized.split('/');
  const worldName = parts[0];
  const full = resolveFilePath(normalized);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return { success: true };
});

ipcMain.handle('backup:run', (_, { location, activeWorld, retentionDays }) => {
  if (!location) throw new Error('Missing backup location');
  if (!activeWorld) throw new Error('Missing active world');
  const sourceDir = resolveWorldPath(activeWorld);
  if (!fs.existsSync(sourceDir)) throw new Error('World not found');
  const targetBase = path.resolve(dataRoot, expandPath(location));
  ensureDir(targetBase);
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const worldBackupRoot = path.join(targetBase, activeWorld);
  const dayDir = path.join(worldBackupRoot, dateStr);
  const finalTarget = path.join(dayDir, timeStr);
  ensureDir(dayDir);
  const SKIP_NAMES = new Set(['.trash', '.DS_Store']);
  const SKIP_SUFFIX = ['.bak', '.tmp'];
  fs.cpSync(sourceDir, finalTarget, {
    recursive: true,
    filter: src => {
      const name = path.basename(src);
      if (SKIP_NAMES.has(name)) return false;
      if (SKIP_SUFFIX.some(s => name.endsWith(s))) return false;
      return true;
    },
  });
  let pruned = 0;
  const days = Number(retentionDays) || 0;
  if (days > 0 && fs.existsSync(worldBackupRoot)) {
    const cutoff = new Date();
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setDate(cutoff.getDate() - days);
    for (const entry of fs.readdirSync(worldBackupRoot)) {
      const m = entry.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) continue;
      const folderDate = new Date(Number(m[1]), Number(m[2])-1, Number(m[3]));
      if (folderDate < cutoff) {
        const full = path.join(worldBackupRoot, entry);
        if (full.startsWith(worldBackupRoot)) { fs.rmSync(full, { recursive: true, force: true }); pruned++; }
      }
    }
  }
  return { success: true, path: finalTarget, date: dateStr, time: timeStr, pruned, timestamp: now.toISOString() };
});

ipcMain.handle('stamps:list', () => {
  const IMAGE_EXTS = new Set(['.png','.svg','.jpg','.jpeg','.webp']);
  const entries = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel  = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) { walk(full, rel); continue; }
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      const label = path.basename(name, ext).replace(/[_-]+/g, ' ').trim();
      entries.push({ rel, label, ext: ext.slice(1) });
    }
  }
  walk(stampsRoot, '');
  entries.sort((a, b) => a.label.localeCompare(b.label));
  return { stamps: entries };
});

ipcMain.handle('stamps:image', (_, { rel }) => {
  const full = path.resolve(stampsRoot, rel);
  if (!full.startsWith(stampsRoot)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) throw new Error('Not found');
  const ext  = path.extname(full).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return { dataUrl: `data:${mime};base64,${fs.readFileSync(full).toString('base64')}` };
});

ipcMain.handle('fs:readMapImage', (_, { filePath }) => {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(filePath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  return { base64: fs.readFileSync(full).toString('base64') };
});

// ── IPC: Assets ───────────────────────────────────────────────────────────────
ipcMain.handle('assets:list', (_, { world }) => {
  const worldRoot = resolveWorldPath(world);
  const assetsDir = path.join(worldRoot, 'assets');
  ensureDir(assetsDir);
  
  const IMAGE_EXTS = new Set(['.png','.svg','.jpg','.jpeg','.webp', '.gif']);
  const entries = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      if (name.startsWith('.')) continue;
      const full = path.join(dir, name);
      const rel  = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) { walk(full, rel); continue; }
      const ext = path.extname(name).toLowerCase();
      if (!IMAGE_EXTS.has(ext)) continue;
      entries.push({ rel, label: name, ext: ext.slice(1) });
    }
  }
  walk(assetsDir, '');
  entries.sort((a, b) => b.label.localeCompare(a.label)); // newest maybe? Sort alphabetically for now
  return { assets: entries };
});

ipcMain.handle('assets:import', async (_, { world }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Import Image Asset',
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] }],
    properties: ['openFile', 'multiSelections']
  });
  if (canceled || !filePaths.length) return { canceled: true };
  
  const worldRoot = resolveWorldPath(world);
  const assetsDir = path.join(worldRoot, 'assets');
  ensureDir(assetsDir);
  
  const imported = [];
  for (const p of filePaths) {
    let name = path.basename(p).replace(/[^a-zA-Z0-9.\-_]/g, '_');
    let dest = path.join(assetsDir, name);
    // deduplicate
    let counter = 1;
    while (fs.existsSync(dest)) {
      const ext = path.extname(name);
      const base = path.basename(name, ext);
      dest = path.join(assetsDir, `${base}-${counter}${ext}`);
      counter++;
    }
    fs.copyFileSync(p, dest);
    imported.push(path.basename(dest));
  }
  return { success: true, imported };
});

ipcMain.handle('assets:delete', (_, { world, assetPath }) => {
  const worldRoot = resolveWorldPath(world);
  const full = path.join(worldRoot, 'assets', assetPath);
  if (!isPathAllowed(full, world)) throw new Error('Forbidden');
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return { success: true };
});

// ── IPC: Export (PDF / EPUB) ──────────────────────────────────────────────────
ipcMain.handle('app:exportPdf', async (_, { title, htmlContent }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export to PDF',
    defaultPath: `${title || 'Export'}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  // Create a hidden window to render and print
  const printWin = new BrowserWindow({
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  
  // A simple HTML shell
  const htmlDoc = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Georgia', serif; font-size: 14px; line-height: 1.6; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; }
          h1, h2, h3 { font-family: 'Helvetica', sans-serif; color: #000; }
          img { max-width: 100%; height: auto; }
          pre, code { font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
          blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1em; color: #555; }
        </style>
      </head>
      <body>${htmlContent}</body>
    </html>
  `;
  
  await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlDoc)}`);
  
  try {
    const pdfBuffer = await printWin.webContents.printToPDF({
      printBackground: true,
      margin: { top: 1, bottom: 1, left: 1, right: 1 }
    });
    fs.writeFileSync(filePath, pdfBuffer);
    printWin.destroy();
    return { success: true, filePath };
  } catch (err) {
    printWin.destroy();
    throw new Error('PDF export failed: ' + err.message);
  }
});

import Epub from 'epub-gen-memory';
ipcMain.handle('app:exportEpub', async (_, { title, author, chapters }) => {
  const { canceled, filePath } = await dialog.showSaveDialog(win, {
    title: 'Export to EPUB',
    defaultPath: `${title || 'Export'}.epub`,
    filters: [{ name: 'EPUB', extensions: ['epub'] }]
  });
  if (canceled || !filePath) return { canceled: true };

  try {
    // Generate EPUB buffer in memory
    const epubBuffer = await Epub({
      title: title || 'Realm Lore Export',
      author: author || 'Unknown',
      content: chapters.map(c => ({
        title: c.title,
        data: c.html
      }))
    });
    fs.writeFileSync(filePath, epubBuffer);
    return { success: true, filePath };
  } catch (err) {
    throw new Error('EPUB export failed: ' + err.message);
  }
});

// ── IPC: plugins ──────────────────────────────────────────────────────────────

ipcMain.handle('plugins:scan', () => {
  return { plugins: scanPlugins(pluginsDir), pluginsDir };
});

ipcMain.handle('plugins:getSettings', () => pluginSettings);

ipcMain.handle('plugins:setEnabled', async (_, { enabled }) => {
  pluginSettings = { ...pluginSettings, enabled };
  savePluginSettings(pluginSettings);
  await reloadPlugins();
  return pluginSettings;
});

ipcMain.handle('plugins:setPluginEnabled', async (_, { id, enabled }) => {
  const ids = new Set(pluginSettings.enabledIds);
  if (enabled) ids.add(id); else ids.delete(id);
  pluginSettings = { ...pluginSettings, enabledIds: [...ids] };
  savePluginSettings(pluginSettings);
  await reloadPlugins();
  return pluginSettings;
});

ipcMain.handle('plugins:openDir', () => {
  shell.openPath(pluginsDir);
  return { pluginsDir };
});

// Returns all registered UI panels from currently-loaded plugins
ipcMain.handle('plugins:getPanels', () => activePanels);

// Serve a plugin panel's JS source so the renderer can eval it
ipcMain.handle('plugins:readPanelFile', (_, { pluginDir, panelFile }) => {
  const full = path.resolve(pluginDir, panelFile);
  // Only allow reads from within the pluginsDir
  if (!full.startsWith(pluginsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) throw new Error('Panel file not found');
  return { source: fs.readFileSync(full, 'utf-8'), filePath: full };
});

