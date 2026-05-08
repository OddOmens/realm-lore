import { create } from 'zustand';
import { dbService, getActiveWorld } from './db';
import { v4 as uuidv4 } from 'uuid';

export const useWorldStore = create((set, get) => ({
  worlds: [],
  activeWorld: 'DefaultWorld',
  characters: [],
  locations: [],
  things: [],
  lore: [],
  factions: [],
  creatures: [],
  races: [],
  stories: [],
  relationships: [],
  maps: [],
  books: [],
  customStamps: [],
  isLoading: true,
  mobileMenuOpen: false,
  isAuthenticated: !!localStorage.getItem('passcode'),
  backupConfig: {
    location: localStorage.getItem('backupLocation') || 'Backups',
    frequency: parseInt(localStorage.getItem('backupFreq') || '0', 10), // in minutes, 0 = off
    retentionDays: parseInt(localStorage.getItem('backupRetentionDays') || '30', 10), // 0 = keep forever
    lastBackupAt: localStorage.getItem('backupLastAt') || null, // ISO string
  },
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  login: (passcode) => {
    localStorage.setItem('passcode', passcode);
    set({ isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('passcode');
    set({ isAuthenticated: false });
  },

  // Load everything from IDB on startup
  initialize: async () => {
    set({ isLoading: true });

    try {
      const passcode = localStorage.getItem('passcode');
      if (passcode === 'browser-mode') {
        const { tryReconnectLocalFolder } = await import('./browserFs');
        const reconnected = await tryReconnectLocalFolder();
        if (!reconnected) {
          get().logout();
          set({ isLoading: false });
          return;
        }
      }

      const { getActiveWorld, setActiveWorld } = await import('./db');

      const worlds = await dbService.getWorlds();
      if (worlds.length === 0) {
         await dbService.createWorld('DefaultWorld');
         worlds.push('DefaultWorld');
      }

      let current = getActiveWorld();
      if (!worlds.includes(current)) {
        current = worlds[0];
        setActiveWorld(current);
      }

      const [characters, locations, things, lore, factions, creatures, races, stories, relationships, rawMaps, books, customStamps] = await Promise.all([
        dbService.getAll('characters'),
        dbService.getAll('locations'),
        dbService.getAll('things'),
        dbService.getAll('lore'),
        dbService.getAll('factions'),
        dbService.getAll('creatures'),
        dbService.getAll('races'),
        dbService.getAll('stories'),
        dbService.getAll('relationships'),
        dbService.getAll('maps'),
        dbService.getAll('books'),
        dbService.getAll('customStamps'),
      ]);

      // Resolve local image references for maps
      const maps = await Promise.all(rawMaps.map(async m => {
        if (m.image && m.image.startsWith('__local__')) {
          const imgId = m.image.replace('__local__', '');
          const res = await fetch(`/api/fs/read?path=${encodeURIComponent(`${current}/maps/${imgId}.img`)}`).catch(() => null);
          if (res?.ok) {
            const data = await res.json();
            return { ...m, image: data.content || m.image };
          }
        }
        return m;
      }));

      set({ worlds, activeWorld: current, characters, locations, things, lore, factions, creatures, races, stories, relationships, maps, books, customStamps, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      if (error.message === 'UNAUTHORIZED') {
        // Drop the stored passcode/auth flag and let the caller (Login) react to the throw.
        get().logout();
        throw error;
      }
      console.error("Failed to load generic data", error);
    }
  },

  switchWorld: async (worldName) => {
    const { setActiveWorld } = await import('./db');
    setActiveWorld(worldName);
    set({ activeWorld: worldName, isLoading: true });

    const [characters, locations, things, lore, factions, creatures, races, stories, relationships, rawMaps, books, customStamps] = await Promise.all([
        dbService.getAll('characters'),
        dbService.getAll('locations'),
        dbService.getAll('things'),
        dbService.getAll('lore'),
        dbService.getAll('factions'),
        dbService.getAll('creatures'),
        dbService.getAll('races'),
        dbService.getAll('stories'),
        dbService.getAll('relationships'),
        dbService.getAll('maps'),
        dbService.getAll('books'),
        dbService.getAll('customStamps'),
    ]);
    const maps = await Promise.all(rawMaps.map(async m => {
      if (m.image && m.image.startsWith('__local__')) {
        const imgId = m.image.replace('__local__', '');
        const res = await fetch(`/api/fs/read?path=${encodeURIComponent(`${worldName}/maps/${imgId}.img`)}`).catch(() => null);
        if (res?.ok) { const data = await res.json(); return { ...m, image: data.content || m.image }; }
      }
      return m;
    }));
    set({ characters, locations, things, lore, factions, creatures, races, stories, relationships, maps, books, customStamps, isLoading: false });
  },

  createWorld: async (name) => {
    const safeName = await dbService.createWorld(name);
    if (safeName) {
      const worlds = await dbService.getWorlds();
      set({ worlds });
      get().switchWorld(safeName);
    }
  },

  deleteWorld: async (name, passcode) => {
    const success = await dbService.deleteWorld(name, passcode);
    if (success) {
      const worlds = await dbService.getWorlds();
      set({ worlds });
      if (get().activeWorld === name) {
        if (worlds.length > 0) {
          get().switchWorld(worlds[0]);
        } else {
          await get().createWorld('DefaultWorld');
        }
      }
    }
  },

  updateBackupConfig: (newConfig) => {
    set((state) => {
      const config = { ...state.backupConfig, ...newConfig };
      localStorage.setItem('backupLocation', config.location);
      localStorage.setItem('backupFreq', String(config.frequency));
      localStorage.setItem('backupRetentionDays', String(config.retentionDays));
      if (config.lastBackupAt) localStorage.setItem('backupLastAt', config.lastBackupAt);
      return { backupConfig: config };
    });
  },

  triggerBackup: async () => {
    const passcode = localStorage.getItem('passcode') || '';
    const config = get().backupConfig;
    const activeWorld = get().activeWorld;
    if (!config.location || !activeWorld) return;
    const result = await dbService.runBackup(
      config.location,
      passcode,
      activeWorld,
      config.retentionDays,
    );
    if (result?.success) {
      const stamp = result.timestamp || new Date().toISOString();
      localStorage.setItem('backupLastAt', stamp);
      set(state => ({ backupConfig: { ...state.backupConfig, lastBackupAt: stamp } }));
    }
    return result;
  },

  // Generic functions
  addEntity: async (type, data) => {
    const newEntity = {
      id: uuidv4(),
      ...data,
    };
    const saved = await dbService.put(type, newEntity);
    set((state) => ({
      [type]: [...state[type], saved]
    }));
    return saved;
  },

  updateEntity: async (type, id, data) => {
    const existing = get()[type].find(e => e.id === id);
    if (!existing) return null;

    const updated = { ...existing, ...data };
    const saved = await dbService.put(type, updated);

    set((state) => ({
      [type]: state[type].map(e => e.id === id ? saved : e)
    }));
    return saved;
  },

  // Rename an entity AND replace all [[OldName]] → [[NewName]] tags across every
  // content-bearing collection in the world (stories, characters, locations, things, lore).
  // extraData: any additional field updates to merge into the renamed entity on save.
  renameEntityAcrossLibrary: async (type, id, oldName, newName, extraData = {}) => {
    if (!oldName || !newName || oldName === newName) {
      // Just a normal update if the name didn't really change
      return get().updateEntity(type, id, { name: newName, ...extraData });
    }

    const oldTag = `[[${oldName}]]`;
    const newTag = `[[${newName}]]`;
    const CONTENT_TYPES = ['stories', 'characters', 'locations', 'things', 'lore', 'factions', 'creatures', 'races'];
    // All prose fields that can contain [[references]] across entity types
    const PROSE_FIELDS = [
      'content', 'description', 'background', 'personality', 'appearance',
      'motivation', 'abilities', 'weaknesses', 'notes', 'atmosphere', 'secrets',
      'history', 'goals', 'origin', 'doctrine', 'culture', 'behavior',
      'diet', 'habitat', 'resources', 'membership',
    ];
    const state = get();

    // Collect every entity that contains the old tag in any prose field
    const updates = [];
    for (const collectionType of CONTENT_TYPES) {
      const collection = state[collectionType] || [];
      for (const entity of collection) {
        const patch = {};
        for (const field of PROSE_FIELDS) {
          if (entity[field] && entity[field].includes(oldTag)) {
            patch[field] = entity[field].split(oldTag).join(newTag);
          }
        }
        if (Object.keys(patch).length > 0) {
          updates.push({ collectionType, entity: { ...entity, ...patch } });
        }
      }
    }

    // Persist every changed entity to disk (skip the renamed entity itself — handled below)
    await Promise.all(
      updates
        .filter(({ collectionType, entity: e }) => !(collectionType === type && e.id === id))
        .map(({ collectionType, entity: e }) => dbService.put(collectionType, e))
    );

    // Update in-memory state for all affected collections at once
    const statePatches = {};
    for (const { collectionType, entity } of updates) {
      if (!statePatches[collectionType]) statePatches[collectionType] = [...(state[collectionType] || [])];
      statePatches[collectionType] = statePatches[collectionType].map(e =>
        e.id === entity.id ? entity : e
      );
    }

    // Now rename the entity itself — start from the already-patched version if it
    // was in the updates list (so field replacements aren't overwritten by existing)
    const alreadyPatched = updates.find(u => u.collectionType === type && u.entity.id === id);
    const base = alreadyPatched ? alreadyPatched.entity : state[type].find(e => e.id === id);
    if (base) {
      const renamed = { ...base, ...extraData, name: newName };
      const saved = await dbService.put(type, renamed);
      if (!statePatches[type]) statePatches[type] = [...(state[type] || [])];
      statePatches[type] = statePatches[type].map(e => e.id === id ? saved : e);
    }

    set(statePatches);
    return updates.length;
  },

  deleteEntity: async (type, id) => {
    await dbService.delete(type, id);

    // Cascade-delete every relationship that references this entity so we
    // don't leave orphaned rows on disk that would render as ghosts in any
    // future "all relationships" view.
    const orphanRels = get().relationships.filter(r => r.fromId === id || r.toId === id);
    await Promise.all(orphanRels.map(r => dbService.delete('relationships', r.id)));

    // Also strip the deleted entity from any map pins / protagonist marker so
    // the user never sees a "ghost" pin pointing nowhere.
    const mapsToTouch = get().maps.filter(m =>
      (m.pins || []).some(p => p.entityId === id) ||
      (m.protagonist && m.protagonist.entityId === id)
    );
    await Promise.all(mapsToTouch.map(m => {
      const cleaned = {
        ...m,
        pins: (m.pins || []).filter(p => p.entityId !== id),
        protagonist: (m.protagonist && m.protagonist.entityId === id) ? null : m.protagonist,
      };
      // Persist a disk-friendly copy that points at the on-disk image file
      // rather than the resolved data URL we keep in memory.
      const diskVersion = { ...cleaned, image: `__local__${m.id}` };
      return dbService.put('maps', diskVersion);
    }));

    set((state) => ({
      [type]: state[type].filter(e => e.id !== id),
      relationships: state.relationships.filter(r => r.fromId !== id && r.toId !== id),
      maps: state.maps.map(m => {
        if (!mapsToTouch.find(t => t.id === m.id)) return m;
        return {
          ...m,
          pins: (m.pins || []).filter(p => p.entityId !== id),
          protagonist: (m.protagonist && m.protagonist.entityId === id) ? null : m.protagonist,
        };
      }),
    }));
  },

  saveMap: async (mapData) => {
    const id = mapData.id || uuidv4();
    let imageRef = mapData.image;
    if (mapData.image && mapData.image.startsWith('data:')) {
      await fetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: `${getActiveWorld()}/maps/${id}.img`, content: mapData.image }),
      });
      imageRef = `__local__${id}`;
    }
    const toSave = { ...mapData, id, image: imageRef };
    const saved = await dbService.put('maps', toSave);
    const inMemory = { ...saved, image: mapData.image };
    set(state => {
      const exists = state.maps.find(m => m.id === saved.id);
      return { maps: exists ? state.maps.map(m => m.id === saved.id ? inMemory : m) : [...state.maps, inMemory] };
    });
    return inMemory;
  },

  deleteMap: async (id) => {
    await dbService.delete('maps', id);
    await fetch('/api/fs/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: `${getActiveWorld()}/maps/${id}.img` }),
    }).catch(() => {});
    set(state => ({ maps: state.maps.filter(m => m.id !== id) }));
  },

  // Partial update for everything that ISN'T the image (pins, name, description,
  // protagonist marker). This avoids re-writing the multi-MB image file every
  // time the user nudges a pin. The on-disk record always points at the
  // image-file reference (`__local__<id>`) while in-memory keeps the resolved
  // data URL so previews stay snappy.
  updateMapMeta: async (id, updates) => {
    const existing = get().maps.find(m => m.id === id);
    if (!existing) return null;
    const merged = { ...existing, ...updates };
    const diskVersion = { ...merged, image: `__local__${id}` };
    await dbService.put('maps', diskVersion);
    set(state => ({ maps: state.maps.map(m => m.id === id ? merged : m) }));
    return merged;
  },

  addRelationship: async (fromId, fromType, toId, toType, label) => {
    const rel = { id: uuidv4(), fromId, fromType, toId, toType, label };
    await dbService.put('relationships', rel);
    set(state => ({ relationships: [...state.relationships, rel] }));
    return rel;
  },

  deleteRelationship: async (id) => {
    await dbService.delete('relationships', id);
    set(state => ({ relationships: state.relationships.filter(r => r.id !== id) }));
  },

  addBook: async (data) => {
    const newBook = { id: uuidv4(), ...data };
    const saved = await dbService.put('books', newBook);
    set((state) => ({ books: [...state.books, saved] }));
    return saved;
  },

  updateBook: async (id, data) => {
    const existing = get().books.find(b => b.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...data };
    const saved = await dbService.put('books', updated);
    set((state) => ({ books: state.books.map(b => b.id === id ? saved : b) }));
    return saved;
  },

  deleteBook: async (id) => {
    await dbService.delete('books', id);
    const affectedStories = get().stories.filter(s => s.bookId === id);
    await Promise.all(affectedStories.map(s => dbService.put('stories', { ...s, bookId: null, chapterNumber: null })));
    set((state) => ({
      books: state.books.filter(b => b.id !== id),
      stories: state.stories.map(s => s.bookId === id ? { ...s, bookId: null, chapterNumber: null } : s),
    }));
  },

  addCustomStamp: async ({ name, tags = [], svg, color = null }) => {
    const now = new Date().toISOString();
    const stamp = {
      id: uuidv4(),
      name: (name || 'Untitled').trim(),
      tags: Array.isArray(tags) ? tags.map(t => String(t).trim()).filter(Boolean) : [],
      svg: typeof svg === 'string' ? svg : '',
      color: color || null,
      createdAt: now,
      updatedAt: now,
    };
    const saved = await dbService.put('customStamps', stamp);
    set(state => ({ customStamps: [...state.customStamps, saved] }));
    return saved;
  },

  updateCustomStamp: async (id, patch) => {
    const existing = get().customStamps.find(s => s.id === id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    const saved = await dbService.put('customStamps', updated);
    set(state => ({ customStamps: state.customStamps.map(s => s.id === id ? saved : s) }));
    return saved;
  },

  deleteCustomStamp: async (id) => {
    await dbService.delete('customStamps', id);
    set(state => ({ customStamps: state.customStamps.filter(s => s.id !== id) }));
  },

  reorderChapters: async (bookId, orderedIds) => {
    const stories = get().stories;
    const reordered = orderedIds.map((id, index) => {
      const s = stories.find(s => s.id === id);
      return { ...s, chapterNumber: index + 1 };
    });
    await Promise.all(reordered.map(s => dbService.put('stories', s)));
    set((state) => ({
      stories: state.stories.map(s => {
        const updated = reordered.find(r => r.id === s.id);
        return updated || s;
      }),
    }));
  },

  reorderStories: async (orderedIds) => {
    const stories = get().stories;
    const reordered = orderedIds.map((id, index) => {
      const s = stories.find(s => s.id === id);
      return { ...s, order: index };
    });
    await Promise.all(reordered.map(s => dbService.put('stories', s)));
    set({ stories: reordered });
  },

  /** Soft-deleted entities live under `{world}/trash/{collection}/{id}.md`. */
  listTrashItems: async () => dbService.listTrash(get().activeWorld),

  restoreTrashEntry: async (trashPath) => {
    await dbService.restoreFromTrash(trashPath);
    await get().switchWorld(get().activeWorld);
  },

  purgeTrashEntry: async (trashPath) => {
    await dbService.purgeTrashItem(trashPath);
  },
}));
