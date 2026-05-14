import { app, BrowserWindow, ipcMain, shell, Menu, dialog } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pkg from 'electron-updater';
const { autoUpdater } = pkg;
import { loadPlugins, scanPlugins } from './pluginLoader.js';

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
const worldsDir  = path.join(dataRoot, 'Worlds');
const stampsRoot = path.join(dataRoot, 'customStamps');
const pluginsDir = path.join(dataRoot, 'plugins');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(worldsDir);
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
    worldsDir,
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
      worldsPath: worldsDir,
    });
  });

  buildMenu(win);
  setupUpdater(win);
}

app.whenReady().then(() => {
  createWindow();
  reloadPlugins().catch(console.error);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC: app info ─────────────────────────────────────────────────────────────
ipcMain.handle('app:getPaths', () => ({
  worlds: worldsDir,
  userData: app.getPath('userData'),
}));

ipcMain.handle('app:getVersion', () => app.getVersion());

ipcMain.on('app:openWorldsFolder', () => shell.openPath(worldsDir));

// ── IPC: filesystem ───────────────────────────────────────────────────────────

ipcMain.handle('worlds:list', () => {
  const files = fs.readdirSync(worldsDir);
  const worlds = files.filter(f =>
    !f.startsWith('.') && !f.startsWith('_') &&
    fs.statSync(path.join(worldsDir, f)).isDirectory()
  );
  const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];
  worlds.forEach(world => {
    required.forEach(folder => ensureDir(path.join(worldsDir, world, folder)));
  });
  return { worlds };
});

ipcMain.handle('worlds:create', (_, { name }) => {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = path.join(worldsDir, safeName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'].forEach(f => {
      ensureDir(path.join(dir, f));
    });
  }
  return { success: true, world: safeName };
});

ipcMain.handle('worlds:open', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open World Folder',
    defaultPath: worldsDir,
    properties: ['openDirectory', 'createDirectory'],
    buttonLabel: 'Open as World',
  });
  if (canceled || !filePaths.length) return { canceled: true };

  const chosen = filePaths[0];
  const worldName = path.basename(chosen);
  const dest = path.join(worldsDir, worldName);

  if (chosen === dest || chosen.startsWith(worldsDir + path.sep)) {
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
  const target = path.join(worldsDir, name);
  if (fs.existsSync(target) && target.startsWith(worldsDir)) {
    fs.rmSync(target, { recursive: true, force: true });
    return { success: true };
  }
  throw new Error('World not found');
});

ipcMain.handle('fs:read', (_, { filePath }) => {
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  if (fs.statSync(full).isDirectory()) return { isDir: true, files: fs.readdirSync(full) };
  return { isDir: false, content: fs.readFileSync(full, 'utf-8') };
});

ipcMain.handle('fs:write', async (_, { filePath, content }) => {
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  ensureDir(path.dirname(full));
  if (fs.existsSync(full)) fs.copyFileSync(full, full + '.bak');
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, full);

  // Fire onEntitySave hook — parse frontmatter for type/name to pass to plugins
  try {
    const parts = filePath.replace(/\\/g, '/').split('/');
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

ipcMain.handle('fs:delete', (_, { filePath }) => {
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return { success: true };

  const relNorm = path.relative(worldsDir, full).replace(/\\/g, '/');
  const parts = relNorm.split('/');
  if (parts.length < 3) throw new Error('Invalid trash path');

  const worldName = parts[0];
  const restPath  = parts.slice(1).join('/');
  const trashFull = path.join(worldsDir, worldName, 'trash', restPath);
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
  if (!world || world.includes('..') || world.includes('/') || world.includes('\\')) throw new Error('Invalid world');
  const trashRoot = path.join(worldsDir, world, 'trash');
  const items = [];
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel  = prefix ? `${prefix}/${name}` : name;
      if (fs.statSync(full).isDirectory()) { walk(full, rel); continue; }
      if (!name.endsWith('.md')) continue;
      const segs = rel.replace(/\\/g, '/').split('/');
      items.push({ trashPath: `${world}/trash/${rel.replace(/\\/g, '/')}`, collection: segs[0] || '', id: name.replace(/\.md$/i, '') });
    }
  }
  walk(trashRoot, '');
  return { items };
});

ipcMain.handle('fs:trash:restore', (_, { path: relPath }) => {
  const normalized = relPath.replace(/\\/g, '/');
  const idx = normalized.indexOf('/trash/');
  if (idx === -1) throw new Error('Not a trash path');
  const fullTrash = path.join(worldsDir, normalized);
  if (!fullTrash.startsWith(worldsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(fullTrash)) throw new Error('Trash entry not found');
  const restoredRel = normalized.slice(0, idx) + '/' + normalized.slice(idx + '/trash/'.length);
  const dest = path.join(worldsDir, restoredRel);
  if (!dest.startsWith(worldsDir)) throw new Error('Forbidden');
  if (fs.existsSync(dest)) throw new Error('A file already exists at the restore destination.');
  ensureDir(path.dirname(dest));
  fs.renameSync(fullTrash, dest);
  return { success: true, restoredPath: restoredRel };
});

ipcMain.handle('fs:trash:purge', (_, { path: relPath }) => {
  const normalized = relPath.replace(/\\/g, '/');
  if (!normalized.includes('/trash/')) throw new Error('Not a trash path');
  const full = path.join(worldsDir, normalized);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return { success: true };
});

ipcMain.handle('backup:run', (_, { location, activeWorld, retentionDays }) => {
  if (!location) throw new Error('Missing backup location');
  if (!activeWorld) throw new Error('Missing active world');
  const sourceDir = path.join(worldsDir, activeWorld);
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
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  return { base64: fs.readFileSync(full).toString('base64') };
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

