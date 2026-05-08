// db.js handles API calls to our local Vite fs plugin instead of IndexedDB
import { v4 as uuidv4 } from 'uuid';

let activeWorld = localStorage.getItem('activeWorld') || 'DefaultWorld';

export function setActiveWorld(world) {
  activeWorld = world;
  localStorage.setItem('activeWorld', world);
}

export function getActiveWorld() {
  return activeWorld;
}

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
  const lines = match[1].split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const idx = line.indexOf(':');
    if (idx !== -1) {
      const key = line.slice(0, idx).trim();
      let value = line.slice(idx + 1).trim();
      try { value = JSON.parse(value); } catch { /* keep raw string */ }
      data[key] = value;
    }
  }
  return { data, content: match[2].trim() };
}

// Helper to make API calls to our Vite fs plugin
async function fsApi(action, payload) {
  const passcode = localStorage.getItem('passcode') || '';
  const isRead = action === 'read';
  const url = isRead ? `/api/fs/read?path=${encodeURIComponent(payload.path)}` : `/api/fs/${action}`;
  
  const options = {
    method: isRead ? 'GET' : 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'X-Passcode': passcode
    },
    ...(isRead ? {} : { body: JSON.stringify(payload) })
  };

  const res = await fetch(url, options);
  if (!res.ok) {
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (res.status === 404) return null; // File not found
    throw new Error(await res.text());
  }
  return res.json();
}

import { browserDbService, isConnected } from './browserFs';

export const dbService = {
  async getWorlds() {
    if (isConnected()) return browserDbService.getWorlds();
    const passcode = localStorage.getItem('passcode') || '';
    const res = await fetch('/api/worlds/list', {
      headers: { 'X-Passcode': passcode }
    });
    if (res.ok) {
      const data = await res.json();
      return data.worlds || [];
    }
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    return [];
  },

  async createWorld(name) {
    if (isConnected()) return browserDbService.createWorld(name);
    const passcode = localStorage.getItem('passcode') || '';
    const res = await fetch('/api/worlds/create', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Passcode': passcode 
      },
      body: JSON.stringify({ name })
    });
    if (res.ok) {
      const data = await res.json();
      return data.world;
    }
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    return null;
  },

  async deleteWorld(name, passcode) {
    if (isConnected()) return browserDbService.deleteWorld(name);
    const res = await fetch('/api/worlds/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Passcode': passcode
      },
      body: JSON.stringify({ name, passcode })
    });
    if (res.ok) {
      return true;
    }
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(await res.text());
  },

  async runBackup(location, passcode, activeWorld, retentionDays = 30) {
    if (isConnected()) throw new Error('Backups are currently not supported in Browser Mode.');
    const res = await fetch('/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Passcode': passcode
      },
      body: JSON.stringify({ location, passcode, activeWorld, retentionDays })
    });
    if (res.ok) {
      const data = await res.json();
      return data;
    }
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    throw new Error(await res.text());
  },

  async getAll(storeName) {
    if (isConnected()) return browserDbService.getAll(activeWorld, storeName);
    const dirPath = `${activeWorld}/${storeName}`;
    const result = await fsApi('read', { path: dirPath }).catch(() => null);

    if (!result || !result.isDir) return [];

    const mdFiles = result.files.filter(f => f.endsWith('.md'));
    const results = await Promise.all(
      mdFiles.map(fileName => fsApi('read', { path: `${dirPath}/${fileName}` }).then(fileRes => {
        if (fileRes && !fileRes.isDir) {
          const { data, content } = parseMd(fileRes.content);
          return { ...data, content, id: data.id || fileName.replace('.md', '') };
        }
        return null;
      }).catch(() => null))
    );
    return results.filter(Boolean);
  },
  
  async get(storeName, id) {
    if (isConnected()) return browserDbService.get(activeWorld, storeName, id);
    const filePath = `${activeWorld}/${storeName}/${id}.md`;
    const fileRes = await fsApi('read', { path: filePath });
    if (fileRes && !fileRes.isDir) {
      const { data, content } = parseMd(fileRes.content);
      return { ...data, content, id };
    }
    return null;
  },
  
  async put(storeName, item) {
    if (isConnected()) return browserDbService.put(activeWorld, storeName, item);
    item.updatedAt = Date.now();
    if (!item.createdAt) item.createdAt = Date.now();
    if (!item.id) item.id = uuidv4();
    
    const content = item.content || '';
    const dataToSave = { ...item };
    delete dataToSave.content;

    const mdString = serializeToMd(dataToSave, content);
    
    const filePath = `${activeWorld}/${storeName}/${item.id}.md`;
    await fsApi('write', { filePath, content: mdString });
    return item;
  },
  
  async delete(storeName, id) {
    if (isConnected()) return browserDbService.delete(activeWorld, storeName, id);
    const filePath = `${activeWorld}/${storeName}/${id}.md`;
    await fsApi('delete', { filePath });
    return true;
  },

  async listTrash(worldName) {
    if (isConnected()) return []; // Trash not yet implemented for Browser Mode
    const passcode = localStorage.getItem('passcode') || '';
    const res = await fetch(`/api/fs/trash/list?world=${encodeURIComponent(worldName)}`, {
      headers: { 'X-Passcode': passcode },
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      throw new Error(await res.text());
    }
    const data = await res.json();
    return data.items || [];
  },

  async restoreFromTrash(trashPath) {
    if (isConnected()) return null;
    const passcode = localStorage.getItem('passcode') || '';
    const res = await fetch('/api/fs/trash/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Passcode': passcode },
      body: JSON.stringify({ path: trashPath }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      const t = await res.text();
      try {
        const j = JSON.parse(t);
        throw new Error(j.error || t);
      } catch {
        throw new Error(t);
      }
    }
    return res.json();
  },

  async purgeTrashItem(trashPath) {
    if (isConnected()) return null;
    const passcode = localStorage.getItem('passcode') || '';
    const res = await fetch('/api/fs/trash/purge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Passcode': passcode },
      body: JSON.stringify({ path: trashPath }),
    });
    if (!res.ok) {
      if (res.status === 401) throw new Error('UNAUTHORIZED');
      throw new Error(await res.text());
    }
    return res.json();
  },
};
