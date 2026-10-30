import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ChevronRight, Check, Plus, FolderOpen, Settings, Trash2, Box, BookMarked,
} from 'lucide-react';
import { useShallow } from 'zustand/shallow';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import { navItems, dndToolItems, customTypeIcons } from '../config/nav';
import { WorldModal } from '../components/Sidebar';
import GlobalSearch from '../components/GlobalSearch';

// Paths that already have their own tab in BottomNav.
const TAB_PATHS = new Set(['/', '/characters', '/locations', '/stories']);

// Icon tile colour per destination, in the style of the iOS Settings app.
const TILE = {
  '/creatures': 'bg-orange-500',
  '/races':     'bg-pink-500',
  '/factions':  'bg-red-500',
  '/lore':      'bg-amber-500',
  '/things':    'bg-teal-500',
  '/notes':     'bg-yellow-500',
  '/timeline':  'bg-indigo-500',
  '/maps':      'bg-green-500',
  '/names':     'bg-purple-500',
  '/assets':    'bg-sky-500',
};

const CODEX = ['/creatures', '/races', '/factions', '/lore', '/things', '/notes'];
const lore = { path: '/lore', label: 'Lore', icon: BookMarked };

function Section({ title, children }) {
  return (
    <section className="mb-7">
      {title && (
        <h2 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-muted-foreground">{title}</h2>
      )}
      <div className="rounded-xl bg-card border border-border/60 overflow-hidden divide-y divide-border/60">
        {children}
      </div>
    </section>
  );
}

function RowBody({ icon: Icon, tile, label, detail, accessory = 'chevron' }) {
  return (
    <>
      {Icon && (
        <span className={`shrink-0 w-[30px] h-[30px] rounded-[7px] flex items-center justify-center text-white ${tile || 'bg-zinc-500'}`}>
          <Icon size={18} strokeWidth={2} />
        </span>
      )}
      <span className="flex-1 min-w-0 truncate text-[17px] text-foreground">{label}</span>
      {detail && <span className="shrink-0 text-[15px] text-muted-foreground">{detail}</span>}
      {accessory === 'chevron' && <ChevronRight size={18} className="shrink-0 text-muted-foreground/50" />}
      {accessory === 'check' && <Check size={18} strokeWidth={2.5} className="shrink-0 text-primary" />}
    </>
  );
}

const rowClass = 'ios-row flex items-center gap-3 w-full min-h-[44px] px-4 py-2 text-left';

function LinkRow({ to, ...body }) {
  return <Link to={to} className={rowClass}><RowBody {...body} /></Link>;
}

function ButtonRow({ onClick, ...body }) {
  return <button type="button" onClick={onClick} className={rowClass}><RowBody {...body} /></button>;
}

export default function More() {
  const worlds          = useWorldStore(s => s.worlds);
  const activeWorld     = useWorldStore(s => s.activeWorld);
  const switchWorld     = useWorldStore(s => s.switchWorld);
  const createWorld     = useWorldStore(s => s.createWorld);
  const openWorldFolder = useWorldStore(s => s.openWorldFolder);
  const customTypes     = useWorldStore(s => s.customTypes) || [];
  const counts          = useWorldStore(useShallow(s => Object.fromEntries(CODEX.map(p => [p, s[p.slice(1)]?.length ?? 0]))));
  const navVisible      = useAppSettings(s => s.navVisible);
  const dndTools        = useAppSettings(s => s.dndTools);
  const showEntityCounts = useAppSettings(s => s.showEntityCounts);

  const [searchOpen, setSearchOpen]     = useState(false);
  const [showCreate, setShowCreate]     = useState(false);
  const [newWorldName, setNewWorldName] = useState('');

  const items = [...navItems, lore].filter(i => !TAB_PATHS.has(i.path) && navVisible[i.path] !== false);
  const codex = CODEX.map(p => items.find(i => i.path === p)).filter(Boolean);
  const tools = items.filter(i => !CODEX.includes(i.path));

  const importWorld = async () => {
    const result = await openWorldFolder();
    if (result?.error) { alert(result.error); return; }
    if (result?.success) setShowCreate(false);
  };

  const handleCreate = async () => {
    const name = newWorldName.trim();
    if (!name) return;
    await createWorld(name);
    setNewWorldName('');
    setShowCreate(false);
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 pb-8">
      <h1 className="pt-3 pb-3 text-[34px] leading-tight font-bold tracking-tight text-foreground">More</h1>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="w-full mb-7 flex items-center gap-2 h-9 px-2.5 rounded-[10px] bg-secondary text-muted-foreground text-[17px]"
      >
        <Search size={17} className="shrink-0" />
        <span>Search</span>
      </button>

      <Section title="Worlds">
        {worlds.map(w => (
          <ButtonRow key={w} onClick={() => switchWorld(w)} label={w} accessory={w === activeWorld ? 'check' : null} />
        ))}
        <ButtonRow onClick={() => setShowCreate(true)} icon={Plus} tile="bg-blue-500" label="Add World" accessory={null} />
        <ButtonRow onClick={importWorld} icon={FolderOpen} tile="bg-blue-500" label="Import World" accessory={null} />
      </Section>

      {codex.length > 0 && (
        <Section title="Codex">
          {codex.map(i => (
            <LinkRow key={i.path} to={i.path} icon={i.icon} tile={TILE[i.path]} label={i.label}
              detail={showEntityCounts && counts[i.path] ? counts[i.path] : null} />
          ))}
        </Section>
      )}

      {tools.length > 0 && (
        <Section title="Tools">
          {tools.map(i => <LinkRow key={i.path} to={i.path} icon={i.icon} tile={TILE[i.path]} label={i.label} />)}
        </Section>
      )}

      {dndTools.enabled && (
        <Section title="DnD Tools">
          {dndToolItems.filter(t => dndTools[t.key]).map(t => (
            <LinkRow key={t.path} to={t.path} icon={t.icon} tile="bg-rose-600" label={t.label} />
          ))}
        </Section>
      )}

      {customTypes.length > 0 && (
        <Section title="Custom">
          {customTypes.map(type => (
            <LinkRow key={type.id} to={`/custom/${type.id}`} icon={customTypeIcons[type.icon] || Box} tile="bg-violet-500" label={type.label} />
          ))}
        </Section>
      )}

      <Section>
        <LinkRow to="/trash" icon={Trash2} tile="bg-zinc-500" label="Trash" />
        <LinkRow to="/settings" icon={Settings} tile="bg-zinc-500" label="Settings" />
      </Section>

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
    </div>
  );
}
