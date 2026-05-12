// db.js — filesystem access layer.
// In Electron it calls window.electronAPI (IPC).
// In web dev mode it calls the Vite plugin API routes.
import { v4 as uuidv4 } from 'uuid';

let activeWorld = localStorage.getItem('activeWorld') || 'DefaultWorld';

export function setActiveWorld(world) {
  activeWorld = world;
  localStorage.setItem('activeWorld', world);
}

export function getActiveWorld() {
  return activeWorld;
}

const IS_ELECTRON = typeof window !== 'undefined' && !!window.electronAPI;

// ── Markdown helpers ──────────────────────────────────────────────────────────

function serializeToMd(data, content = '') {
  let frontmatter = '---\n';
  for (const [key, value] of Object.entries(data)) {
    frontmatter += `${key}: ${JSON.stringify(value)}\n`;
  }
  frontmatter += '---\n\n';
  return frontmatter + content;
}

function parseMd(fileContent) {
  const match = fileContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { data: {}, content: fileContent };
  const data = {};
  for (const line of match[1].split('\n')) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    try { value = JSON.parse(value); } catch { /* keep raw */ }
    data[key] = value;
  }
  return { data, content: match[2].trim() };
}

// ── Web fetch helper ──────────────────────────────────────────────────────────

async function fsApi(action, payload) {
  const isRead = action === 'read';
  const url = isRead
    ? `/api/fs/read?path=${encodeURIComponent(payload.path)}`
    : `/api/fs/${action}`;
  const res = await fetch(url, {
    method: isRead ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...(isRead ? {} : { body: JSON.stringify(payload) }),
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(await res.text());
  }
  return res.json();
}

// ── dbService ─────────────────────────────────────────────────────────────────

export const dbService = {
  async getWorlds() {
    if (IS_ELECTRON) {
      const data = await window.electronAPI.listWorlds();
      return data.worlds || [];
    }
    const res = await fetch('/api/worlds/list');
    if (res.ok) return (await res.json()).worlds || [];
    return [];
  },

  async createWorld(name) {
    if (IS_ELECTRON) {
      const data = await window.electronAPI.createWorld(name);
      return data.world;
    }
    const res = await fetch('/api/worlds/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return (await res.json()).world;
    return null;
  },

  async deleteWorld(name) {
    if (IS_ELECTRON) {
      await window.electronAPI.deleteWorld(name);
      return true;
    }
    const res = await fetch('/api/worlds/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (res.ok) return true;
    throw new Error(await res.text());
  },

  async runBackup(location, world, retentionDays = 30) {
    if (IS_ELECTRON) {
      return window.electronAPI.runBackup({ location, activeWorld: world, retentionDays });
    }
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, activeWorld: world, retentionDays }),
    });
    if (res.ok) return res.json();
    throw new Error(await res.text());
  },

  async getAll(storeName) {
    if (IS_ELECTRON) {
      const dirPath = `${activeWorld}/${storeName}`;
      const result = await window.electronAPI.fsRead(dirPath);
      if (!result || !result.isDir) return [];
      const results = await Promise.all(
        result.files.filter(f => f.endsWith('.md')).map(async fileName => {
          const fileRes = await window.electronAPI.fsRead(`${dirPath}/${fileName}`);
          if (!fileRes || fileRes.isDir) return null;
          const { data, content } = parseMd(fileRes.content);
          return { ...data, content, id: data.id || fileName.replace('.md', '') };
        })
      );
      return results.filter(Boolean);
    }
    const dirPath = `${activeWorld}/${storeName}`;
    const result = await fsApi('read', { path: dirPath }).catch(() => null);
    if (!result || !result.isDir) return [];
    const results = await Promise.all(
      result.files.filter(f => f.endsWith('.md')).map(fileName =>
        fsApi('read', { path: `${dirPath}/${fileName}` }).then(fileRes => {
          if (!fileRes || fileRes.isDir) return null;
          const { data, content } = parseMd(fileRes.content);
          return { ...data, content, id: data.id || fileName.replace('.md', '') };
        }).catch(() => null)
      )
    );
    return results.filter(Boolean);
  },

  async get(storeName, id) {
    if (IS_ELECTRON) {
      const fileRes = await window.electronAPI.fsRead(`${activeWorld}/${storeName}/${id}.md`);
      if (!fileRes || fileRes.isDir) return null;
      const { data, content } = parseMd(fileRes.content);
      return { ...data, content, id };
    }
    const fileRes = await fsApi('read', { path: `${activeWorld}/${storeName}/${id}.md` });
    if (!fileRes || fileRes.isDir) return null;
    const { data, content } = parseMd(fileRes.content);
    return { ...data, content, id };
  },

  async put(storeName, item) {
    item.updatedAt = Date.now();
    if (!item.createdAt) item.createdAt = Date.now();
    if (!item.id) item.id = uuidv4();
    const content = item.content || '';
    const dataToSave = { ...item };
    delete dataToSave.content;
    const mdString = serializeToMd(dataToSave, content);
    const filePath = `${activeWorld}/${storeName}/${item.id}.md`;
    if (IS_ELECTRON) {
      await window.electronAPI.fsWrite(filePath, mdString);
    } else {
      await fsApi('write', { filePath, content: mdString });
    }
    return item;
  },

  async delete(storeName, id) {
    const filePath = `${activeWorld}/${storeName}/${id}.md`;
    if (IS_ELECTRON) {
      await window.electronAPI.fsDelete(filePath);
    } else {
      await fsApi('delete', { filePath });
    }
    return true;
  },

  async listTrash(worldName) {
    if (IS_ELECTRON) {
      const data = await window.electronAPI.trashList(worldName);
      return data.items || [];
    }
    const res = await fetch(`/api/fs/trash/list?world=${encodeURIComponent(worldName)}`);
    if (!res.ok) throw new Error(await res.text());
    return (await res.json()).items || [];
  },

  async restoreFromTrash(trashPath) {
    if (IS_ELECTRON) return window.electronAPI.trashRestore(trashPath);
    const res = await fetch('/api/fs/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trashPath }),
    });
    if (!res.ok) {
      const t = await res.text();
      try { throw new Error(JSON.parse(t).error || t); } catch { throw new Error(t); }
    }
    return res.json();
  },

  async purgeTrashItem(trashPath) {
    if (IS_ELECTRON) return window.electronAPI.trashPurge(trashPath);
    const res = await fetch('/api/fs/trash/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: trashPath }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};
