import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

// Central event bus shared between all plugins and the app
export const pluginBus = new EventEmitter();
pluginBus.setMaxListeners(100);

let loadedPlugins = [];

function readManifest(dir) {
  const manifestPath = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestPath)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    if (!raw.id || !raw.name || !raw.version) return null;
    return raw;
  } catch {
    return null;
  }
}

function buildPluginAPI(manifest, worldsDir, pluginDir) {
  return {
    id: manifest.id,
    _pluginDir: pluginDir,
    _uiPanels: [],   // { panelId, panelFile, navLabel, navIcon }

    // Event bus — plugins can emit and listen to named events
    on:   (event, handler) => pluginBus.on(`plugin:${event}`, handler),
    off:  (event, handler) => pluginBus.off(`plugin:${event}`, handler),
    emit: (event, data)    => pluginBus.emit(`plugin:${event}`, data),

    // Hooks the app calls — plugins register by name
    hooks: {},
    registerHook(hookName, fn) {
      this.hooks[hookName] = fn;
    },

    // Register a sidebar panel. panelFile is relative to the plugin dir.
    // navIcon is any lucide icon name (e.g. "BarChart2").
    registerPanel({ panelId, panelFile, navLabel, navIcon = 'Puzzle' }) {
      this._uiPanels.push({ panelId, panelFile, navLabel, navIcon, pluginDir });
    },

    // Read/write access scoped to the worlds directory
    fs: {
      readFile(relPath) {
        const full = path.resolve(worldsDir, relPath);
        if (!full.startsWith(worldsDir)) throw new Error('Forbidden path');
        return fs.readFileSync(full, 'utf-8');
      },
      writeFile(relPath, content) {
        const full = path.resolve(worldsDir, relPath);
        if (!full.startsWith(worldsDir)) throw new Error('Forbidden path');
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, 'utf-8');
      },
      exists(relPath) {
        const full = path.resolve(worldsDir, relPath);
        if (!full.startsWith(worldsDir)) return false;
        return fs.existsSync(full);
      },
    },

    log(...args) {
      console.log(`[Plugin: ${manifest.id}]`, ...args);
    },

    // Write a line to a persistent log file at <worldsDir>/.plugin-logs/<pluginId>.log
    writeLog(message) {
      try {
        const logDir = path.join(worldsDir, '.plugin-logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        const line = `[${new Date().toISOString()}] ${message}\n`;
        fs.appendFileSync(path.join(logDir, `${manifest.id}.log`), line);
      } catch { /* never crash a plugin over logging */ }
    },
  };
}

export async function loadPlugins({ pluginsDir, worldsDir, enabledIds, pluginsEnabled }) {
  // Unload previously loaded plugins
  for (const p of loadedPlugins) {
    try { p.instance?.onUnload?.(); } catch { /* ignore */ }
  }
  loadedPlugins = [];

  if (!pluginsEnabled) return [];
  if (!fs.existsSync(pluginsDir)) return [];

  const entries = fs.readdirSync(pluginsDir);

  for (const entry of entries) {
    const dir = path.join(pluginsDir, entry);
    if (!fs.statSync(dir).isDirectory()) continue;

    const manifest = readManifest(dir);
    if (!manifest) continue;

    const isEnabled = enabledIds.includes(manifest.id);
    if (!isEnabled) continue;

    const mainFile = path.join(dir, manifest.main || 'main.js');
    if (!fs.existsSync(mainFile)) continue;

    try {
      // Dynamic import — ESM plugins only
      const mod = await import(`file://${mainFile}?t=${Date.now()}`);
      const api = buildPluginAPI(manifest, worldsDir, dir);
      await mod.default?.onLoad?.(api);
      loadedPlugins.push({ manifest, instance: mod.default, api });
    } catch (err) {
      console.error(`[PluginLoader] Failed to load "${manifest.id}":`, err.message);
    }
  }

  return loadedPlugins.map(p => ({
    id: p.manifest.id,
    name: p.manifest.name,
    version: p.manifest.version,
    description: p.manifest.description || '',
    author: p.manifest.author || '',
    panels: p.api._uiPanels,
  }));
}

export function scanPlugins(pluginsDir) {
  if (!fs.existsSync(pluginsDir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(pluginsDir)) {
    const dir = path.join(pluginsDir, entry);
    if (!fs.statSync(dir).isDirectory()) continue;
    const manifest = readManifest(dir);
    if (!manifest) continue;
    results.push({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description || '',
      author: manifest.author || '',
    });
  }
  return results;
}

// Called by main process IPC handlers to fire hooks across all loaded plugins
export async function callHook(hookName, payload) {
  const results = [];
  for (const { api } of loadedPlugins) {
    if (typeof api.hooks[hookName] === 'function') {
      try {
        const result = await api.hooks[hookName](payload);
        results.push({ id: api.id, result });
      } catch (err) {
        console.error(`[PluginLoader] Hook "${hookName}" failed in "${api.id}":`, err.message);
      }
    }
  }
  return results;
}
