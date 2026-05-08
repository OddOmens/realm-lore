import { v4 as uuidv4 } from 'uuid';
import { openDB } from 'idb';

let rootHandle = null;

const dbPromise = openDB('fs-handle-store', 1, {
  upgrade(db) {
    db.createObjectStore('handles');
  },
});

export async function connectLocalFolder() {
  try {
    rootHandle = await window.showDirectoryPicker({
      id: 'fantasy-world-builder',
      mode: 'readwrite',
    });
    const db = await dbPromise;
    await db.put('handles', rootHandle, 'root');
    return true;
  } catch (err) {
    console.error('User cancelled folder selection', err);
    return false;
  }
}

export async function tryReconnectLocalFolder() {
  try {
    const db = await dbPromise;
    const handle = await db.get('handles', 'root');
    if (handle) {
      // Check if we already have permission
      if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
        rootHandle = handle;
        return true;
      }
      // If not, ask the browser to prompt the user (this must be triggered by a user action like clicking a button initially, or it will throw an error, but some browsers allow it on page load if they interacted previously)
      if ((await handle.requestPermission({ mode: 'readwrite' })) === 'granted') {
        rootHandle = handle;
        return true;
      }
    }
  } catch (e) {
    console.error('Failed to verify folder permission', e);
  }
  return false;
}

export function isConnected() {
  return rootHandle !== null;
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

export const browserDbService = {
  async getWorlds() {
    if (!rootHandle) return [];
    const worlds = [];
    for await (const entry of rootHandle.values()) {
      if (entry.kind === 'directory' && !entry.name.startsWith('.') && !entry.name.startsWith('_')) {
        worlds.push(entry.name);
      }
    }
    return worlds;
  },

  async createWorld(name) {
    if (!rootHandle) throw new Error('Not connected');
    const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '_');
    const worldDir = await rootHandle.getDirectoryHandle(safeName, { create: true });
    
    const folders = ['characters', 'locations', 'things', 'lore', 'factions', 'creatures', 'stories', 'relationships', 'maps', 'books', 'customStamps', 'trash'];
    for (const folder of folders) {
      await worldDir.getDirectoryHandle(folder, { create: true });
    }
    return safeName;
  },

  async deleteWorld(name) {
    if (!rootHandle) throw new Error('Not connected');
    await rootHandle.removeEntry(name, { recursive: true });
    return true;
  },

  async getAll(activeWorld, storeName) {
    if (!rootHandle) return [];
    try {
      const worldDir = await rootHandle.getDirectoryHandle(activeWorld);
      const storeDir = await worldDir.getDirectoryHandle(storeName);
      
      const results = [];
      for await (const entry of storeDir.values()) {
        if (entry.kind === 'file' && entry.name.endsWith('.md')) {
          const file = await entry.getFile();
          const text = await file.text();
          const { data, content } = parseMd(text);
          results.push({ ...data, content, id: data.id || entry.name.replace('.md', '') });
        }
      }
      return results;
    } catch (e) {
      return [];
    }
  },

  async get(activeWorld, storeName, id) {
    if (!rootHandle) return null;
    try {
      const worldDir = await rootHandle.getDirectoryHandle(activeWorld);
      const storeDir = await worldDir.getDirectoryHandle(storeName);
      const fileHandle = await storeDir.getFileHandle(`${id}.md`);
      const file = await fileHandle.getFile();
      const text = await file.text();
      const { data, content } = parseMd(text);
      return { ...data, content, id };
    } catch (e) {
      return null;
    }
  },

  async put(activeWorld, storeName, item) {
    if (!rootHandle) throw new Error('Not connected');
    item.updatedAt = Date.now();
    if (!item.createdAt) item.createdAt = Date.now();
    if (!item.id) item.id = uuidv4();

    const content = item.content || '';
    const dataToSave = { ...item };
    delete dataToSave.content;
    const mdString = serializeToMd(dataToSave, content);

    const worldDir = await rootHandle.getDirectoryHandle(activeWorld);
    const storeDir = await worldDir.getDirectoryHandle(storeName, { create: true });
    
    // Backup existing if needed
    try {
      const oldFileHandle = await storeDir.getFileHandle(`${item.id}.md`);
      const oldFile = await oldFileHandle.getFile();
      const backupHandle = await storeDir.getFileHandle(`${item.id}.md.bak`, { create: true });
      const writable = await backupHandle.createWritable();
      await writable.write(await oldFile.arrayBuffer());
      await writable.close();
    } catch (e) { /* no existing file */ }

    const fileHandle = await storeDir.getFileHandle(`${item.id}.md`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(mdString);
    await writable.close();

    return item;
  },

  async delete(activeWorld, storeName, id) {
    if (!rootHandle) throw new Error('Not connected');
    const worldDir = await rootHandle.getDirectoryHandle(activeWorld);
    const storeDir = await worldDir.getDirectoryHandle(storeName);
    
    // Move to trash
    try {
      const fileHandle = await storeDir.getFileHandle(`${id}.md`);
      const file = await fileHandle.getFile();
      
      const trashDir = await worldDir.getDirectoryHandle('trash', { create: true });
      const trashStoreDir = await trashDir.getDirectoryHandle(storeName, { create: true });
      
      const trashFileHandle = await trashStoreDir.getFileHandle(`${Date.now()}_${id}.md`, { create: true });
      const writable = await trashFileHandle.createWritable();
      await writable.write(await file.arrayBuffer());
      await writable.close();
      
      await storeDir.removeEntry(`${id}.md`);
    } catch (e) {
      console.error('Delete failed', e);
    }
    return true;
  }
};
