import { useState, useEffect, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Globe, Users, Map, Library, Settings, Box, Plus, Search, TrendingUp, Flag, PawPrint, MapPin, Trash2, Wand2, Dna, FolderOpen, Dice5, Swords, Table2, Sparkles, Puzzle, BarChart2, Star, BookOpen, Layers, Zap, FlaskConical } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import { usePluginStore } from '../store/usePluginStore';

const ICON_MAP = {
  BarChart2, Star, BookOpen, Layers, Zap, FlaskConical, Puzzle,
  Globe, Users, Map, Library, Box, TrendingUp, Flag, PawPrint,
  MapPin, Trash2, Wand2, Dna, Dice5, Swords, Table2, Sparkles,
};
import Dropdown from './Dropdown';
import Modal from './Modal';
import GlobalSearch from './GlobalSearch';

const navItems = [
  { path: '/', label: 'Overview', icon: Globe },
  { path: '/characters', label: 'Characters', icon: Users },
  { path: '/creatures', label: 'Creatures', icon: PawPrint },
  { path: '/races', label: 'Races', icon: Dna },
  { path: '/factions', label: 'Factions', icon: Flag },
  { path: '/locations', label: 'Locations', icon: Map },
  { path: '/things', label: 'Things', icon: Box },
  { path: '/timeline', label: 'Timeline', icon: TrendingUp },
  { path: '/maps', label: 'Maps', icon: MapPin },
  { path: '/stories', label: 'Library', icon: Library },
  { path: '/names', label: 'Names', icon: Wand2 },
  { path: '/trash', label: 'Trash', icon: Trash2 },
];


function SidebarNav({ setMobileMenuOpen }) {
  const navVisible = useAppSettings(s => s.navVisible);
  const dndTools   = useAppSettings(s => s.dndTools);
  const panels     = usePluginStore(s => s.panels);
  const pluginsEnabled = usePluginStore(s => s.pluginsEnabled);
  const visible = navItems.filter(item => navVisible[item.path] !== false);
  return (
    <nav className="flex-1 px-4 pt-2 space-y-0.5 overflow-y-auto">
      {visible.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === '/'}
          onClick={() => setMobileMenuOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`
          }
        >
          <item.icon size={17} />
          <span>{item.label}</span>
        </NavLink>
      ))}
      {dndTools.enabled && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">DnD Tools</p>
          {dndTools.diceRoller && (
            <NavLink to="/tools/dice" onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <Dice5 size={17} /><span>Dice Roller</span>
            </NavLink>
          )}
          {dndTools.initiativeTracker && (
            <NavLink to="/tools/initiative" onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <Swords size={17} /><span>Initiative</span>
            </NavLink>
          )}
          {dndTools.encounterRoller && (
            <NavLink to="/tools/encounters" onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <Table2 size={17} /><span>Encounters</span>
            </NavLink>
          )}
          {dndTools.spellSlots && (
            <NavLink to="/tools/spells" onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
              <Sparkles size={17} /><span>Spell Slots</span>
            </NavLink>
          )}
        </>
      )}
      {pluginsEnabled && panels.length > 0 && (
        <>
          <div className="my-2 border-t border-border" />
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Plugins</p>
          {panels.map(panel => {
            const Icon = ICON_MAP[panel.navIcon] || Puzzle;
            return (
              <NavLink
                key={panel.panelId}
                to={`/plugins/${panel.panelId}`}
                onClick={() => setMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`
                }
              >
                <Icon size={17} />
                <span>{panel.navLabel}</span>
              </NavLink>
            );
          })}
        </>
      )}
    </nav>
  );
}

function WorldModal({ onClose, newWorldName, setNewWorldName, onCreate, onImport }) {
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
            Point to any folder that contains <code className="bg-secondary px-1 rounded">characters/</code>, <code className="bg-secondary px-1 rounded">locations/</code>, and other subfolders with <code className="bg-secondary px-1 rounded">.md</code> files. No JSON required.
          </p>
          <button
            type="button"
            onClick={onImport}
            className="w-full h-9 flex items-center justify-center gap-2 rounded-md text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
          >
            <FolderOpen size={14} /> Choose World Folder…
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
  const mobileMenuOpen    = useWorldStore(s => s.mobileMenuOpen);
  const setMobileMenuOpen = useWorldStore(s => s.setMobileMenuOpen);
  const navigate          = useNavigate();

  const dndTools = useAppSettings(s => s.dndTools);

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
        const first = dndTools.diceRoller        ? '/tools/dice'
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
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-border bg-card flex flex-col h-full transition-transform duration-300 lg:translate-x-0 lg:static lg:w-64
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Traffic light spacer — only visible in Electron on macOS */}
        <div className="electron-titlebar" style={{ WebkitAppRegion: 'drag', height: '44px', flexShrink: 0 }} />
        <div className="p-5 pt-2 pb-2">
          <div className="flex items-center justify-between gap-3 text-primary font-semibold text-xl tracking-tight mb-4">
            <div className="flex items-center gap-3">
              <Globe size={26} className="text-primary" />
              <h1>Realm Lore</h1>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground"
            >
              <Plus size={18} className="rotate-45" />
            </button>
          </div>

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
            onClick={() => { setSearchOpen(true); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm group"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden sm:flex items-center gap-0.5 text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
              <span>⌘K</span>
            </kbd>
          </button>
        </div>

        <SidebarNav setMobileMenuOpen={setMobileMenuOpen} />

        <div className="p-4 border-t border-border mt-auto flex flex-col gap-0.5">
          <NavLink
            to="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`
            }
          >
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
