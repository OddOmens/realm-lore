import { Children, isValidElement, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import { api } from '../lib/api';
import {
  Download, Upload, CheckCircle2, AlertCircle, Trash2,
  Sliders, Database, Eye, Keyboard, ChevronDown,
  Globe, Users, Map, Library, Box, TrendingUp, MapPin, Info,
  PawPrint, Wand2, Dna, Flag, FlaskConical,
  Plus, Layers, Edit2, Zap, Car, Skull, Sparkles, Ghost, 
  Gamepad2, Rocket, Cloud, Compass, LogOut
} from 'lucide-react';

const ICON_OPTIONS = [
  { value: 'box', label: 'Box', icon: Box },
  { value: 'zap', label: 'Zap', icon: Zap },
  { value: 'car', label: 'Car', icon: Car },
  { value: 'skull', label: 'Skull', icon: Skull },
  { value: 'sparkles', label: 'Sparkles', icon: Sparkles },
  { value: 'ghost', label: 'Ghost', icon: Ghost },
  { value: 'gamepad', label: 'Gamepad', icon: Gamepad2 },
  { value: 'rocket', label: 'Rocket', icon: Rocket },
  { value: 'cloud', label: 'Cloud', icon: Cloud },
  { value: 'compass', label: 'Compass', icon: Compass },
];

// ─── Shared primitives ───────────────────────────────────────────────────────

// A settings section in Quire's layout: the SectionHeader sits in a left
// column, the controls on the right. Sections in a tab are divided by rules.
function SectionCard({ children, className = '' }) {
  const items = Children.toArray(children);
  const header = isValidElement(items[0]) && items[0].type === SectionHeader ? items[0] : null;
  const body = header ? items.slice(1) : items;
  return (
    <section className={`grid gap-4 py-8 first:pt-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-10 ${className}`}>
      {header ? <div>{header}</div> : null}
      <div className={`min-w-0 flex flex-col gap-4 ${header ? '' : 'md:col-span-2'}`}>{body}</div>
    </section>
  );
}

function SectionHeader({ title, description, tone, children }) {
  return (
    <div>
      <h2 className={`section-title ${tone === 'danger' ? '!text-destructive' : ''}`}>{title}</h2>
      {description && <p className="mt-1 text-[0.8125rem] leading-relaxed text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2.5 cursor-pointer group">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-[0.8125rem] text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${checked ? 'bg-brand' : 'bg-input'}`}
        style={{ height: '20px', width: '36px' }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`}
        />
      </button>
    </label>
  );
}

function SegmentedControl({ value, onChange, options, label }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="tabs flex w-full">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`tab flex-1 ${value === opt.value ? 'is-active' : ''}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SelectField({ value, onChange, options, label, description }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      {description && <p className="text-[0.8125rem] text-muted-foreground">{description}</p>}
      <div className="relative">
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="input pr-8"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  );
}

// Swatches for the theme picker: background, text and accent.
const THEMES = [
  { value: 'system',    label: 'System',    swatch: ['#ffffff', '#1a1b1e', '#3b5bdb'] },
  { value: 'light',     label: 'Light',     swatch: ['#ffffff', '#1f2328', '#3b5bdb'] },
  { value: 'dark',      label: 'Dark',      swatch: ['#1a1b1e', '#e3e5e8', '#748ffc'] },
  { value: 'parchment', label: 'Parchment', swatch: ['hsl(42 35% 90%)', 'hsl(25 20% 20%)', 'hsl(18 55% 38%)'] },
  { value: 'scifi',     label: 'Sci-Fi',    swatch: ['hsl(220 40% 5%)', 'hsl(200 60% 90%)', 'hsl(190 90% 50%)'] },
  { value: 'grimdark',  label: 'Grimdark',  swatch: ['hsl(0 0% 0%)', 'hsl(0 0% 85%)', 'hsl(0 80% 45%)'] },
  { value: 'purple',    label: 'Purple',    swatch: ['hsl(260 20% 6%)', 'hsl(260 10% 90%)', 'hsl(265 80% 65%)'] },
  { value: 'green',     label: 'Green',     swatch: ['hsl(140 20% 6%)', 'hsl(140 10% 90%)', 'hsl(142 70% 45%)'] },
];

function ThemePicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {THEMES.map(t => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            aria-pressed={active}
            className={`rounded-lg border p-1.5 text-left transition-colors ${active ? 'border-brand ring-2 ring-brand/25' : 'border-border hover:border-foreground/20'}`}
          >
            <span className="flex h-12 overflow-hidden rounded-md ring-1 ring-inset ring-foreground/10">
              {(t.value === 'system' ? [THEMES[1].swatch, THEMES[2].swatch] : [t.swatch]).map(([sbg, sfg, saccent], k) => (
                <span key={k} className="flex flex-1 flex-col justify-end gap-1 p-2" style={{ background: sbg }}>
                  <span className="block h-1.5 w-3/4 rounded-full" style={{ background: sfg, opacity: 0.85 }} />
                  <span className="block h-1.5 w-1/3 rounded-full" style={{ background: saccent }} />
                </span>
              ))}
            </span>
            <span className={`mt-1.5 block px-0.5 text-xs font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',    label: 'General',    icon: Sliders },
  { id: 'appearance', label: 'Appearance', icon: Eye },
  { id: 'editor',     label: 'Editor',     icon: Keyboard },
  { id: 'data',       label: 'Data',       icon: Database },
  { id: 'about',      label: 'About',      icon: Info },
];

// ─── General tab ─────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: '/',           label: 'Overview',   icon: Globe },
  { path: '/characters', label: 'Characters', icon: Users },
  { path: '/creatures',  label: 'Creatures',  icon: PawPrint },
  { path: '/races',      label: 'Races',      icon: Dna },
  { path: '/factions',   label: 'Factions',   icon: Flag },
  { path: '/locations',  label: 'Locations',  icon: Map },
  { path: '/things',     label: 'Things',     icon: Box },
  { path: '/timeline',   label: 'Timeline',   icon: TrendingUp },
  { path: '/maps',       label: 'Maps',       icon: MapPin },
  { path: '/stories',    label: 'Library',    icon: Library },
  { path: '/names',      label: 'Names',      icon: Wand2 },
];


function VersionHistoryPanel() {
  const versions = [
    { version: "2026.5.4", date: "May 21, 2026", changes: ["Added race-specific character name generator with 9 fantasy races.", "Human: diverse cultural mix (Celtic, Slavic, Germanic, Mediterranean).", "Elf: flowing melodic names with optional apostrophe breaks and surnames.", "Dwarf: short punchy names with clan surnames and son/dottir patronymics.", "Gnome: whimsical playful names with compound Wick surnames.", "Orc: harsh guttural names with war-titles and clan affiliations.", "Halfling: warm cozy English-countryside names with nature surnames.", "Tiefling: virtue names, infernal names, and dramatic surnames.", "Dragonborn: draconic names with authentic clan names.", "Half-Orc: blend of human and orc naming conventions."] },
    { version: "2026.5.3", date: "May 20, 2026", changes: ["Massively expanded Name Generator with 500+ new words across all categories.", "Added Race / Species name generator type.", "Added character surnames, epithets, and more name styles.", "Added named item style (e.g. Kael's Rusted Sword).", "Added possessive town names, prefixes, and directional variants."] },
    { version: "2026.5.2", date: "May 20, 2026", changes: ["Fixed Express 5 server fallback routing bug.", "Moved version history to dedicated About tab.", "Remote server toggle now shows a network access confirmation modal.", "Fixed mobile Settings tab bar layout."] },
    { version: "2026.5.1", date: "May 20, 2026", changes: ["Added Remote Access Express server for mobile/iPad use.", "Added multi-world support with External World Links via Settings."] },
    { version: "2026.5.0", date: "May 15, 2026", changes: ["Initial Beta Release.", "Added core worldbuilding tools: Characters, Locations, Lore, Maps, and Story Editor."] }
  ];

  return (
    <SectionCard>
      <SectionHeader
        title="About & Version History"
        description="Release notes and updates for Realm Lore."
      />
      <div className="flex flex-col gap-5">
        {versions.map((v, i) => (
          <div key={i} className="flex flex-col gap-1 border-l-2 border-border pl-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">v{v.version}</span>
              <span className="text-xs text-muted-foreground">{v.date}</span>
            </div>
            <ul className="list-disc list-inside text-xs text-muted-foreground mt-1 space-y-1">
              {v.changes.map((c, j) => (
                <li key={j}>{c}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AboutTab() {
  return (
    <div className="flex flex-col divide-y divide-border">
      <SectionCard>
        <div className="flex items-center gap-4">
          <img src="/icon-192.png" alt="" aria-hidden className="size-14 rounded-xl" />
          <div>
            <h2 className="text-base font-semibold text-foreground">Realm Lore</h2>
            <p className="text-sm text-muted-foreground">Your personal worldbuilding companion.</p>
            <span className="badge mt-1.5 font-mono">v2026.5.4</span>
          </div>
        </div>
      </SectionCard>
      <SectionCard>
        <SectionHeader title="Sign out" description="Signs this device out. To sign out every device, change the server's password." />
        <div>
          <button
            type="button"
            className="btn btn-outline"
            onClick={async () => {
              await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
              window.location.reload();
            }}
          >
            <LogOut /> Sign out
          </button>
        </div>
      </SectionCard>
      <VersionHistoryPanel />
    </div>
  );
}

function GeneralTab() {
  const navVisible = useAppSettings(s => s.navVisible);
  const setNavVisible = useAppSettings(s => s.setNavVisible);
  const dndTools = useAppSettings(s => s.dndTools);
  const setDndTool = useAppSettings(s => s.setDndTool);

  return (
    <div className="flex flex-col divide-y divide-border">
      <SectionCard>
        <SectionHeader
          title="Navigation"
          description="Choose which sections appear in the sidebar. Hidden sections are still accessible via direct URL."
        />
        <div className="divide-y divide-border -my-2.5">
          {NAV_ITEMS.map(item => (
            <Toggle
              key={item.path}
              checked={navVisible[item.path] !== false}
              onChange={val => setNavVisible(item.path, val)}
              label={item.label}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard>
        <SectionHeader
          title="D&D / TTRPG Tools"
          description="Optional tabletop RPG utilities. When enabled, tools appear as individual sidebar entries below the main navigation."
        >
          <span className="badge mt-2 text-amber-400 border-amber-400/40">
            <FlaskConical size={11} /> Beta
          </span>
        </SectionHeader>
        <div className="divide-y divide-border -my-2.5">
          <Toggle
            checked={dndTools.enabled}
            onChange={val => setDndTool('enabled', val)}
            label="Enable DnD Tools"
            description="Shows DnD tool entries in the sidebar."
          />
          {dndTools.enabled && (
            <>
              <Toggle
                checked={dndTools.diceRoller}
                onChange={val => setDndTool('diceRoller', val)}
                label="Dice Roller"
                description="Roll d4, d6, d8, d10, d12, d20, and d100 with animated results."
              />
              <Toggle
                checked={dndTools.initiativeTracker}
                onChange={val => setDndTool('initiativeTracker', val)}
                label="Initiative Tracker"
                description="Track turn order, HP, and conditions for combat encounters."
              />
              <Toggle
                checked={dndTools.encounterRoller}
                onChange={val => setDndTool('encounterRoller', val)}
                label="Encounter Tables"
                description="Create and roll on custom random encounter tables."
              />
              <Toggle
                checked={dndTools.spellSlots}
                onChange={val => setDndTool('spellSlots', val)}
                label="Spell Slots"
                description="Track spell slots by level for one or more characters."
              />
              <Toggle
                checked={dndTools.conditionRef}
                onChange={val => setDndTool('conditionRef', val)}
                label="Condition Reference"
                description="Quick rules reference for all D&D 5e conditions with full effect text."
              />
              <Toggle
                checked={dndTools.lootGenerator}
                onChange={val => setDndTool('lootGenerator', val)}
                label="Loot Generator"
                description="Generate CR-appropriate treasure hoards with currency, gems, and magic items."
              />
              <Toggle
                checked={dndTools.nameGenerator}
                onChange={val => setDndTool('nameGenerator', val)}
                label="Name Generator"
                description="Random NPC and place names by race and gender, with save support."
              />
            </>
          )}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Appearance tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { theme, fontSize, density, showAppTitle, update } = useAppSettings();

  return (
    <div className="flex flex-col divide-y divide-border">
      <SectionCard>
        <SectionHeader title="Theme" description="Choose a color palette for the interface. System follows your device's light or dark mode." />
        <ThemePicker value={theme} onChange={val => update({ theme: val })} />
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Text Size" description="Adjusts the base font size across the app." />
        <SegmentedControl
          value={fontSize}
          onChange={val => update({ fontSize: val })}
          options={[
            { value: 'sm', label: 'Small' },
            { value: 'md', label: 'Medium' },
            { value: 'lg', label: 'Large' },
          ]}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Density" description="Controls spacing and padding throughout the interface." />
        <SegmentedControl
          value={density}
          onChange={val => update({ density: val })}
          options={[
            { value: 'compact',     label: 'Compact' },
            { value: 'comfortable', label: 'Comfortable' },
            { value: 'spacious',    label: 'Spacious' },
          ]}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Interface Options" />
        <div className="divide-y divide-border -my-2.5">
          <Toggle
            checked={showAppTitle}
            onChange={val => update({ showAppTitle: val })}
            label="Show App Title"
            description="Show the 'Realm Lore' name next to the logo in the top bar."
          />
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Editor tab ───────────────────────────────────────────────────────────────

function EditorTab() {
  const { autosaveDelay, defaultListView, showWordCount, showEntityCounts, update } = useAppSettings();

  return (
    <div className="flex flex-col divide-y divide-border">
      <SectionCard>
        <SectionHeader title="Autosave" />
        <SelectField
          label="Autosave delay"
          description="How long after you stop typing before changes are saved automatically."
          value={String(autosaveDelay)}
          onChange={val => update({ autosaveDelay: parseInt(val, 10) })}
          options={[
            { value: '300',  label: '0.3 seconds (fastest)' },
            { value: '800',  label: '0.8 seconds (default)' },
            { value: '1500', label: '1.5 seconds' },
            { value: '3000', label: '3 seconds' },
            { value: '0',    label: 'Off (manual save only)' },
          ]}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Lists & Views" />
        <SegmentedControl
          label="Default list view"
          value={defaultListView}
          onChange={val => update({ defaultListView: val })}
          options={[
            { value: 'grid', label: 'Grid' },
            { value: 'list', label: 'List' },
          ]}
        />
      </SectionCard>

      <SectionCard>
        <SectionHeader title="Display" />
        <div className="divide-y divide-border -my-2.5">
          <Toggle
            checked={showWordCount}
            onChange={val => update({ showWordCount: val })}
            label="Show word count"
            description="Display word count in the story editor toolbar."
          />
          <Toggle
            checked={showEntityCounts}
            onChange={val => update({ showEntityCounts: val })}
            label="Show entity counts in sidebar"
            description="Show the number of entries next to each section."
          />
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Data tab (all existing panels) ──────────────────────────────────────────

function formatRelativeTime(isoString) {
  if (!isoString) return null;
  const then = new Date(isoString);
  if (isNaN(then.getTime())) return null;
  const diffMs = Date.now() - then.getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec} seconds ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} minute${min === 1 ? '' : 's'} ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hour${hr === 1 ? '' : 's'} ago`;
  const day = Math.round(hr / 24);
  return `${day} day${day === 1 ? '' : 's'} ago`;
}

function ExportPanel({ activeWorld, characters, locations, things, lore, factions, creatures, stories, relationships, books, maps }) {
  const fullData = {
    world: activeWorld,
    exportedAt: new Date().toISOString(),
    version: '1.1',
    characters, locations, things, lore, factions, creatures,
    stories, relationships, books, maps,
  };

  const download = (content, filename, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportFullBackup = () =>
    download(JSON.stringify(fullData, null, 2), `${activeWorld}-full-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');

  const handleExportJSON = () => {
    const slim = { ...fullData };
    delete slim.maps;
    download(JSON.stringify(slim, null, 2), `${activeWorld}-export-${Date.now()}.json`, 'application/json');
  };

  const handleExportMarkdown = () => {
    const sections = [
      { title: 'Characters', items: characters },
      { title: 'Locations',  items: locations  },
      { title: 'Things',     items: things     },
      { title: 'Lore',       items: lore.filter(e => !e._isTimelineEvent) },
      { title: 'Factions',   items: factions   },
      { title: 'Creatures',  items: creatures  },
    ];
    const PROSE_KEYS = ['description', 'background', 'personality', 'history', 'atmosphere', 'notes', 'origin', 'abilities', 'doctrine', 'goals', 'culture', 'appearance', 'motivation'];
    const lines = [`# ${activeWorld} — World Export\n`];
    for (const { title, items } of sections) {
      if (!items.length) continue;
      lines.push(`\n---\n\n## ${title}\n`);
      for (const e of items) {
        lines.push(`### ${e.name || 'Untitled'}`);
        if (e.alias) lines.push(`*"${e.alias}"*`);
        if (e.type || e.subtype) lines.push(`**Type:** ${e.type || e.subtype}`);
        if (e.status) lines.push(`**Status:** ${e.status}`);
        if (Array.isArray(e.tags) && e.tags.length) lines.push(`**Tags:** ${e.tags.join(', ')}`);
        PROSE_KEYS.forEach(k => { if (e[k]) lines.push(`\n**${k.charAt(0).toUpperCase() + k.slice(1)}:**\n${e[k].replace(/\[\[([^\]]+)\]\]/g, '$1')}`); });
        lines.push('');
      }
    }
    if (stories.length) {
      lines.push(`\n---\n\n## Stories\n`);
      stories.forEach(s => {
        lines.push(`### ${s.name || 'Untitled'}`);
        if (s.content) lines.push(s.content.replace(/\f/g, '\n\n').replace(/\[\[([^\]]+)\]\]/g, '$1'));
        lines.push('');
      });
    }
    download(lines.join('\n'), `${activeWorld}-export-${Date.now()}.md`, 'text/markdown');
  };

  const total = characters.length + locations.length + things.length + lore.length +
    factions.length + creatures.length + stories.length + books.length;

  return (
    <SectionCard>
      <SectionHeader
        title="Export World"
        description={`Download all data for ${activeWorld}. Currently ${total} entr${total === 1 ? 'y' : 'ies'} across characters, locations, things, lore, factions, creatures, books, and stories.`}
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={async () => {
             try {
               await api.exportWorld(activeWorld);
             } catch (e) { alert('Export failed: ' + e.message); }
          }}
          className="btn btn-primary"
          title="Exports the complete world folder as a ZIP archive"
        >
          <Download /> Export ZIP Archive
        </button>
        <button
          onClick={handleExportFullBackup}
          className="btn btn-outline"
          title="Includes every collection — restorable round-trip"
        >
          <Download /> Full Backup (.json)
        </button>
        <button
          onClick={handleExportJSON}
          className="btn btn-outline"
          title="Excludes map images for a smaller, human-readable file"
        >
          <Download /> Export JSON (slim)
        </button>
        <button
          onClick={handleExportMarkdown}
          className="btn btn-outline"
        >
          <Download /> Export Markdown
        </button>
      </div>
    </SectionCard>
  );
}

function ImportPanel() {
  const [status, setStatus] = useState(null);

  const handleImport = async () => {
    setStatus('reading');
    try {
      const result = await api.openWorld();
      if (result?.canceled) { setStatus(null); return; }
      if (result?.error) { setStatus(`Error: ${result.error}`); return; }
      setStatus(`World "${result.world}" imported. Switch to it from the world selector.`);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  };

  return (
    <SectionCard>
      <SectionHeader
        title="Import World Folder"
        description="Upload a world's folder of Markdown files from your computer — the same format Realm Lore saves on the server."
      />
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={handleImport}
          className="btn btn-outline"
        >
          <Upload /> Upload World Folder…
        </button>
        <button
          onClick={async () => {
            setStatus('importing zip...');
            try {
              const res = await api.importWorld();
              if (res?.canceled) { setStatus(null); return; }
              if (res?.error) { setStatus(`Error: ${res.error}`); return; }
              setStatus(`World "${res.world}" imported from ZIP. Switch to it from the world selector.`);
            } catch (err) {
              setStatus(`Error: ${err.message}`);
            }
          }}
          className="btn btn-outline"
        >
          <Upload /> Import ZIP Archive…
        </button>
      </div>
      {status && status !== 'reading' && (
        <div className={`flex items-start gap-2 text-sm ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {status.startsWith('Error') ? <AlertCircle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
          {status}
        </div>
      )}
    </SectionCard>
  );
}

function AutomatedBackupPanel() {
  const config        = useWorldStore(state => state.backupConfig);
  const updateConfig  = useWorldStore(state => state.updateBackupConfig);
  const triggerBackup = useWorldStore(state => state.triggerBackup);
  const activeWorld   = useWorldStore(state => state.activeWorld);

  const [location, setLocation]           = useState(config.location);
  const [frequency, setFrequency]         = useState(String(config.frequency));
  const [retentionDays, setRetentionDays] = useState(String(config.retentionDays ?? 30));
  const [status, setStatus]               = useState('');

  // The schedule loads from the server after the app starts; pick it up if it
  // arrives (or changes) while this panel is open.
  const savedKey = `${config.location}|${config.frequency}|${config.retentionDays}`;
  const [seenKey, setSeenKey] = useState(savedKey);
  if (savedKey !== seenKey) {
    setSeenKey(savedKey);
    setLocation(config.location);
    setFrequency(String(config.frequency));
    setRetentionDays(String(config.retentionDays ?? 30));
  }
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const handleSave = async () => {
    try {
      await updateConfig({ location, frequency: parseInt(frequency, 10) || 0, retentionDays: parseInt(retentionDays, 10) || 0 });
      setStatus('Saved successfully');
      setTimeout(() => setStatus(''), 2000);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const handleForce = async () => {
    setStatus('Backing up...');
    try {
      const result = await triggerBackup();
      const pruneNote = result?.pruned ? ` (pruned ${result.pruned} old day${result.pruned === 1 ? '' : 's'})` : '';
      setStatus(`Backup saved to: ${result?.path || config.location}${pruneNote}`);
      setTimeout(() => setStatus(''), 4000);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
  };

  const lastBackupRel = formatRelativeTime(config.lastBackupAt);

  return (
    <SectionCard>
      <SectionHeader
        title="Automated Backups"
        description="The server backs up all of your worlds on a schedule, even while no one has Realm Lore open. Backups are organized by world → date → time."
      >
        {lastBackupRel && (
          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={12} className="text-green-400" />
            Last backup: <strong className="font-medium text-foreground">{lastBackupRel}</strong>
          </p>
        )}
      </SectionHeader>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-1.5 block">Backup location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="input font-mono"
            placeholder="Backups"
          />
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {['Backups', '/backups'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setLocation(preset)}
                className="badge font-mono hover:bg-accent hover:text-foreground transition-colors"
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground mt-1.5">
            A plain folder name is created inside the server's data folder. An absolute path (starting with <code className="bg-muted px-1 rounded">/</code>) must be a folder mounted into the server's container.
            Each backup ends up at <code className="bg-muted px-1 rounded">{location || 'Backups'}/{activeWorld}/YYYY-MM-DD/HH-MM-SS/</code>.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <SelectField
            label="Frequency"
            value={frequency}
            onChange={setFrequency}
            options={[
              { value: '0',  label: 'Off' },
              { value: '2',  label: 'Every 2 minutes' },
              { value: '5',  label: 'Every 5 minutes' },
              { value: '15', label: 'Every 15 minutes' },
              { value: '30', label: 'Every 30 minutes' },
              { value: '60', label: 'Every 1 hour' },
            ]}
          />
          <SelectField
            label="Keep History For"
            value={retentionDays}
            onChange={setRetentionDays}
            options={[
              { value: '0',  label: 'Forever' },
              { value: '7',  label: '7 days' },
              { value: '15', label: '15 days' },
              { value: '30', label: '30 days' },
              { value: '60', label: '60 days' },
              { value: '90', label: '90 days' },
            ]}
          />
        </div>

        <div className="flex items-center gap-2 mt-1">
          <button
            onClick={handleSave}
            className="btn btn-primary"
          >
            Save settings
          </button>
          <button
            onClick={handleForce}
            title={`Back up ${activeWorld} right away`}
            className="btn btn-outline"
          >
            Back up now
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Back up now saves a copy of <strong className="text-muted-foreground">{activeWorld}</strong> immediately; scheduled backups cover every world.
        </p>
        {status && (
          <p className={`text-xs font-medium ${status.startsWith('Error') ? 'text-destructive' : status.includes('saved') || status.includes('Saved') ? 'text-green-400' : 'text-muted-foreground'}`}>
            {status}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function StorageInfoPanel({ activeWorld, characters, locations, things, lore, stories }) {
  const [worldsPath, setWorldsPath] = useState(null);
  useEffect(() => {
    api.getPaths().then(p => setWorldsPath(p.worlds)).catch(() => {});
  }, []);

  return (
    <SectionCard>
      <SectionHeader
        title="Storage"
        description="Your worlds live as Markdown files in this folder on the server. Back it up or keep it in a Git repo like any other folder."
      />
      {worldsPath && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2">
          <code className="text-xs text-muted-foreground font-mono flex-1 truncate">{worldsPath}</code>
        </div>
      )}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[
          { label: 'Characters', val: characters.length },
          { label: 'Locations',  val: locations.length },
          { label: 'Things',     val: things.length },
          { label: 'Lore',       val: lore.length },
          { label: 'Stories',    val: stories.length },
        ].map(({ label, val }) => (
          <div key={label} className="card px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-base font-semibold text-foreground">{val}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Files are saved to <code className="bg-muted px-1 py-0.5 rounded text-xs">Worlds/{activeWorld}/</code> and are editable in any text editor or Obsidian.
        Deleted entries move to{' '}
        <Link to="/trash" className="text-brand font-medium underline-offset-2 hover:underline">Trash</Link>
        {' '}until restored or purged.
      </p>
    </SectionCard>
  );
}

function CustomTypesPanel() {
  const customTypes = useWorldStore(state => state.customTypes);
  const addCustomType = useWorldStore(state => state.addCustomType);
  const updateCustomType = useWorldStore(state => state.updateCustomType);
  const deleteCustomType = useWorldStore(state => state.deleteCustomType);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ label: '', singular: '', icon: 'box' });

  const handleAddClick = () => {
    setForm({ label: '', singular: '', icon: 'box' });
    setEditingId(null);
    setIsEditing(true);
  };

  const handleEditClick = (type) => {
    setForm({ label: type.label, singular: type.singular, icon: type.icon });
    setEditingId(type.id);
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!form.label.trim() || !form.singular.trim()) return;
    if (editingId) {
      await updateCustomType(editingId, form);
    } else {
      await addCustomType(form);
    }
    setIsEditing(false);
  };

  const handleDelete = async (id) => {
    if (confirm("Are you sure? This will also delete all entities of this custom type!")) {
      await deleteCustomType(id);
    }
  };

  return (
    <SectionCard>
      <SectionHeader
        title="Custom Entity Types"
        description="Create custom categories to organize your world beyond the defaults."
      >
        {!isEditing && (
          <button onClick={handleAddClick} className="btn btn-outline btn-sm mt-3">
            <Plus /> Add type
          </button>
        )}
      </SectionHeader>

      {isEditing ? (
        <div className="card bg-surface p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Plural Name (e.g. Spells)</label>
              <input
                type="text"
                value={form.label}
                onChange={e => setForm({ ...form, label: e.target.value })}
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Singular Name (e.g. Spell)</label>
              <input
                type="text"
                value={form.singular}
                onChange={e => setForm({ ...form, singular: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isSelected = form.icon === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setForm({ ...form, icon: opt.value })}
                    title={opt.label}
                    className={`btn btn-icon border ${isSelected ? 'border-brand bg-brand-soft text-brand' : 'border-input bg-background text-muted-foreground hover:text-foreground'}`}
                  >
                    <Icon />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <button
              onClick={() => setIsEditing(false)}
              className="btn btn-ghost"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="btn btn-primary"
            >
              Save custom type
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          {customTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 border border-dashed border-border rounded-lg text-center">
              <Layers size={24} className="text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No custom types defined yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">{customTypes.map(type => {
              const IconData = ICON_OPTIONS.find(o => o.value === type.icon) || ICON_OPTIONS[0];
              const Icon = IconData.icon;
              return (
                <div key={type.id} className="flex items-center justify-between px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="size-8 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                      <Icon size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground leading-none">{type.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">Singular: {type.singular}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => handleEditClick(type)} className="btn btn-ghost btn-icon btn-sm" aria-label="Edit type">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => handleDelete(type.id)} className="btn btn-ghost btn-icon btn-sm !text-destructive hover:!bg-destructive/10" aria-label="Delete type">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}</div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

function DeleteWorldPanel({ activeWorld, deleteWorld }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);

  const handleDelete = async () => {
    try {
      await deleteWorld(activeWorld);
      setConfirming(false);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <SectionCard>
      <SectionHeader
        title="Delete world"
        tone="danger"
        description="Permanently delete this world and all of its entities. This cannot be undone."
      />
      {!confirming ? (
        <button onClick={() => setConfirming(true)} className="btn btn-destructive self-start">
          <Trash2 /> Delete {activeWorld}…
        </button>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm font-medium text-foreground">Delete <strong>{activeWorld}</strong>? This cannot be undone.</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => { setConfirming(false); setError(null); }} className="btn btn-outline">
              Cancel
            </button>
            <button onClick={handleDelete} className="btn bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Confirm delete
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function ResetAppSettings() {
  const reset = useAppSettings(s => s.reset);
  const [done, setDone] = useState(false);
  return (
    <SectionCard>
      <SectionHeader title="Reset Preferences" description="Restore all appearance, navigation, and editor settings to their defaults. Your world data is not affected." />
      <button
        onClick={() => { reset(); setDone(true); setTimeout(() => setDone(false), 2000); }}
        className="btn btn-outline self-start"
      >
        {done ? <><CheckCircle2 className="text-green-400" /> Reset applied</> : 'Reset to defaults'}
      </button>
    </SectionCard>
  );
}

function DataTab({ activeWorld, characters, locations, things, lore, factions, creatures, stories, relationships, books, maps, deleteWorld }) {
  return (
    <div className="flex flex-col divide-y divide-border">
      <StorageInfoPanel activeWorld={activeWorld} characters={characters} locations={locations} things={things} lore={lore} stories={stories} />
      <CustomTypesPanel />
      <AutomatedBackupPanel />
      <ExportPanel activeWorld={activeWorld} characters={characters} locations={locations} things={things} lore={lore} factions={factions} creatures={creatures} stories={stories} relationships={relationships} books={books} maps={maps} />
      <ImportPanel />
      <DeleteWorldPanel activeWorld={activeWorld} deleteWorld={deleteWorld} />
    </div>
  );
}

// ─── Main Settings page ───────────────────────────────────────────────────────

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');

  const activeWorld     = useWorldStore(state => state.activeWorld);
  const characters      = useWorldStore(state => state.characters);
  const locations       = useWorldStore(state => state.locations);
  const things          = useWorldStore(state => state.things);
  const lore            = useWorldStore(state => state.lore);
  const factions        = useWorldStore(state => state.factions);
  const creatures       = useWorldStore(state => state.creatures);
  const stories         = useWorldStore(state => state.stories);
  const relationships   = useWorldStore(state => state.relationships);
  const books           = useWorldStore(state => state.books);
  const maps            = useWorldStore(state => state.maps);
  const deleteWorld     = useWorldStore(state => state.deleteWorld);

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="page-narrow">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Customize your Realm Lore experience.</p>

        {/* Tabs — a quiet underline row that scrolls sideways on phones */}
        <div className="mt-6 -mx-4 overflow-x-auto scrollbar-none border-b border-border px-4 sm:mx-0 sm:px-0" role="tablist">
          <div className="flex gap-1">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`-mb-px flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 pb-2.5 pt-1 text-sm font-medium transition-colors ${active ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'general' && <GeneralTab />}
        {activeTab === 'appearance' && (
          <div className="flex flex-col divide-y divide-border">
            <AppearanceTab />
            <ResetAppSettings />
          </div>
        )}
        {activeTab === 'editor' && <EditorTab />}
        {activeTab === 'data' && (
          <DataTab
            activeWorld={activeWorld}
            characters={characters}
            locations={locations}
            things={things}
            lore={lore}
            factions={factions}
            creatures={creatures}
            stories={stories}
            relationships={relationships}
            books={books}
            maps={maps}
            deleteWorld={deleteWorld}
          />
        )}
        {activeTab === 'about' && <AboutTab />}
      </div>
    </div>
  );
}
