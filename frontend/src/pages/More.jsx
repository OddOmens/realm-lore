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
import WorldAvatar from '../components/WorldAvatar';
import { displayWorldName } from '../lib/worlds';

// Paths that already have their own tab in BottomNav.
const TAB_PATHS = new Set(['/', '/characters', '/locations', '/stories']);

const CODEX = ['/creatures', '/races', '/factions', '/lore', '/things', '/notes'];
const lore = { path: '/lore', label: 'Lore', icon: BookMarked };

function Section({ title, children }) {
  return (
    <section className="mb-7">
      {title && (
        <h2 className="px-1 pb-1.5 text-xs font-medium text-muted-foreground">{title}</h2>
      )}
      <div className="rounded-lg bg-card border border-border overflow-hidden divide-y divide-border">
        {children}
      </div>
    </section>
  );
}

function RowBody({ icon: Icon, lead, label, detail, accessory = 'chevron' }) {
  return (
    <>
      {lead}
      {Icon && <Icon size={18} className="shrink-0 text-muted-foreground" />}
      <span className="flex-1 min-w-0 truncate text-base text-foreground">{label}</span>
      {detail && <span className="shrink-0 text-sm text-muted-foreground">{detail}</span>}
      {accessory === 'chevron' && <ChevronRight size={16} className="shrink-0 text-muted-foreground/60" />}
      {accessory === 'check' && <Check size={18} strokeWidth={2.25} className="shrink-0 text-brand" />}
    </>
  );
}

const rowClass = 'ios-row flex items-center gap-3 w-full min-h-[44px] px-3.5 py-2 text-left transition-colors hover:bg-accent/60';

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
      <h1 className="pt-4 pb-4 text-[30px] leading-tight font-bold tracking-[-0.02em] text-foreground">More</h1>

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        className="w-full mb-7 flex items-center gap-2 h-10 px-3 rounded-lg border border-border bg-surface text-muted-foreground text-base"
      >
        <Search size={17} className="shrink-0" />
        <span>Search</span>
      </button>

      <Section title="Worlds">
        {worlds.map(w => (
          <ButtonRow key={w} onClick={() => switchWorld(w)} lead={<WorldAvatar name={w} />} label={displayWorldName(w)} accessory={w === activeWorld ? 'check' : null} />
        ))}
        <ButtonRow onClick={() => setShowCreate(true)} icon={Plus} label="New world" accessory={null} />
        <ButtonRow onClick={importWorld} icon={FolderOpen} label="Import world folder" accessory={null} />
      </Section>

      {codex.length > 0 && (
        <Section title="Codex">
          {codex.map(i => (
            <LinkRow key={i.path} to={i.path} icon={i.icon} label={i.label}
              detail={showEntityCounts && counts[i.path] ? counts[i.path] : null} />
          ))}
        </Section>
      )}

      {tools.length > 0 && (
        <Section title="Tools">
          {tools.map(i => <LinkRow key={i.path} to={i.path} icon={i.icon} label={i.label} />)}
        </Section>
      )}

      {dndTools.enabled && (
        <Section title="DnD Tools">
          {dndToolItems.filter(t => dndTools[t.key]).map(t => (
            <LinkRow key={t.path} to={t.path} icon={t.icon} label={t.label} />
          ))}
        </Section>
      )}

      {customTypes.length > 0 && (
        <Section title="Custom">
          {customTypes.map(type => (
            <LinkRow key={type.id} to={`/custom/${type.id}`} icon={customTypeIcons[type.icon] || Box} label={type.label} />
          ))}
        </Section>
      )}

      <Section>
        <LinkRow to="/trash" icon={Trash2} label="Trash" />
        <LinkRow to="/settings" icon={Settings} label="Settings" />
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
