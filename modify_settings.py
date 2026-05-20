import sys

with open('src/pages/Settings.jsx', 'r') as f:
    code = f.read()

# 1. Add Wifi to lucide-react imports
code = code.replace(
  "FolderOpen, RefreshCw,",
  "FolderOpen, RefreshCw, Wifi,"
)

# 2. Add remote tab to TABS
code = code.replace(
  "  { id: 'plugins',    label: 'Plugins',    icon: Puzzle },\n];",
  "  { id: 'plugins',    label: 'Plugins',    icon: Puzzle },\n  { id: 'remote',     label: 'Remote',     icon: Wifi },\n];"
)

# 3. Create WorldLocationsPanel
world_locations_panel = """function WorldLocationsPanel({ activeWorld }) {
  const [settings, setSettings] = useState({ worldsDir: '', externalWorlds: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.getSettings) {
      window.electronAPI.getSettings().then(s => {
        setSettings(s);
        setLoading(false);
      });
    }
  }, []);

  const saveSettings = async (newSettings) => {
    setSettings(newSettings);
    if (window.electronAPI && window.electronAPI.saveSettings) {
      await window.electronAPI.saveSettings(newSettings);
      window.dispatchEvent(new CustomEvent('app:settings-changed'));
    }
  };

  const handleSetMaster = async () => {
    if (!window.electronAPI?.openWorldsFolder) return;
    // For simplicity, we just ask the user to type it, or we could use dialog.showOpenDialog in main.
    // Let's implement a prompt for now since we don't have a specific IPC for picking a folder safely without opening it.
    const newPath = prompt("Enter the absolute path to your new primary Worlds folder:", settings.worldsDir);
    if (newPath && newPath.trim() !== '') {
      saveSettings({ ...settings, worldsDir: newPath.trim() });
    }
  };

  const handleAddExternal = () => {
    const name = prompt("Enter a name for this external world:");
    if (!name) return;
    const pathStr = prompt(`Enter the absolute path to the folder for "${name}":`);
    if (!pathStr) return;
    const newExternal = [...(settings.externalWorlds || []), { name: name.trim(), path: pathStr.trim() }];
    saveSettings({ ...settings, externalWorlds: newExternal });
  };

  const handleRemoveExternal = (name) => {
    const newExternal = (settings.externalWorlds || []).filter(w => w.name !== name);
    saveSettings({ ...settings, externalWorlds: newExternal });
  };

  if (loading) return null;

  return (
    <SectionCard>
      <SectionHeader
        title="World Storage Locations"
        description="Manage where your worlds are saved. You can change your primary Worlds folder or link individual external folders."
      />
      
      <div className="flex flex-col gap-4 mt-2">
        {/* Master Directory */}
        <div className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
          <p className="text-sm font-semibold text-foreground">Primary Worlds Directory</p>
          <p className="text-xs text-muted-foreground">New worlds are created here.</p>
          <div className="flex items-center gap-2 mt-1">
            <code className="flex-1 text-xs font-mono text-muted-foreground bg-background rounded px-2 py-1.5 truncate">
              {settings.worldsDir || 'Default AppData'}
            </code>
            <button
              onClick={handleSetMaster}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Change
            </button>
          </div>
        </div>

        {/* External Links */}
        <div className="flex flex-col gap-2 p-3 bg-secondary/50 rounded-lg border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">External Linked Worlds</p>
              <p className="text-xs text-muted-foreground">Folders located elsewhere on your computer.</p>
            </div>
            <button
              onClick={handleAddExternal}
              className="shrink-0 text-xs font-medium px-3 py-1.5 rounded bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
            >
              Add Link
            </button>
          </div>
          
          {(settings.externalWorlds || []).length > 0 ? (
            <div className="flex flex-col gap-1.5 mt-2">
              {(settings.externalWorlds || []).map((w, i) => (
                <div key={i} className="flex items-center gap-2 bg-background p-2 rounded border border-border">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">{w.path}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveExternal(w.name)}
                    className="shrink-0 p-1.5 text-red-500 hover:bg-red-500/10 rounded transition-colors"
                    title="Remove Link"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
             <p className="text-xs text-muted-foreground italic mt-2">No external links configured.</p>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
"""
code = code.replace("function DataTab({", world_locations_panel + "\nfunction DataTab({")

# 4. Add WorldLocationsPanel to DataTab
code = code.replace(
  "<StorageInfoPanel activeWorld={activeWorld} characters={characters} locations={locations} things={things} lore={lore} stories={stories} />",
  "<WorldLocationsPanel activeWorld={activeWorld} />\n      <StorageInfoPanel activeWorld={activeWorld} characters={characters} locations={locations} things={things} lore={lore} stories={stories} />"
)

# 5. Create RemoteTab
remote_tab = """function RemoteTab() {
  const [status, setStatus] = useState({ running: false, ip: '', port: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (window.electronAPI?.getServerStatus) {
      window.electronAPI.getServerStatus().then(res => {
        if (res && res.port) {
          setStatus({ running: true, ip: res.ip, port: res.port });
        }
        setLoading(false);
      }).catch(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const toggleServer = async (start) => {
    setLoading(true);
    if (start) {
      const res = await window.electronAPI.startServer();
      if (res.success) {
        setStatus({ running: true, ip: res.ip, port: res.port });
        // Enable it in settings so it starts on boot
        const s = await window.electronAPI.getSettings();
        await window.electronAPI.saveSettings({ ...s, serverEnabled: true });
      } else {
        alert('Failed to start server: ' + res.error);
      }
    } else {
      await window.electronAPI.stopServer();
      setStatus({ running: false, ip: '', port: '' });
      // Disable in settings
      const s = await window.electronAPI.getSettings();
      await window.electronAPI.saveSettings({ ...s, serverEnabled: false });
    }
    setLoading(false);
  };

  return (
    <div className="flex flex-col gap-6">
      <SectionCard>
        <SectionHeader
          title="Remote Access (iPad/Mobile)"
          description="Host your worlds on a built-in web server. You can access this app from any device on your local Wi-Fi network."
        />
        
        <Toggle
          checked={status.running}
          onChange={val => toggleServer(val)}
          label="Enable Remote Server"
          description="When enabled, the server will also automatically start when you launch the app."
        />

        {status.running && !loading && (
          <div className="mt-4 p-4 bg-primary/10 border border-primary/20 rounded-xl flex flex-col items-center justify-center gap-2">
            <Wifi size={32} className="text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">Server is Running</p>
            <p className="text-xs text-muted-foreground text-center">
              On your iPad or mobile device, open Safari and go to:
            </p>
            <div className="bg-background border border-border px-4 py-2 rounded-lg mt-1 select-all">
              <code className="text-lg font-mono font-bold text-primary">
                http://{status.ip}:{status.port}
              </code>
            </div>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
"""
code = code.replace("// ─── Main Settings page", remote_tab + "\n// ─── Main Settings page")

# 6. Add RemoteTab to switch
code = code.replace(
  "{activeTab === 'plugins' && <PluginsTab />}",
  "{activeTab === 'plugins' && <PluginsTab />}\n          {activeTab === 'remote' && <RemoteTab />}"
)

with open('src/pages/Settings.jsx', 'w') as f:
    f.write(code)

print("Modified Settings.jsx successfully")
