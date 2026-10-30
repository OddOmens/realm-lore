// Client for the Realm Lore server. Every call the pages make goes through
// here; the method names match the old desktop bridge so pages stay the same.

async function request(method, url, body, { raw = false } = {}) {
  const init = { method, headers: {} };
  if (body instanceof FormData || body instanceof Blob) {
    init.body = body;
  } else if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.location.reload(); // session ended: the sign-in screen takes over
    throw new Error('Signed out');
  }
  if (raw) {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `Request failed (${res.status})`);
    return res;
  }
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

const get  = (url)       => request('GET', url);
const post = (url, body) => request('POST', url, body ?? {});
const put  = (url, body) => request('PUT', url, body);
const del  = (url)       => request('DELETE', url);
const enc  = encodeURIComponent;
const encPath = (p) => p.split('/').map(enc).join('/');

// Opens the browser's file picker and resolves with the chosen files ([] if canceled).
function pickFiles({ accept = '', multiple = false, directory = false } = {}) {
  return new Promise(resolve => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    if (directory) input.webkitdirectory = true;
    input.style.display = 'none';
    input.addEventListener('change', () => { resolve([...input.files]); input.remove(); });
    input.addEventListener('cancel', () => { resolve([]); input.remove(); });
    document.body.append(input);
    input.click();
  });
}

function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Uploads `send(overwrite)`; when the world exists, asks before replacing it.
async function withOverwritePrompt(send) {
  try {
    return await send(false);
  } catch (err) {
    if (err.status !== 409) throw err;
    const ok = window.confirm(`A world named "${err.data?.world}" already exists.\n\nReplace it? This deletes everything in the existing world and can't be undone.`);
    if (!ok) return { canceled: true };
    return send(true);
  }
}

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Turns browser HTML into the XHTML an EPUB reader accepts.
function toXhtml(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  return new XMLSerializer().serializeToString(doc.body.firstChild)
    .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/, '');
}

async function buildEpub({ title, author, chapters }) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  const id = `urn:uuid:${crypto.randomUUID()}`;
  const t = escapeXml(title || 'Realm Lore Export');
  const a = escapeXml(author || 'Unknown');
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file('META-INF/container.xml', '<?xml version="1.0" encoding="UTF-8"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const items = chapters.map((c, i) => ({ file: `chapter-${i + 1}.xhtml`, title: escapeXml(c.title || `Chapter ${i + 1}`), html: c.html }));
  for (const c of items) {
    zip.file(`OEBPS/${c.file}`, `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml"><head><title>${c.title}</title></head><body><h1>${c.title}</h1>${toXhtml(c.html)}</body></html>`);
  }
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE html><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>${t}</title></head><body><nav epub:type="toc"><ol>${items.map(c => `<li><a href="${c.file}">${c.title}</a></li>`).join('')}</ol></nav></body></html>`);
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="id">${id}</dc:identifier><dc:title>${t}</dc:title><dc:creator>${a}</dc:creator><dc:language>en</dc:language><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${items.map((c, i) => `<item id="c${i}" href="${c.file}" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${items.map((c, i) => `<itemref idref="c${i}"/>`).join('')}</spine></package>`);
  return zip.generateAsync({ type: 'blob', mimeType: 'application/epub+zip' });
}

export const api = {
  // App
  getInfo:  () => get('/api/info'),
  getPaths: () => get('/api/info').then(i => ({ worlds: i.worldsPath })),

  // Worlds
  listWorlds:  ()     => get('/api/worlds'),
  createWorld: (name) => post('/api/worlds', { name }),
  deleteWorld: (name) => del(`/api/worlds/${enc(name)}`),

  // Uploads a folder of Markdown files as a world (the folder's name becomes the world's name).
  openWorld: async () => {
    const files = await pickFiles({ directory: true, multiple: true });
    if (!files.length) return { canceled: true };
    const name = files[0].webkitRelativePath.split('/')[0];
    return withOverwritePrompt(overwrite => {
      const form = new FormData();
      for (const f of files) {
        const rel = f.webkitRelativePath.split('/').slice(1).join('/');
        if (!rel) continue;
        // Servers drop folders from upload file names, so the path goes alongside.
        form.append('paths', rel);
        form.append('files', f, f.name);
      }
      return post(`/api/worlds/upload?name=${enc(name)}${overwrite ? '&overwrite=1' : ''}`, form);
    });
  },

  importWorld: async () => {
    const [file] = await pickFiles({ accept: '.zip,application/zip' });
    if (!file) return { canceled: true };
    const name = file.name.replace(/\.zip$/i, '');
    return withOverwritePrompt(overwrite =>
      post(`/api/worlds/import?name=${enc(name)}${overwrite ? '&overwrite=1' : ''}`, file));
  },

  exportWorld: async (name) => {
    const res = await request('GET', `/api/worlds/${enc(name)}/export`, undefined, { raw: true });
    saveBlob(await res.blob(), `${name}.zip`);
    return { success: true, filePath: `${name}.zip` };
  },

  // Files inside a world. Paths look like "World/characters/<id>.md".
  fsRead:           (filePath)             => post('/api/fs/read', { path: filePath }),
  fsReadDirContent: (dirPath, extension)   => post('/api/fs/list', { path: dirPath, extension, mode: 'content' }),
  fsReadDirIndex:   (dirPath, extension)   => post('/api/fs/list', { path: dirPath, extension, mode: 'index' }),
  fsWrite:          (filePath, content)    => post('/api/fs/write', { path: filePath, content }),
  fsWriteBatch:     (items)                => post('/api/fs/write-batch', { items: items.map(i => ({ path: i.filePath, content: i.content })) }),
  fsDelete:         (filePath)             => post('/api/fs/delete', { path: filePath }),
  readMapImage:     (filePath)             => post('/api/fs/map-image', { path: filePath }),

  // Trash
  trashList:    (world) => get(`/api/worlds/${enc(world)}/trash`),
  trashRestore: (path)  => post('/api/trash/restore', { path }),
  trashPurge:   (path)  => post('/api/trash/purge', { path }),

  // Backups run on the server on a schedule; these read and change that schedule.
  getBackupConfig:  ()       => get('/api/backup'),
  saveBackupConfig: (config) => put('/api/backup', config),
  runBackup:        (opts)   => post('/api/backup/run', { world: opts?.activeWorld }),

  // Images
  listAssets:  ({ world })            => get(`/api/worlds/${enc(world)}/assets`),
  deleteAsset: ({ world, assetPath }) => del(`/api/worlds/${enc(world)}/assets/${encPath(assetPath)}`),
  importAsset: async ({ world }) => {
    const files = await pickFiles({ accept: '.png,.jpg,.jpeg,.webp,.svg,.gif', multiple: true });
    if (!files.length) return { canceled: true };
    const form = new FormData();
    for (const f of files) form.append('files', f, f.name);
    return post(`/api/worlds/${enc(world)}/assets`, form);
  },
  stampsList:  ()    => get('/api/stamps'),
  stampsImage: (rel) => get(`/api/stamps/image?rel=${enc(rel)}`),

  // Exports
  exportPdf: async ({ title, htmlContent }) => {
    const w = window.open('', '_blank');
    if (!w) throw new Error('Your browser blocked the print window. Allow pop-ups for Realm Lore and try again.');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeXml(title || 'Export')}</title><style>
      body { font-family: Georgia, serif; font-size: 14px; line-height: 1.6; color: #111; max-width: 800px; margin: 0 auto; padding: 40px; }
      h1, h2, h3 { font-family: Helvetica, sans-serif; color: #000; }
      img { max-width: 100%; height: auto; }
      pre, code { font-family: monospace; background: #f4f4f4; padding: 2px 4px; border-radius: 4px; }
      blockquote { border-left: 4px solid #ccc; margin: 0; padding-left: 1em; color: #555; }
    </style></head><body>${htmlContent}</body></html>`);
    w.document.close();
    w.addEventListener('load', () => { w.focus(); w.print(); });
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* already printed */ } }, 600);
    return { success: true };
  },
  exportEpub: async ({ title, author, chapters }) => {
    saveBlob(await buildEpub({ title, author, chapters }), `${title || 'Export'}.epub`);
    return { success: true };
  },
};

// Saved image links use "asset://World/path" so they don't depend on the
// server's address; the server serves them under /asset/.
export function assetUrl(src) {
  if (typeof src !== 'string' || !src.startsWith('asset://')) return src;
  return '/asset/' + src.slice('asset://'.length);
}
