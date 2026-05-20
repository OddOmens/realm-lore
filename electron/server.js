import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import os from 'os';

let serverInstance = null;

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export function startServer(port, deps) {
  if (serverInstance) return; // Already running

  const {
    resolveFilePath,
    resolveWorldPath,
    getWorldsDir,
    getExternalWorlds,
    stampsRoot,
    pluginsDir,
    distDir,
  } = deps;

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API endpoint matching the Vite polyfill
  app.post('/api/electron', async (req, res) => {
    try {
      const { action, payload } = req.body;
      let result = {};

      switch (action) {
        case 'worlds:list': {
          const masterDir = getWorldsDir();
          ensureDir(masterDir);
          const files = fs.readdirSync(masterDir);
          const masterWorlds = files.filter(f =>
            !f.startsWith('.') && !f.startsWith('_') &&
            fs.statSync(path.join(masterDir, f)).isDirectory()
          );
          
          const external = getExternalWorlds().map(w => w.name);
          const worlds = [...new Set([...masterWorlds, ...external])];
          result = { worlds };
          break;
        }
        case 'worlds:create': {
          const safeName = payload.name.replace(/[^a-zA-Z0-9_-]/g, '_');
          const dir = resolveWorldPath(safeName);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'].forEach(f => {
              ensureDir(path.join(dir, f));
            });
          }
          result = { success: true, world: safeName };
          break;
        }
        case 'worlds:delete': {
          // We only delete from filesystem if it's in master dir, or we just delete the external link?
          // Let's rely on the main.js logic if we want, or implement here:
          const target = resolveWorldPath(payload.name);
          if (fs.existsSync(target)) {
            fs.rmSync(target, { recursive: true, force: true });
          }
          result = { success: true };
          break;
        }
        case 'fs:read': {
          const full = resolveFilePath(payload.filePath);
          if (!fs.existsSync(full)) {
            result = null;
          } else if (fs.statSync(full).isDirectory()) {
            result = { isDir: true, files: fs.readdirSync(full) };
          } else {
            result = { isDir: false, content: fs.readFileSync(full, 'utf-8') };
          }
          break;
        }
        case 'fs:write': {
          const full = resolveFilePath(payload.filePath);
          ensureDir(path.dirname(full));
          if (fs.existsSync(full)) fs.copyFileSync(full, full + '.bak');
          const tmp = full + '.tmp';
          fs.writeFileSync(tmp, payload.content, 'utf-8');
          fs.renameSync(tmp, full);
          result = { success: true };
          break;
        }
        case 'fs:delete': {
          const full = resolveFilePath(payload.filePath);
          if (fs.existsSync(full)) {
            const parts = payload.filePath.replace(/\\/g, '/').split('/');
            const worldName = parts[0];
            const restPath = parts.slice(1).join('/');
            const trashFull = path.join(resolveWorldPath(worldName), 'trash', restPath);
            ensureDir(path.dirname(trashFull));
            let dest = trashFull;
            if (fs.existsSync(dest)) {
              dest = path.join(path.dirname(trashFull), `${Date.now()}_${path.basename(trashFull)}`);
            }
            fs.renameSync(full, dest);
            if (fs.existsSync(full + '.bak')) fs.unlinkSync(full + '.bak');
          }
          result = { success: true };
          break;
        }
        case 'fs:trash:list': {
          const trashRoot = path.join(resolveWorldPath(payload.world), 'trash');
          const items = [];
          function walk(dir, prefix) {
            if (!fs.existsSync(dir)) return;
            for (const name of fs.readdirSync(dir)) {
              const full = path.join(dir, name);
              const rel  = prefix ? `${prefix}/${name}` : name;
              if (fs.statSync(full).isDirectory()) { walk(full, rel); continue; }
              if (!name.endsWith('.md')) continue;
              const segs = rel.replace(/\\/g, '/').split('/');
              items.push({ trashPath: `${payload.world}/trash/${rel.replace(/\\/g, '/')}`, collection: segs[0] || '', id: name.replace(/\\.md$/i, '') });
            }
          }
          walk(trashRoot, '');
          result = { items };
          break;
        }
        case 'fs:trash:restore': {
          const normalized = payload.path.replace(/\\/g, '/');
          const idx = normalized.indexOf('/trash/');
          if (idx !== -1) {
            const worldName = normalized.slice(0, idx);
            const rest = normalized.slice(idx + '/trash/'.length);
            const fullTrash = path.join(resolveWorldPath(worldName), 'trash', rest);
            if (fs.existsSync(fullTrash)) {
              const dest = path.join(resolveWorldPath(worldName), rest);
              ensureDir(path.dirname(dest));
              fs.renameSync(fullTrash, dest);
            }
          }
          result = { success: true };
          break;
        }
        case 'fs:trash:purge': {
          const normalized = payload.path.replace(/\\/g, '/');
          if (normalized.includes('/trash/')) {
            const full = resolveFilePath(normalized);
            if (fs.existsSync(full)) {
              fs.unlinkSync(full);
            }
          }
          result = { success: true };
          break;
        }
        case 'stamps:list': {
          const IMAGE_EXTS = new Set(['.png','.svg','.jpg','.jpeg','.webp']);
          const entries = [];
          function walkStamps(dir, prefix) {
            if (!fs.existsSync(dir)) return;
            for (const name of fs.readdirSync(dir)) {
              const full = path.join(dir, name);
              const rel  = prefix ? `${prefix}/${name}` : name;
              if (fs.statSync(full).isDirectory()) { walkStamps(full, rel); continue; }
              const ext = path.extname(name).toLowerCase();
              if (!IMAGE_EXTS.has(ext)) continue;
              const label = path.basename(name, ext).replace(/[_-]+/g, ' ').trim();
              entries.push({ rel, label, ext: ext.slice(1) });
            }
          }
          walkStamps(stampsRoot, '');
          entries.sort((a, b) => a.label.localeCompare(b.label));
          result = { stamps: entries };
          break;
        }
        case 'stamps:image': {
          const full = path.resolve(stampsRoot, payload.rel);
          if (full.startsWith(stampsRoot) && fs.existsSync(full)) {
            const ext  = path.extname(full).toLowerCase();
            const mime = ext === '.svg' ? 'image/svg+xml' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
            result = { dataUrl: `data:${mime};base64,${fs.readFileSync(full).toString('base64')}` };
          } else {
            throw new Error('Not found');
          }
          break;
        }
        case 'fs:readMapImage': {
          const full = resolveFilePath(payload.filePath);
          if (fs.existsSync(full)) {
            result = { base64: fs.readFileSync(full).toString('base64') };
          } else {
            result = null;
          }
          break;
        }
        case 'app:getPaths': {
          result = { worlds: getWorldsDir(), userData: process.cwd() };
          break;
        }
        case 'plugins:scan': {
          result = { plugins: [], pluginsDir };
          break;
        }
        case 'plugins:getSettings': {
          result = { enabled: true, enabledIds: [] };
          break;
        }
        case 'plugins:getPanels': {
          result = [];
          break;
        }
        case 'backup:run': {
          result = { success: true, timestamp: new Date().toISOString() };
          break;
        }
        case 'worlds:open': {
          result = { canceled: true };
          break;
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
      res.json(result);
    } catch (err) {
      console.error('Server API Error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Serve static files
  app.use(express.static(distDir));

  // Fallback to index.html for SPA routing
  app.get('*', (req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });

  return new Promise((resolve, reject) => {
    serverInstance = app.listen(port, '0.0.0.0', () => {
      console.log(`Remote access server running on port ${port}`);
      resolve();
    }).on('error', reject);
  });
}

export function stopServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

export function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
}
