import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Globe, Users, Map, Library, Settings, Box, Plus, Search, BookMarked, TrendingUp, Shuffle, Flag, PawPrint, MapPin, Trash2, Wand2, Dna } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
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

// Map route paths to entity types for ⌘N
const PATH_TO_TYPE = {
  '/characters': 'characters',
  '/locations':  'locations',
  '/things':     'things',
  '/factions':   'factions',
  '/creatures':  'creatures',
  '/races':      'races',
};

function SidebarNav({ setMobileMenuOpen }) {
  const navVisible = useAppSettings(s => s.navVisible);
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
    </nav>
  );
}

export default function Sidebar() {
  const worlds           = useWorldStore(s => s.worlds);
  const activeWorld      = useWorldStore(s => s.activeWorld);
  const switchWorld      = useWorldStore(s => s.switchWorld);
  const createWorld      = useWorldStore(s => s.createWorld);
  const mobileMenuOpen   = useWorldStore(s => s.mobileMenuOpen);
  const setMobileMenuOpen = useWorldStore(s => s.setMobileMenuOpen);
  const characters       = useWorldStore(s => s.characters);
  const locations        = useWorldStore(s => s.locations);
  const things           = useWorldStore(s => s.things);
  const lore             = useWorldStore(s => s.lore);
  const factions         = useWorldStore(s => s.factions);
  const creatures        = useWorldStore(s => s.creatures);
  const races            = useWorldStore(s => s.races);
  const addEntity        = useWorldStore(s => s.addEntity);
  const navigate = useNavigate();

  const [showCreate, setShowCreate] = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const handleQuickAdd = useCallback(async (type) => {
    const created = await addEntity(type, { name: '' });
    navigate(`/${type}/${created.id}`, { state: { autoEdit: true } });
  }, [addEntity, navigate]);

  const handleRandom = useCallback(() => {
    const pool = [
      ...characters.map(e => ({ e, type: 'characters' })),
      ...locations.map(e  => ({ e, type: 'locations' })),
      ...things.map(e     => ({ e, type: 'things' })),
      ...factions.map(e => ({ e, type: 'factions' })),
      ...creatures.map(e => ({ e, type: 'creatures' })),
      ...races.map(e => ({ e, type: 'races' })),
    ];
    if (!pool.length) return;
    const { e, type } = pool[Math.floor(Math.random() * pool.length)];
    setMobileMenuOpen(false);
    navigate(`/${type}/${e.id}`);
  }, [characters, locations, things, factions, creatures, races, setMobileMenuOpen, navigate]);

  const worldOptions = useMemo(() => worlds.map(w => ({ value: w, label: w })), [worlds]);

  // ⌘K / Ctrl+K → search, ⌘N / Ctrl+N → quick add for current section
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        // Detect current page from URL
        const path = '/' + window.location.pathname.split('/').filter(Boolean)[0];
        const type = PATH_TO_TYPE[path];
        if (type) handleQuickAdd(type);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleQuickAdd]);

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
        <div className="p-5 pb-2">
          <div className="flex items-center justify-between gap-3 text-primary font-semibold text-xl tracking-tight mb-4">
            <div className="flex items-center gap-3">
              <Globe size={26} className="text-primary" />
              <h1>WorldBuilder</h1>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1 rounded-md hover:bg-secondary text-muted-foreground"
            >
              <Plus size={18} className="rotate-45" />
            </button>
          </div>

          {/* Search button */}
          <button
            onClick={() => { setSearchOpen(true); setMobileMenuOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 mb-1 rounded-md bg-secondary/60 border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors text-sm group"
          >
            <Search size={14} className="shrink-0" />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="hidden sm:flex items-center gap-0.5 text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
              <span>⌘K</span>
            </kbd>
          </button>
          <div className="flex gap-1 mb-3">
            <button
              onClick={() => {
                const path = '/' + window.location.pathname.split('/').filter(Boolean)[0];
                const type = PATH_TO_TYPE[path];
                if (type) { handleQuickAdd(type); setMobileMenuOpen(false); }
              }}
              className="flex-1 flex items-center gap-2.5 px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors text-sm group"
            >
              <Plus size={14} className="shrink-0" />
              <span className="flex-1 text-left">Quick Add…</span>
              <kbd className="hidden sm:flex items-center gap-0.5 text-xs font-mono opacity-60 group-hover:opacity-100 transition-opacity">
                <span>⌘N</span>
              </kbd>
            </button>
            <button
              onClick={handleRandom}
              className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              title="Jump to random entity"
            >
              <Shuffle size={14} />
            </button>
          </div>

          <div className="flex items-center gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <Dropdown
                value={activeWorld}
                options={worldOptions}
                onChange={switchWorld}
              />
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="p-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
              title="Create New World"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>

        <SidebarNav setMobileMenuOpen={setMobileMenuOpen} />

        <div className="p-4 border-t border-border mt-auto">
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
        <Modal title="New World" onClose={() => { setShowCreate(false); setNewWorldName(''); }} size="sm">
          <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">World Name</label>
              <input
                autoFocus
                type="text"
                value={newWorldName}
                onChange={e => setNewWorldName(e.target.value)}
                placeholder="e.g. The Shattered Realms"
                className="w-full bg-secondary text-foreground text-sm rounded-md px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewWorldName(''); }}
                className="h-9 px-4 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Create
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
