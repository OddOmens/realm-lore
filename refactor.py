import re
import sys

with open('electron/main.js', 'r') as f:
    code = f.read()

# 1. Imports and server
code = code.replace(
    "import { loadPlugins, scanPlugins } from './pluginLoader.js';",
    "import { loadPlugins, scanPlugins } from './pluginLoader.js';\nimport { startServer, stopServer, getLocalIP } from './server.js';"
)

# 2. Settings and Paths
repl_paths = """const dataRoot   = isDev ? path.resolve(__dirname, '..') : app.getPath('userData');
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
ensureDir(getWorldsDir());"""
repl_paths = repl_paths.replace('\\\\', '\\')
code = re.sub(
    r"const dataRoot.*?ensureDir\(worldsDir\);",
    lambda m: repl_paths,
    code,
    flags=re.DOTALL
)

# 3. reloadPlugins args
code = code.replace(
    "worldsDir,",
    "worldsDir: getWorldsDir(),"
)

# 4. IPC getPaths / openWorldsFolder
code = code.replace(
    "ipcMain.handle('app:getPaths', () => ({\n  worlds: worldsDir,",
    "ipcMain.handle('app:getPaths', () => ({\n  worlds: getWorldsDir(),"
)
code = code.replace(
    "ipcMain.on('app:openWorldsFolder', () => shell.openPath(worldsDir));",
    "ipcMain.on('app:openWorldsFolder', () => shell.openPath(getWorldsDir()));"
)

# 5. worlds:list
repl_worlds_list = """ipcMain.handle('worlds:list', () => {
  const masterDir = getWorldsDir();
  ensureDir(masterDir);
  const files = fs.readdirSync(masterDir);
  const masterWorlds = files.filter(f =>
    !f.startsWith('.') && !f.startsWith('_') &&
    fs.statSync(path.join(masterDir, f)).isDirectory()
  );
  const external = getExternalWorlds().map(w => w.name);
  const worlds = [...new Set([...masterWorlds, ...external])];
  const required = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];
  worlds.forEach(world => {
    required.forEach(folder => ensureDir(path.join(resolveWorldPath(world), folder)));
  });
  return { worlds };
});"""
code = re.sub(r"ipcMain\.handle\('worlds:list'.*?\}\);", lambda m: repl_worlds_list, code, flags=re.DOTALL)

# 6. worlds:create
repl_worlds_create = """ipcMain.handle('worlds:create', (_, { name }) => {
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const dir = resolveWorldPath(safeName);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'].forEach(f => {
      ensureDir(path.join(dir, f));
    });
  }
  return { success: true, world: safeName };
});"""
code = re.sub(r"ipcMain\.handle\('worlds:create'.*?\}\);", lambda m: repl_worlds_create, code, flags=re.DOTALL)

# 7. worlds:open
code = code.replace("defaultPath: worldsDir,", "defaultPath: getWorldsDir(),")
code = code.replace("const dest = path.join(worldsDir, worldName);", "const dest = path.join(getWorldsDir(), worldName);")
code = code.replace("if (chosen === dest || chosen.startsWith(worldsDir + path.sep)) {", "if (chosen === dest || chosen.startsWith(getWorldsDir() + path.sep)) {")

# 8. worlds:delete
repl_worlds_delete = """ipcMain.handle('worlds:delete', (_, { name }) => {
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
});"""
code = re.sub(r"ipcMain\.handle\('worlds:delete'.*?\}\);", lambda m: repl_worlds_delete, code, flags=re.DOTALL)

# 9. fs:read
repl_fs_read = """ipcMain.handle('fs:read', (_, { filePath }) => {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(filePath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  if (fs.statSync(full).isDirectory()) return { isDir: true, files: fs.readdirSync(full) };
  return { isDir: false, content: fs.readFileSync(full, 'utf-8') };
});"""
code = re.sub(r"ipcMain\.handle\('fs:read'.*?\}\);", lambda m: repl_fs_read.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 10. fs:write
repl_fs_write = """ipcMain.handle('fs:write', async (_, { filePath, content }) => {
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
      const match = content.match(/^---\\n([\\s\\S]*?)\\n---/);
      const meta = {};
      if (match) {
        for (const line of match[1].split('\\n')) {
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
});"""
code = re.sub(r"ipcMain\.handle\('fs:write'.*?return \{ success: true \};\n\}\);", lambda m: repl_fs_write.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 11. fs:delete
repl_fs_delete = """ipcMain.handle('fs:delete', (_, { filePath }) => {
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
});"""
code = re.sub(r"ipcMain\.handle\('fs:delete'.*?\}\);", lambda m: repl_fs_delete.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 12. fs:trash:list
repl_fs_trash_list = """ipcMain.handle('fs:trash:list', (_, { world }) => {
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
      items.push({ trashPath: `${world}/trash/${rel.replace(/\\\\/g, '/')}`, collection: segs[0] || '', id: name.replace(/\\.md$/i, '') });
    }
  }
  walk(trashRoot, '');
  return { items };
});"""
code = re.sub(r"ipcMain\.handle\('fs:trash:list'.*?\}\);", lambda m: repl_fs_trash_list.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 13. fs:trash:restore
repl_fs_trash_restore = """ipcMain.handle('fs:trash:restore', (_, { path: relPath }) => {
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
});"""
code = re.sub(r"ipcMain\.handle\('fs:trash:restore'.*?\}\);", lambda m: repl_fs_trash_restore.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 14. fs:trash:purge
repl_fs_trash_purge = """ipcMain.handle('fs:trash:purge', (_, { path: relPath }) => {
  const normalized = relPath.replace(/\\\\/g, '/');
  if (!normalized.includes('/trash/')) throw new Error('Not a trash path');
  const parts = normalized.split('/');
  const worldName = parts[0];
  const full = resolveFilePath(normalized);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (fs.existsSync(full)) fs.unlinkSync(full);
  return { success: true };
});"""
code = re.sub(r"ipcMain\.handle\('fs:trash:purge'.*?\}\);", lambda m: repl_fs_trash_purge.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 15. backup:run
code = code.replace("const sourceDir = path.join(worldsDir, activeWorld);", "const sourceDir = resolveWorldPath(activeWorld);")

# 16. fs:readMapImage
repl_fs_readMapImage = """ipcMain.handle('fs:readMapImage', (_, { filePath }) => {
  const parts = filePath.replace(/\\\\/g, '/').split('/');
  const worldName = parts[0];
  const full = resolveFilePath(filePath);
  if (!isPathAllowed(full, worldName)) throw new Error('Forbidden');
  if (!fs.existsSync(full)) return null;
  return { base64: fs.readFileSync(full).toString('base64') };
});"""
code = re.sub(r"ipcMain\.handle\('fs:readMapImage'.*?\}\);", lambda m: repl_fs_readMapImage.replace('\\\\', '\\'), code, flags=re.DOTALL)

# 17. App settings IPC endpoints and Server Management
app_settings_ipc = """
// ── App Settings & Server IPC ─────────────────────────────────────────────────
ipcMain.handle('app:getSettings', () => appSettings);

ipcMain.handle('app:saveSettings', (_, settings) => {
  appSettings = settings;
  saveAppSettings(appSettings);
  return appSettings;
});

ipcMain.handle('server:start', async () => {
  try {
    await startServer(5180, {
      resolveFilePath,
      resolveWorldPath,
      getWorldsDir,
      getExternalWorlds,
      stampsRoot,
      pluginsDir,
      distDir: path.join(__dirname, '../dist'),
    });
    return { success: true, ip: getLocalIP(), port: 5180 };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:stop', () => {
  stopServer();
  return { success: true };
});

ipcMain.handle('server:status', () => {
  return { ip: getLocalIP(), port: 5180 };
});
"""

code = code.replace("// ── IPC: app info ─────────────────────────────────────────────────────────────", app_settings_ipc + "\n// ── IPC: app info ─────────────────────────────────────────────────────────────")

# 18. Start Server on launch if enabled
startup = """app.whenReady().then(() => {
  createWindow();
  reloadPlugins().catch(console.error);
  if (appSettings.serverEnabled) {
    startServer(5180, {
      resolveFilePath, resolveWorldPath, getWorldsDir, getExternalWorlds, stampsRoot, pluginsDir,
      distDir: path.join(__dirname, '../dist')
    }).catch(console.error);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});"""
code = re.sub(r"app\.whenReady\(\)\.then\(\(\) => \{.*?\}\);", lambda m: startup, code, flags=re.DOTALL)

with open('electron/main.js', 'w') as f:
    f.write(code)

print("Refactored main.js successfully")
