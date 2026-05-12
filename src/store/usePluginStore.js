import { create } from 'zustand';

export const usePluginStore = create((set, get) => ({
  // All plugins discovered on disk (manifest info only)
  available: [],
  // Which plugin ids are enabled
  enabledIds: [],
  // Master toggle
  pluginsEnabled: true,
  // Directory path (for display)
  pluginsDir: '',
  // UI panels registered by loaded plugins: [{ panelId, panelFile, navLabel, navIcon, pluginDir }]
  panels: [],
  // Loaded panel components keyed by panelId
  panelComponents: {},
  // Loading state
  loading: false,

  async load() {
    if (!window.electronAPI?.pluginsScan) return;
    set({ loading: true });
    try {
      const [scanResult, settings, panels] = await Promise.all([
        window.electronAPI.pluginsScan(),
        window.electronAPI.pluginsGetSettings(),
        window.electronAPI.pluginsGetPanels?.() ?? [],
      ]);
      set({
        available: scanResult.plugins || [],
        pluginsDir: scanResult.pluginsDir || '',
        enabledIds: settings.enabledIds || [],
        pluginsEnabled: settings.enabled ?? true,
        panels: panels || [],
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  async setPluginsEnabled(enabled) {
    const settings = await window.electronAPI.pluginsSetEnabled(enabled);
    set({ pluginsEnabled: settings.enabled, enabledIds: settings.enabledIds });
    await get().load();
  },

  async setPluginEnabled(id, enabled) {
    const settings = await window.electronAPI.pluginsSetPluginEnabled(id, enabled);
    set({ enabledIds: settings.enabledIds });
    await get().load();
  },

  // Dynamically load a panel component from a plugin's panel file.
  // Returns a React component or null on failure.
  async loadPanelComponent(panelId) {
    const existing = get().panelComponents[panelId];
    if (existing) return existing;

    const panel = get().panels.find(p => p.panelId === panelId);
    if (!panel || !window.electronAPI?.pluginsReadPanelFile) return null;

    try {
      const { source } = await window.electronAPI.pluginsReadPanelFile(
        panel.pluginDir,
        panel.panelFile,
      );
      // Convert to a data URL so we can dynamic-import it as ESM
      const dataUrl = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
      const mod = await import(/* @vite-ignore */ dataUrl);
      const Component = mod.default;
      set(s => ({ panelComponents: { ...s.panelComponents, [panelId]: Component } }));
      return Component;
    } catch (err) {
      console.error(`[PluginStore] Failed to load panel "${panelId}":`, err);
      return null;
    }
  },

  openPluginsDir() {
    window.electronAPI?.pluginsOpenDir?.();
  },
}));
