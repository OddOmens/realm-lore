import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import os from 'os';

function expandPath(p) {
  if (p.startsWith('~/') || p === '~') return path.join(os.homedir(), p.slice(1));
  return p;
}

// Passcode source of truth. Prefer env vars; fall back to a default so the
// app still runs locally with no setup. The default is well-known, so emit
// a one-time loud warning if it's left in place over LAN.
const PASSCODE = process.env.WORLDS_PASSCODE || process.env.PASSCODE || '4037';
const PASSCODE_IS_DEFAULT = !process.env.WORLDS_PASSCODE && !process.env.PASSCODE;
const HOST = process.env.WORLDS_HOST || '0.0.0.0';

let warned = false;
function maybeWarnSecurity() {
  if (warned) return;
  warned = true;
  if (PASSCODE_IS_DEFAULT && HOST === '0.0.0.0') {
    console.warn(
      '\n⚠️  fantasy-world-builder: dev server is using the DEFAULT passcode and listening on 0.0.0.0 (LAN-accessible).\n' +
      '   Anyone on your network who knows the default passcode can read/write your worlds.\n' +
      '   Fix one of:\n' +
      '     • Set WORLDS_PASSCODE=<your-secret> in a .env or before `npm run dev`\n' +
      '     • Set WORLDS_HOST=127.0.0.1 to restrict to this machine only\n'
    );
  }
}

// Local API to read/write files in dev mode
function localFsPlugin() {
  return {
    name: 'local-fs-api',
    configureServer(server) {
      maybeWarnSecurity();
      server.middlewares.use(async (req, res, next) => {
        if (!req.url.startsWith('/api/fs') && !req.url.startsWith('/api/worlds') && !req.url.startsWith('/api/backup') && !req.url.startsWith('/api/stamps')) {
          return next();
        }

        const url = new URL(req.url, `http://${req.headers.host}`);

        // --- Security Layer ---
        const userPasscode = req.headers['x-passcode'];

        if (url.pathname.startsWith('/api/') && userPasscode !== PASSCODE) {
          res.statusCode = 401;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: 'Unauthorized: Invalid Passcode' }));
        }
        // ----------------------

        // Base directory for worlds
        const worldsDir = path.resolve(process.cwd(), 'Worlds');
        if (!fs.existsSync(worldsDir)) {
          fs.mkdirSync(worldsDir, { recursive: true });
        }

        if (req.method === 'GET' && url.pathname === '/api/worlds/list') {
          const files = fs.readdirSync(worldsDir);
          const worlds = files.filter(f => !f.startsWith('.') && !f.startsWith('_') && fs.statSync(path.join(worldsDir, f)).isDirectory());
          // Ensure all worlds have the required subdirectories
          const requiredFolders = ['characters', 'locations', 'things', 'lore', 'factions', 'creatures', 'stories', 'relationships', 'maps', 'books', 'customStamps'];
          worlds.forEach(world => {
            requiredFolders.forEach(folder => {
              const folderPath = path.join(worldsDir, world, folder);
              if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
            });
          });
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ worlds }));
        }

        if (req.method === 'POST' && url.pathname === '/api/worlds/create') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { name } = JSON.parse(body);
              if (!name) return res.statusCode = 400, res.end('Missing name');

              // simple sanitize
              const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
              const newWorldDir = path.join(worldsDir, safeName);
              if (!fs.existsSync(newWorldDir)) {
                fs.mkdirSync(newWorldDir, { recursive: true });
                // Initialize default folders
                ['characters', 'locations', 'things', 'lore', 'factions', 'creatures', 'stories', 'relationships', 'maps', 'books', 'customStamps'].forEach(folder => {
                  fs.mkdirSync(path.join(newWorldDir, folder), { recursive: true });
                });
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, world: safeName }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/worlds/delete') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { name, passcode } = JSON.parse(body);
              if (!name) return res.statusCode = 400, res.end('Missing name');
              if (passcode !== PASSCODE) return res.statusCode = 401, res.end('Unauthorized');

              const targetDir = path.join(worldsDir, name);
              if (fs.existsSync(targetDir) && targetDir.startsWith(worldsDir)) {
                fs.rmSync(targetDir, { recursive: true, force: true });
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true }));
              } else {
                res.statusCode = 404;
                res.end('World not found');
              }
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        if (req.method === 'GET' && url.pathname === '/api/fs/read') {
          const filePath = url.searchParams.get('path');
          if (!filePath) {
            res.statusCode = 400;
            return res.end('Missing path');
          }

          const fullPath = path.join(worldsDir, filePath);

          if (!fullPath.startsWith(worldsDir)) {
            res.statusCode = 403;
            return res.end('Forbidden');
          }

          if (!fs.existsSync(fullPath)) {
            res.statusCode = 404;
            return res.end('File not found');
          }

          if (fs.statSync(fullPath).isDirectory()) {
            const files = fs.readdirSync(fullPath);
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ isDir: true, files }));
          } else {
            const content = fs.readFileSync(fullPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            return res.end(JSON.stringify({ isDir: false, content }));
          }
        }

        if (req.method === 'POST' && url.pathname === '/api/fs/write') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const { filePath, content } = JSON.parse(body);
              if (!filePath) {
                res.statusCode = 400;
                return res.end('Missing path');
              }

              const fullPath = path.join(worldsDir, filePath);

              if (!fullPath.startsWith(worldsDir)) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }

              const dir = path.dirname(fullPath);
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }

              // Data Security & Loss Prevention:
              // 1. If file exists, create a backup (.bak) first
              if (fs.existsSync(fullPath)) {
                fs.copyFileSync(fullPath, fullPath + '.bak');
              }

              // 2. Atomic Write: Write to .tmp then rename to target
              // This prevents file corruption if the process crashes during write
              const tmpPath = fullPath + '.tmp';
              fs.writeFileSync(tmpPath, content, 'utf-8');
              fs.renameSync(tmpPath, fullPath);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message }));
            }
          });
          return;
        }

        if (req.method === 'POST' && url.pathname === '/api/fs/delete') {
          let body = '';
          req.on('data', chunk => {
            body += chunk.toString();
          });
          req.on('end', () => {
            try {
              const { filePath } = JSON.parse(body);
              if (!filePath) {
                res.statusCode = 400;
                return res.end('Missing path');
              }

              const fullPath = path.join(worldsDir, filePath);

              if (!fullPath.startsWith(worldsDir)) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }

              if (fs.existsSync(fullPath)) {
                const stat = fs.statSync(fullPath);
                if (!stat.isFile()) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ error: 'Not a file' }));
                }

                // Soft-delete inside the world folder so restore preserves collection + id:
                //   DefaultWorld/characters/uuid.md → DefaultWorld/trash/characters/uuid.md
                const relNorm = path.relative(worldsDir, fullPath).replace(/\\/g, '/');
                const parts = relNorm.split('/');
                if (parts.length < 3) {
                  res.statusCode = 400;
                  return res.end(JSON.stringify({ error: 'Invalid trash path' }));
                }

                const worldName = parts[0];
                const restPath = parts.slice(1).join('/');
                const trashFull = path.join(worldsDir, worldName, 'trash', restPath);
                const trashParent = path.dirname(trashFull);
                fs.mkdirSync(trashParent, { recursive: true });

                let destPath = trashFull;
                if (fs.existsSync(destPath)) {
                  const base = path.basename(destPath);
                  destPath = path.join(trashParent, `${Date.now()}_${base}`);
                }

                fs.renameSync(fullPath, destPath);

                if (fs.existsSync(fullPath + '.bak')) {
                  fs.unlinkSync(fullPath + '.bak');
                }
              }
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message }));
            }
          });
          return;
        }

        // List soft-deleted `.md` files under `{world}/trash/**`
        if (req.method === 'GET' && url.pathname === '/api/fs/trash/list') {
          const world = url.searchParams.get('world');
          if (!world || world.includes('..') || world.includes('/') || world.includes('\\')) {
            res.statusCode = 400;
            return res.end(JSON.stringify({ error: 'Missing or invalid world' }));
          }
          const trashRoot = path.join(worldsDir, world, 'trash');
          const items = [];
          function walk(dir, prefixWithinTrash) {
            if (!fs.existsSync(dir)) return;
            for (const name of fs.readdirSync(dir)) {
              const full = path.join(dir, name);
              const relWithinTrash = prefixWithinTrash ? `${prefixWithinTrash}/${name}` : name;
              const st = fs.statSync(full);
              if (st.isDirectory()) walk(full, relWithinTrash);
              else if (name.endsWith('.md')) {
                const segs = relWithinTrash.replace(/\\/g, '/').split('/');
                const collection = segs[0] || '';
                items.push({
                  trashPath: `${world}/trash/${relWithinTrash.replace(/\\/g, '/')}`,
                  collection,
                  id: name.replace(/\.md$/i, ''),
                });
              }
            }
          }
          walk(trashRoot, '');
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ items }));
        }

        // Move `{world}/trash/{collection}/{id}.md` → `{world}/{collection}/{id}.md`
        if (req.method === 'POST' && url.pathname === '/api/fs/trash/restore') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const relPath = parsed.path || parsed.filePath;
              if (!relPath || typeof relPath !== 'string') {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Missing path' }));
              }
              const normalized = relPath.replace(/\\/g, '/');
              const trashMarker = '/trash/';
              const idx = normalized.indexOf(trashMarker);
              if (idx === -1) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Not a trash path' }));
              }

              const fullTrash = path.join(worldsDir, normalized);
              if (!fullTrash.startsWith(worldsDir)) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }
              if (!fs.existsSync(fullTrash)) {
                res.statusCode = 404;
                return res.end(JSON.stringify({ error: 'Trash entry not found' }));
              }

              const restoredRel = normalized.slice(0, idx) + '/' + normalized.slice(idx + trashMarker.length);
              const destFull = path.join(worldsDir, restoredRel);
              if (!destFull.startsWith(worldsDir)) {
                res.statusCode = 403;
                return res.end('Forbidden');
              }
              if (fs.existsSync(destFull)) {
                res.statusCode = 409;
                return res.end(JSON.stringify({ error: 'A file already exists at the restore destination. Delete or rename it first.' }));
              }

              fs.mkdirSync(path.dirname(destFull), { recursive: true });
              fs.renameSync(fullTrash, destFull);

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, restoredPath: restoredRel }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message }));
            }
          });
          return;
        }

        // Permanently delete one trash item (optional cleanup)
        if (req.method === 'POST' && url.pathname === '/api/fs/trash/purge') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { path: relPath } = JSON.parse(body || '{}');
              if (!relPath) return res.statusCode = 400, res.end(JSON.stringify({ error: 'Missing path' }));
              const normalized = relPath.replace(/\\/g, '/');
              if (!normalized.includes('/trash/')) {
                res.statusCode = 400;
                return res.end(JSON.stringify({ error: 'Not a trash path' }));
              }
              const full = path.join(worldsDir, normalized);
              if (!full.startsWith(worldsDir)) return res.statusCode = 403, res.end('Forbidden');
              if (fs.existsSync(full)) fs.unlinkSync(full);
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true }));
            } catch (error) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: error.message }));
            }
          });
          return;
        }

        // ── Stamp image library endpoints ─────────────────────────────────────
        // Stamps live in {cwd}/customStamps/ (shared across all worlds so art
        // assets aren't tied to a world and can be reused freely).
        const stampsRoot = path.resolve(process.cwd(), 'customStamps');
        if (!fs.existsSync(stampsRoot)) fs.mkdirSync(stampsRoot, { recursive: true });

        // GET /api/stamps/list — returns a flat list of all PNG/SVG/JPG/WEBP
        // files found recursively under customStamps/, with cleaned display names.
        if (req.method === 'GET' && url.pathname === '/api/stamps/list') {
          const IMAGE_EXTS = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp']);
          const entries = [];
          function walkStamps(dir, prefix) {
            if (!fs.existsSync(dir)) return;
            for (const name of fs.readdirSync(dir)) {
              const full = path.join(dir, name);
              const rel  = prefix ? `${prefix}/${name}` : name;
              if (fs.statSync(full).isDirectory()) {
                walkStamps(full, rel);
              } else {
                const ext = path.extname(name).toLowerCase();
                if (IMAGE_EXTS.has(ext)) {
                  // Clean name: remove extension, replace underscores/hyphens with spaces, title-case
                  const base = path.basename(name, ext);
                  const label = base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
                  entries.push({ rel, label, ext: ext.slice(1) });
                }
              }
            }
          }
          walkStamps(stampsRoot, '');
          entries.sort((a, b) => a.label.localeCompare(b.label));
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ stamps: entries }));
        }

        // GET /api/stamps/image?path=rel/path/to/file.png — serves the binary
        // image file with the correct Content-Type so <img src> works directly.
        if (req.method === 'GET' && url.pathname === '/api/stamps/image') {
          const rel = url.searchParams.get('path');
          if (!rel) { res.statusCode = 400; return res.end('Missing path'); }
          const full = path.resolve(stampsRoot, rel);
          if (!full.startsWith(stampsRoot)) { res.statusCode = 403; return res.end('Forbidden'); }
          if (!fs.existsSync(full)) { res.statusCode = 404; return res.end('Not found'); }
          const ext = path.extname(full).toLowerCase();
          const mime = ext === '.svg' ? 'image/svg+xml'
            : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
            : ext === '.webp' ? 'image/webp'
            : 'image/png';
          res.setHeader('Content-Type', mime);
          return res.end(fs.readFileSync(full));
        }

        if (req.method === 'POST' && url.pathname === '/api/backup') {
          let body = '';
          req.on('data', chunk => { body += chunk.toString(); });
          req.on('end', () => {
            try {
              const { location, passcode, activeWorld, retentionDays } = JSON.parse(body);
              if (passcode !== PASSCODE) return res.statusCode = 401, res.end('Unauthorized');

              if (!location) return res.statusCode = 400, res.end('Missing backup location');
              if (!activeWorld) return res.statusCode = 400, res.end('Missing active world');

              const sourceDir = path.join(worldsDir, activeWorld);
              if (!fs.existsSync(sourceDir)) {
                return res.statusCode = 404, res.end('World not found');
              }

              // Resolve absolute target directory (expand ~ and resolve relative paths)
              const targetBaseDir = path.resolve(process.cwd(), expandPath(location));
              if (!fs.existsSync(targetBaseDir)) {
                fs.mkdirSync(targetBaseDir, { recursive: true });
              }

              // New folder layout: {location}/{world}/{YYYY-MM-DD}/{HH-MM-SS}/
              const now = new Date();
              const pad = (n) => String(n).padStart(2, '0');
              const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
              const timeStr = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;

              const worldBackupRoot = path.join(targetBaseDir, activeWorld);
              const dayDir          = path.join(worldBackupRoot, dateStr);
              const finalTarget     = path.join(dayDir, timeStr);

              if (!fs.existsSync(dayDir)) fs.mkdirSync(dayDir, { recursive: true });

              // Skip atomic-write artifacts and trash so backups stay clean.
              const SKIP_NAMES = new Set(['.trash', '.DS_Store']);
              const SKIP_SUFFIX = ['.bak', '.tmp'];
              fs.cpSync(sourceDir, finalTarget, {
                recursive: true,
                filter: (src) => {
                  const name = path.basename(src);
                  if (SKIP_NAMES.has(name)) return false;
                  if (SKIP_SUFFIX.some(s => name.endsWith(s))) return false;
                  return true;
                },
              });

              // Retention: drop any YYYY-MM-DD folder older than the cutoff (whole day at once).
              const days = Number(retentionDays) || 0;
              let pruned = 0;
              if (days > 0 && fs.existsSync(worldBackupRoot)) {
                const cutoff = new Date();
                cutoff.setHours(0, 0, 0, 0);
                cutoff.setDate(cutoff.getDate() - days);
                for (const entry of fs.readdirSync(worldBackupRoot)) {
                  const m = entry.match(/^(\d{4})-(\d{2})-(\d{2})$/);
                  if (!m) continue;
                  const folderDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                  if (folderDate < cutoff) {
                    const full = path.join(worldBackupRoot, entry);
                    if (full.startsWith(worldBackupRoot)) {
                      fs.rmSync(full, { recursive: true, force: true });
                      pruned++;
                    }
                  }
                }
              }

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                success: true,
                path: finalTarget,
                date: dateStr,
                time: timeStr,
                pruned,
                timestamp: now.toISOString(),
              }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });
          return;
        }

        next();
      });
    }
  };
}

export default defineConfig({
  plugins: [react(), localFsPlugin()],
  server: {
    host: HOST,
    port: 5180,
    strictPort: true,
    https: false,
  }
});
