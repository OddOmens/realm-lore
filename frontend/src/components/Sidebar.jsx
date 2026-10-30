import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Settings, Box, Plus, Search, Trash2, FolderOpen } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import { navItems, dndToolItems, customTypeIcons } from '../config/nav';
import Dropdown from './Dropdown';
import Modal from './Modal';
import GlobalSearch from './GlobalSearch';

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`;

function SidebarNav() {
  const navVisible = useAppSettings(s => s.navVisible);
  const dndTools   = useAppSettings(s => s.dndTools);
  const customTypes = useWorldStore(s => s.customTypes) || [];
  const visible = navItems.filter(item => navVisible[item.path] !== false);
  return (
    <nav className="flex-1 px-4 pt-2 space-y-0.5 overflow-y-auto">
      {visible.map((item) => (
        <NavLink key={item.path} to={item.path} end={item.path === '/'} className={navLinkClass}>
          <item.icon size={17} />
          <span>{item.label}</span>
        </NavLink>
      ))}
      {dndTools.enabled && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">DnD Tools</p>
          {dndToolItems.filter(t => dndTools[t.key]).map(({ path, label, icon: Icon }) => (
            <NavLink key={path} to={path} className={navLinkClass}>
              <Icon size={17} /><span>{label}</span>
            </NavLink>
          ))}
        </>
      )}
      {customTypes.length > 0 && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Custom</p>
          {customTypes.map(type => {
            const Icon = customTypeIcons[type.icon] || Box;
            return (
              <NavLink key={type.id} to={`/custom/${type.id}`} className={navLinkClass}>
                <Icon size={17} />
                <span>{type.label}</span>
              </NavLink>
            );
          })}
        </>
      )}
    </nav>
  );
}

export function WorldModal({ onClose, newWorldName, setNewWorldName, onCreate, onImport }) {
  return (
    <Modal title="Add World" onClose={onClose} size="sm">
      <div className="space-y-5">
        {/* Create new */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Create new</p>
          <form onSubmit={(e) => { e.preventDefault(); onCreate(); }} className="space-y-3">
            <input
              autoFocus
              type="text"
              value={newWorldName}
              onChange={e => setNewWorldName(e.target.value)}
              placeholder="e.g. The Shattered Realms"
              className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!newWorldName.trim()}
              className="w-full h-9 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Create World
            </button>
          </form>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Import existing */}
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Import existing world folder</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Upload any folder from your computer that contains <code className="bg-secondary px-1 rounded">characters/</code>, <code className="bg-secondary px-1 rounded">locations/</code>, and other subfolders with <code className="bg-secondary px-1 rounded">.md</code> files. No JSON required.
          </p>
          <button
            type="button"
            onClick={onImport}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-md text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
          >
            <FolderOpen size={14} /> Upload World Folder…
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function Sidebar() {
  const worlds            = useWorldStore(s => s.worlds);
  const activeWorld       = useWorldStore(s => s.activeWorld);
  const switchWorld       = useWorldStore(s => s.switchWorld);
  const createWorld       = useWorldStore(s => s.createWorld);
  const openWorldFolder   = useWorldStore(s => s.openWorldFolder);
  const navigate          = useNavigate();

  const dndTools = useAppSettings(s => s.dndTools);
  const showAppTitle = useAppSettings(s => s.showAppTitle);

  const [showCreate, setShowCreate]     = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [searchOpen, setSearchOpen]     = useState(false);

  const worldOptions = useMemo(() => worlds.map(w => ({ value: w, label: w })), [worlds]);

  // ⌘K → search, ⌘D → DnD tools
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && dndTools.enabled) {
        e.preventDefault();
        const first = dndTools.campaignDashboard ? '/tools/dashboard'
          : dndTools.diceRoller        ? '/tools/dice'
          : dndTools.initiativeTracker ? '/tools/initiative'
          : dndTools.encounterRoller   ? '/tools/encounters'
          : dndTools.spellSlots        ? '/tools/spells'
          : null;
        if (first) navigate(first);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [dndTools.enabled, navigate]);

  const handleCreate = async () => {
    const name = newWorldName.trim();
    if (!name) return;
    await createWorld(name);
    setNewWorldName('');
    setShowCreate(false);
  };

  return (
    <>
      {/* Phones and narrow tablets use the tab bar and More tab instead. */}
      <aside className="hidden lg:flex w-64 shrink-0 border-r border-border bg-card flex-col h-full">
        <div className="p-5 pt-4 pb-2">
          {showAppTitle && (
            <div className="flex flex-col mt-2 mb-4">
              <h1 className="text-lg font-bold tracking-tight text-primary">Realm Lore</h1>
              <p className="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/60">by Odd Omens</p>
            </div>
          )}

          {/* World selector */}
          <Dropdown
            value={activeWorld}
            options={worldOptions}
            onChange={switchWorld}
          />

          {/* World actions */}
          <div className="flex gap-1.5 mt-2">
            <button
              onClick={() => setShowCreate(true)}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Plus size={13} /> Add World
            </button>
            <button
              onClick={async () => {
                const result = await openWorldFolder();
                if (result?.error) alert(result.error);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-xs font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors"
            >
              <FolderOpen size={13} /> Import World
            </button>
          </div>

          <div className="my-3 border-t border-border" />

          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm group"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden sm:flex items-center gap-0.5 text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
              <span>⌘K</span>
            </kbd>
          </button>
        </div>

        <SidebarNav />

        <div className="p-4 border-t border-border mt-auto flex flex-col gap-0.5">
          <NavLink to="/trash" className={navLinkClass}>
            <Trash2 size={17} />
            <span>Trash</span>
          </NavLink>
          <NavLink to="/settings" className={navLinkClass}>
            <Settings size={17} />
            <span>Settings</span>
          </NavLink>
        </div>
      </aside>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {showCreate && (
        <WorldModal
          onClose={() => { setShowCreate(false); setNewWorldName(''); }}
          newWorldName={newWorldName}
          setNewWorldName={setNewWorldName}
          onCreate={handleCreate}
          onImport={async () => {
            const result = await openWorldFolder();
            if (result?.error) { alert(result.error); return; }
            if (result?.success) setShowCreate(false);
          }}
        />
      )}
    </>
  );
}
