import { useState, useEffect } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  Settings, Box, Plus, Search, Trash2, FolderOpen, ChevronsUpDown, PanelLeft,
} from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import { navItems, dndToolItems, customTypeIcons } from '../config/nav';
import Menu, { MenuItem, MenuLabel, MenuSeparator } from './Menu';
import Modal from './Modal';
import GlobalSearch from './GlobalSearch';
import WorldAvatar from './WorldAvatar';
import { displayWorldName } from '../lib/worlds';

// Sidebar groups: Overview sits on its own, then the world's entries, then the
// writing and reference pages.
const WORLD_PATHS = new Set(['/characters', '/creatures', '/races', '/factions', '/locations', '/things']);

const SIDEBAR_KEY = 'sidebarCollapsed';

export function Logo({ className = 'size-6' }) {
  return <img src="/icon-192.png" alt="" aria-hidden className={`rounded-md ${className}`} />;
}

const navLinkClass = ({ isActive }) =>
  `flex h-8 items-center gap-2.5 rounded-md px-2 text-sm transition-colors ${
    isActive
      ? 'bg-sidebar-accent font-medium text-foreground [&>svg]:text-foreground'
      : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground'
  }`;

function NavItem({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={navLinkClass}>
      <Icon size={16} className="shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

function GroupLabel({ children }) {
  return <p className="px-2 pb-1 pt-4 text-xs font-medium text-muted-foreground">{children}</p>;
}

function SidebarNav() {
  const navVisible  = useAppSettings(s => s.navVisible);
  const dndTools    = useAppSettings(s => s.dndTools);
  const customTypes = useWorldStore(s => s.customTypes) || [];
  const visible = navItems.filter(item => navVisible[item.path] !== false);
  const overview  = visible.filter(item => item.path === '/');
  const world     = visible.filter(item => WORLD_PATHS.has(item.path));
  const workspace = visible.filter(item => item.path !== '/' && !WORLD_PATHS.has(item.path));

  return (
    <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-1">
      <div className="flex flex-col gap-px">
        {overview.map(item => <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} end />)}
      </div>
      {world.length > 0 && (
        <>
          <GroupLabel>World</GroupLabel>
          <div className="flex flex-col gap-px">
            {world.map(item => <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} />)}
          </div>
        </>
      )}
      {workspace.length > 0 && (
        <>
          <GroupLabel>Workspace</GroupLabel>
          <div className="flex flex-col gap-px">
            {workspace.map(item => <NavItem key={item.path} to={item.path} icon={item.icon} label={item.label} />)}
          </div>
        </>
      )}
      {customTypes.length > 0 && (
        <>
          <GroupLabel>Custom</GroupLabel>
          <div className="flex flex-col gap-px">
            {customTypes.map(type => (
              <NavItem key={type.id} to={`/custom/${type.id}`} icon={customTypeIcons[type.icon] || Box} label={type.label} />
            ))}
          </div>
        </>
      )}
      {dndTools.enabled && (
        <>
          <GroupLabel>DnD Tools</GroupLabel>
          <div className="flex flex-col gap-px">
            {dndToolItems.filter(t => dndTools[t.key]).map(({ path, label, icon }) => (
              <NavItem key={path} to={path} icon={icon} label={label} />
            ))}
          </div>
        </>
      )}
    </nav>
  );
}

export function WorldModal({ onClose, newWorldName, setNewWorldName, onCreate, onImport }) {
  return (
    <Modal title="Add world" onClose={onClose} size="sm">
      <div className="space-y-5">
        {/* Create new */}
        <form onSubmit={(e) => { e.preventDefault(); onCreate(); }} className="space-y-2">
          <label htmlFor="new-world-name" className="text-sm font-medium text-foreground">Name</label>
          <input
            id="new-world-name"
            autoFocus
            type="text"
            value={newWorldName}
            onChange={e => setNewWorldName(e.target.value)}
            placeholder="e.g. The Shattered Realms"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring"
          />
          <button
            type="submit"
            disabled={!newWorldName.trim()}
            className="mt-1 h-9 w-full rounded-md bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create world
          </button>
        </form>

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-muted-foreground">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Import existing */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">Import a world folder</p>
          <p className="text-[0.8125rem] leading-relaxed text-muted-foreground">
            Upload any folder that contains <code className="rounded bg-muted px-1">characters/</code>, <code className="rounded bg-muted px-1">locations/</code> and other subfolders of <code className="rounded bg-muted px-1">.md</code> files. No JSON needed.
          </p>
          <button
            type="button"
            onClick={onImport}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-input bg-background text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <FolderOpen size={15} /> Upload world folder…
          </button>
        </div>
      </div>
    </Modal>
  );
}

function WorldSwitcher({ onAdd, onImport }) {
  const worlds      = useWorldStore(s => s.worlds);
  const activeWorld = useWorldStore(s => s.activeWorld);
  const switchWorld = useWorldStore(s => s.switchWorld);

  return (
    <Menu
      width="trigger"
      className="min-w-60"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          className="flex h-10 w-full items-center gap-2.5 rounded-md px-2 text-left outline-none transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          {activeWorld ? <WorldAvatar name={activeWorld} /> : <span className="size-6 rounded-md bg-muted" />}
          <span className="min-w-0 flex-1 truncate text-[0.9375rem] font-semibold text-foreground">
            {activeWorld ? displayWorldName(activeWorld) : 'No world'}
          </span>
          <ChevronsUpDown size={16} className="shrink-0 text-muted-foreground" />
        </button>
      )}
    >
      <MenuLabel>Worlds</MenuLabel>
      {worlds.map(w => (
        <MenuItem key={w} onSelect={() => switchWorld(w)} checked={w === activeWorld}>
          <span className="flex items-center gap-2">
            <WorldAvatar name={w} className="size-5 text-[0.55rem]" />
            <span className="truncate">{displayWorldName(w)}</span>
          </span>
        </MenuItem>
      ))}
      <MenuSeparator />
      <MenuItem icon={Plus} onSelect={onAdd}>New world</MenuItem>
      <MenuItem icon={FolderOpen} onSelect={onImport}>Import world folder</MenuItem>
    </Menu>
  );
}

// Desktop chrome: a full-width bar over the sidebar and page, as in Quire;
// search, trash and settings live at the foot of the sidebar.
// Phones and narrow tablets use the tab bar and More tab instead.
export function TopBar({ onToggleSidebar }) {
  const showAppTitle = useAppSettings(s => s.showAppTitle);
  return (
    <header className="hidden lg:flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background px-3">
      <button
        type="button"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
        className="grid size-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <PanelLeft size={16} />
      </button>
      <Link to="/" className="mr-3 flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Logo />
        {showAppTitle && <span className="text-[0.95rem] font-semibold tracking-[-0.01em] text-foreground">Realm Lore</span>}
      </Link>
    </header>
  );
}

// The desktop top bar and sidebar around the page. They share state (search,
// collapse, world dialogs), so one component lays out both.
export default function AppChrome({ children }) {
  const createWorld     = useWorldStore(s => s.createWorld);
  const openWorldFolder = useWorldStore(s => s.openWorldFolder);
  const navigate        = useNavigate();

  const dndTools = useAppSettings(s => s.dndTools);

  const [showCreate, setShowCreate]     = useState(false);
  const [newWorldName, setNewWorldName] = useState('');
  const [searchOpen, setSearchOpen]     = useState(false);
  const [collapsed, setCollapsed]       = useState(() => localStorage.getItem(SIDEBAR_KEY) === '1');

  const toggleSidebar = () => {
    setCollapsed(c => {
      localStorage.setItem(SIDEBAR_KEY, c ? '0' : '1');
      return !c;
    });
  };

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
  }, [dndTools, navigate]);

  const handleCreate = async () => {
    const name = newWorldName.trim();
    if (!name) return;
    await createWorld(name);
    setNewWorldName('');
    setShowCreate(false);
  };

  const importWorld = async () => {
    const result = await openWorldFolder();
    if (result?.error) { alert(result.error); return; }
    if (result?.success) setShowCreate(false);
  };

  return (
    <>
      <TopBar onToggleSidebar={toggleSidebar} />
      <div className="flex min-h-0 flex-1">
        <aside
          className={`${collapsed ? 'lg:hidden' : 'lg:flex'} hidden w-[16.5rem] shrink-0 flex-col border-r border-sidebar-border bg-sidebar`}
        >
          <div className="px-2 pb-1 pt-3">
            <WorldSwitcher onAdd={() => setShowCreate(true)} onImport={importWorld} />
          </div>

          <SidebarNav />

          <div className="flex flex-col gap-px border-t border-sidebar-border px-2 py-2">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 items-center gap-2.5 rounded-md px-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <Search size={16} className="shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">Search</span>
              <kbd className="kbd">⌘K</kbd>
            </button>
            <NavItem to="/trash" icon={Trash2} label="Trash" />
            <NavItem to="/settings" icon={Settings} label="Settings" />
          </div>
        </aside>
        {children}
      </div>

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}

      {showCreate && (
        <WorldModal
          onClose={() => { setShowCreate(false); setNewWorldName(''); }}
          newWorldName={newWorldName}
          setNewWorldName={setNewWorldName}
          onCreate={handleCreate}
          onImport={importWorld}
        />
      )}
    </>
  );
}
