import { v4 as uuidv4 } from 'uuid';

let activeWorld = localStorage.getItem('activeWorld') || 'DefaultWorld';

export function setActiveWorld(world) {
  activeWorld = world;
  localStorage.setItem('activeWorld', world);
}

export function getActiveWorld() {
  return activeWorld;
}

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

// ── dbService ─────────────────────────────────────────────────────────────────

export const dbService = {
  async getWorlds() {
    const data = await window.electronAPI.listWorlds();
    return data.worlds || [];
  },

  async createWorld(name) {
    const data = await window.electronAPI.createWorld(name);
    return data.world;
  },

  async deleteWorld(name) {
    await window.electronAPI.deleteWorld(name);
    return true;
  },

  async runBackup(location, world, retentionDays = 30) {
    return window.electronAPI.runBackup({ location, activeWorld: world, retentionDays });
  },

  async getAll(storeName) {
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
  },

  async get(storeName, id) {
    const fileRes = await window.electronAPI.fsRead(`${activeWorld}/${storeName}/${id}.md`);
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
    await window.electronAPI.fsWrite(`${activeWorld}/${storeName}/${item.id}.md`, mdString);
    return item;
  },

  async delete(storeName, id) {
    await window.electronAPI.fsDelete(`${activeWorld}/${storeName}/${id}.md`);
    return true;
  },

  async listTrash(worldName) {
    const data = await window.electronAPI.trashList(worldName);
    return data.items || [];
  },

  async restoreFromTrash(trashPath) {
    return window.electronAPI.trashRestore(trashPath);
  },

  async purgeTrashItem(trashPath) {
    return window.electronAPI.trashPurge(trashPath);
  },
};
