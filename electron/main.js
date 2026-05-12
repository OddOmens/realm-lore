import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import os from 'os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// ── Paths ─────────────────────────────────────────────────────────────────────
// userData keeps worlds next to the app in dev; in production it goes to the
// OS user-data directory so it survives app updates.
const dataRoot = isDev
  ? path.resolve(__dirname, '..')
  : app.getPath('userData');

const worldsDir   = path.join(dataRoot, 'Worlds');
const stampsRoot  = path.join(dataRoot, 'customStamps');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(worldsDir);
ensureDir(stampsRoot);

function expandPath(p) {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(1));
  return p;
}

// ── Window ────────────────────────────────────────────────────────────────────
let win;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 14 },
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
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
}

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── IPC handlers (replace every /api/* route from the Vite plugin) ────────────

// worlds/list
ipcMain.handle('worlds:list', () => {
  const files = fs.readdirSync(worldsDir);
  const worlds = files.filter(f =>
    !f.startsWith('.') && !f.startsWith('_') &&
    fs.statSync(path.join(worldsDir, f)).isDirectory()
  );
  const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];
  worlds.forEach(world => {
    required.forEach(folder => {
      ensureDir(path.join(worldsDir, world, folder));
    });
  });
  return { worlds };
});

// worlds/create
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

// worlds/delete
ipcMain.handle('worlds:delete', (_, { name }) => {
  const target = path.join(worldsDir, name);
  if (fs.existsSync(target) && target.startsWith(worldsDir)) {
    fs.rmSync(target, { recursive: true, force: true });
    return { success: true };
  }
  throw new Error('World not found');
});

// fs/read
ipcMain.handle('fs:read', (_, { filePath }) => {
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  if (fs.statSync(full).isDirectory()) {
    return { isDir: true, files: fs.readdirSync(full) };
  }
  return { isDir: false, content: fs.readFileSync(full, 'utf-8') };
});

// fs/write
ipcMain.handle('fs:write', (_, { filePath, content }) => {
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  ensureDir(path.dirname(full));
  if (fs.existsSync(full)) fs.copyFileSync(full, full + '.bak');
  const tmp = full + '.tmp';
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, full);
  return { success: true };
});

// fs/delete (soft-delete to trash)
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

// fs/trash/list
ipcMain.handle('fs:trash:list', (_, { world }) => {
  if (!world || world.includes('..') || world.includes('/') || world.includes('\\')) {
    throw new Error('Invalid world');
  }
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
      items.push({
        trashPath: `${world}/trash/${rel.replace(/\\/g, '/')}`,
        collection: segs[0] || '',
        id: name.replace(/\.md$/i, ''),
      });
    }
  }
  walk(trashRoot, '');
  return { items };
});

// fs/trash/restore
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

// fs/trash/purge
ipcMain.handle('fs:trash:purge', (_, { path: relPath }) => {
  const normalized = relPath.replace(/\\/g, '/');
  if (!normalized.includes('/trash/')) throw new Error('Not a trash path');
  const full = path.join(worldsDir, normalized);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return { success: true };
});

// backup
ipcMain.handle('backup:run', (_, { location, activeWorld, retentionDays }) => {
  if (!location) throw new Error('Missing backup location');
  if (!activeWorld) throw new Error('Missing active world');

  const sourceDir = path.join(worldsDir, activeWorld);
  if (!fs.existsSync(sourceDir)) throw new Error('World not found');

  const targetBase = path.resolve(dataRoot, expandPath(location));
  ensureDir(targetBase);

  const now    = new Date();
  const pad    = n => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
  const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

  const worldBackupRoot = path.join(targetBase, activeWorld);
  const dayDir          = path.join(worldBackupRoot, dateStr);
  const finalTarget     = path.join(dayDir, timeStr);
  ensureDir(dayDir);

  const SKIP_NAMES   = new Set(['.trash', '.DS_Store']);
  const SKIP_SUFFIX  = ['.bak', '.tmp'];
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
        if (full.startsWith(worldBackupRoot)) {
          fs.rmSync(full, { recursive: true, force: true });
          pruned++;
        }
      }
    }
  }

  return { success: true, path: finalTarget, date: dateStr, time: timeStr, pruned, timestamp: now.toISOString() };
});

// stamps/list
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

// stamps/image — returns base64 so the renderer can use it as a data URL
ipcMain.handle('stamps:image', (_, { rel }) => {
  const full = path.resolve(stampsRoot, rel);
  if (!full.startsWith(stampsRoot)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) throw new Error('Not found');
  const ext  = path.extname(full).toLowerCase();
  const mime = ext === '.svg' ? 'image/svg+xml'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : 'image/png';
  const data = fs.readFileSync(full).toString('base64');
  return { dataUrl: `data:${mime};base64,${data}` };
});

// map image read (used by useWorldStore for .img files)
ipcMain.handle('fs:readMapImage', (_, { filePath }) => {
  const full = path.join(worldsDir, filePath);
  if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  const data = fs.readFileSync(full).toString('base64');
  return { base64: data };
});
