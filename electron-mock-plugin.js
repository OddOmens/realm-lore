import fs from 'fs';
import path from 'path';

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

export default function electronMockPlugin() {
  return {
    name: 'electron-mock-plugin',
    configureServer(server) {
      server.middlewares.use('/api/electron', async (req, res, next) => {
        if (req.method !== 'POST') return next();

        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        
        req.on('end', async () => {
          try {
            const parsed = JSON.parse(body);
            const { action, payload } = parsed;
            const worldsDir = path.join(process.cwd(), 'Worlds');
            const stampsRoot = path.join(process.cwd(), 'customStamps');
            const pluginsDir = path.join(process.cwd(), 'plugins');

            ensureDir(worldsDir);
            ensureDir(stampsRoot);
            ensureDir(pluginsDir);

            let result = {};

            switch (action) {
              case 'worlds:list': {
                const files = fs.readdirSync(worldsDir);
                const worlds = files.filter(f =>
                  !f.startsWith('.') && !f.startsWith('_') &&
                  fs.statSync(path.join(worldsDir, f)).isDirectory()
                );
                result = { worlds };
                break;
              }
              case 'worlds:create': {
                const safeName = payload.name.replace(/[^a-zA-Z0-9_-]/g, '_');
                const dir = path.join(worldsDir, safeName);
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
                const target = path.join(worldsDir, payload.name);
                if (fs.existsSync(target) && target.startsWith(worldsDir)) {
                  fs.rmSync(target, { recursive: true, force: true });
                }
                result = { success: true };
                break;
              }
              case 'fs:read': {
                const full = path.join(worldsDir, payload.filePath);
                if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
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
                const full = path.join(worldsDir, payload.filePath);
                if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
                ensureDir(path.dirname(full));
                if (fs.existsSync(full)) fs.copyFileSync(full, full + '.bak');
                const tmp = full + '.tmp';
                fs.writeFileSync(tmp, payload.content, 'utf-8');
                fs.renameSync(tmp, full);
                result = { success: true };
                break;
              }
              case 'fs:delete': {
                const full = path.join(worldsDir, payload.filePath);
                if (!full.startsWith(worldsDir)) throw new Error('Forbidden');
                if (fs.existsSync(full)) {
                  const relNorm = path.relative(worldsDir, full).replace(/\\/g, '/');
                  const parts = relNorm.split('/');
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
                }
                result = { success: true };
                break;
              }
              case 'fs:trash:list': {
                const trashRoot = path.join(worldsDir, payload.world, 'trash');
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
                  const fullTrash = path.join(worldsDir, normalized);
                  if (fullTrash.startsWith(worldsDir) && fs.existsSync(fullTrash)) {
                    const restoredRel = normalized.slice(0, idx) + '/' + normalized.slice(idx + '/trash/'.length);
                    const dest = path.join(worldsDir, restoredRel);
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
                  const full = path.join(worldsDir, normalized);
                  if (full.startsWith(worldsDir) && fs.existsSync(full)) {
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
                const full = path.join(worldsDir, payload.filePath);
                if (full.startsWith(worldsDir) && fs.existsSync(full)) {
                  result = { base64: fs.readFileSync(full).toString('base64') };
                } else {
                  result = null;
                }
                break;
              }
              case 'app:getPaths': {
                result = { worlds: worldsDir, userData: process.cwd() };
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
                // Just mock a success without actually doing the backup zip
                result = { success: true, timestamp: new Date().toISOString() };
                break;
              }
              case 'worlds:open': {
                // Mock a cancellation since we can't show a native dialog in browser
                result = { canceled: true };
                break;
              }
              default:
                throw new Error(`Unknown action: ${action}`);
            }

            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(result));
          } catch (err) {
            console.error('Electron API Mock Error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}
