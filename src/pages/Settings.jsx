import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { useAppSettings } from '../store/useAppSettings';
import {
  Download, Upload, CheckCircle2, AlertCircle, Trash2,
  Sliders, Database, Eye, Keyboard, ChevronRight,
  Globe, Users, Map, Library, Box, TrendingUp, MapPin,
  PawPrint, Wand2, Dna, Flag,
} from 'lucide-react';

// ─── Shared primitives ───────────────────────────────────────────────────────

function SectionCard({ children, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-card p-6 flex flex-col gap-4 ${className}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, description }) {
  return (
    <div>
      <h3 className="font-semibold text-base text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{description}</p>}
    </div>
  );
}

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 py-2 cursor-pointer group">
      <div>
        <p className="text-sm font-medium text-foreground group-hover:text-foreground/90">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-10 h-5.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${checked ? 'bg-primary' : 'bg-secondary border border-border'}`}
        style={{ height: '22px', width: '40px' }}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-[18px]' : 'translate-x-0'}`}
        />
      </button>
    </label>
  );
}

function SegmentedControl({ value, onChange, options, label }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-sm font-medium text-foreground">{label}</label>}
      <div className="flex rounded-lg border border-border bg-secondary p-0.5 gap-0.5">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex-1 text-xs font-medium py-1.5 px-2 rounded-md transition-colors ${value === opt.value ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
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
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'general',    label: 'General',    icon: Sliders },
  { id: 'appearance', label: 'Appearance', icon: Eye },
  { id: 'editor',     label: 'Editor',     icon: Keyboard },
  { id: 'data',       label: 'Data',       icon: Database },
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

function GeneralTab() {
  const navVisible = useAppSettings(s => s.navVisible);
  const setNavVisible = useAppSettings(s => s.setNavVisible);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard>
        <SectionHeader
          title="Navigation"
          description="Choose which sections appear in the sidebar. Hidden sections are still accessible via direct URL."
        />
        <div className="divide-y divide-border -my-1">
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
    </div>
  );
}

// ─── Appearance tab ───────────────────────────────────────────────────────────

function AppearanceTab() {
  const { fontSize, density, update } = useAppSettings();

  return (
    <div className="flex flex-col gap-6">
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
    </div>
  );
}

// ─── Editor tab ───────────────────────────────────────────────────────────────

function EditorTab() {
  const { autosaveDelay, defaultListView, showWordCount, showEntityCounts, update } = useAppSettings();

  return (
    <div className="flex flex-col gap-6">
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
        <div className="divide-y divide-border -my-1">
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
          onClick={handleExportFullBackup}
          className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          title="Includes every collection — restorable round-trip"
        >
          <Download size={14} /> Full Backup (.json)
        </button>
        <button
          onClick={handleExportJSON}
          className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          title="Excludes map images for a smaller, human-readable file"
        >
          <Download size={14} /> Export JSON (slim)
        </button>
        <button
          onClick={handleExportMarkdown}
          className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
        >
          <Download size={14} /> Export Markdown
        </button>
      </div>
    </SectionCard>
  );
}

function ImportPanel({ addEntity, addBook, addRelationship }) {
  const fileRef = useRef(null);
  const [status, setStatus] = useState(null);

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus('reading');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      let imported = 0;
      const ENTITY_TYPES = ['characters', 'locations', 'things', 'lore', 'factions', 'creatures', 'stories'];
      for (const type of ENTITY_TYPES) {
        const list = data[type];
        if (!Array.isArray(list)) continue;
        for (const entity of list) {
          const rest = { ...entity };
          delete rest.id; delete rest.createdAt; delete rest.updatedAt;
          await addEntity(type, rest);
          imported++;
        }
      }
      if (Array.isArray(data.books)) {
        for (const book of data.books) {
          const rest = { ...book };
          delete rest.id; delete rest.createdAt; delete rest.updatedAt;
          await addBook(rest);
          imported++;
        }
      }
      if (Array.isArray(data.relationships)) {
        for (const r of data.relationships) {
          if (!r.fromId || !r.toId || !r.fromType || !r.toType) continue;
          await addRelationship(r.fromId, r.fromType, r.toId, r.toType, r.label || '');
          imported++;
        }
      }
      const skippedMaps = Array.isArray(data.maps) && data.maps.length;
      setStatus(
        `Imported ${imported} entries successfully.` +
        (skippedMaps ? ` (Skipped ${skippedMaps} map${skippedMaps === 1 ? '' : 's'} — re-attach images manually.)` : '')
      );
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
    e.target.value = '';
  };

  return (
    <SectionCard>
      <SectionHeader
        title="Import World"
        description="Import entities from a JSON export file. Existing entries are not overwritten — imported items get new IDs."
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="self-start flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors border border-border"
      >
        <Upload size={14} /> Choose File
      </button>
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      {status && status !== 'reading' && (
        <div className={`flex items-center gap-2 text-sm ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {status.startsWith('Error') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
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
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const handleSave = () => {
    updateConfig({ location, frequency: parseInt(frequency, 10) || 0, retentionDays: parseInt(retentionDays, 10) || 0 });
    setStatus('Saved successfully');
    setTimeout(() => setStatus(''), 2000);
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
      <div>
        <SectionHeader
          title="Automated Backups"
          description="Automatically back up the active world on a schedule. Backups are organized by world → date → time."
        />
        {lastBackupRel && (
          <p className="text-xs text-muted-foreground/80 mt-2 flex items-center gap-1.5">
            <CheckCircle2 size={11} className="text-green-400" />
            Last backup: <strong className="text-foreground">{lastBackupRel}</strong>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <label className="text-sm font-medium text-foreground mb-1 block">Backup Location</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            placeholder="Backups"
          />
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {['Backups', '~/Desktop/WorldBackups', '~/Documents/WorldBackups'].map(preset => (
              <button
                key={preset}
                type="button"
                onClick={() => setLocation(preset)}
                className="text-xs px-2 py-0.5 rounded bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors font-mono"
              >
                {preset}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground/60 mt-1.5">
            Relative paths are inside the app folder. Absolute paths (starting with <code className="bg-secondary px-1 rounded">/</code> or <code className="bg-secondary px-1 rounded">~</code>) save elsewhere.
            Each backup ends up at <code className="bg-secondary px-1 rounded">{location || 'Backups'}/{activeWorld}/YYYY-MM-DD/HH-MM-SS/</code>.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            className="flex-1 h-9 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Save Settings
          </button>
          <button
            onClick={handleForce}
            className="flex-1 h-9 rounded-md text-sm font-medium bg-secondary text-foreground border border-border hover:bg-secondary/80 transition-colors"
          >
            Force Backup Now
          </button>
        </div>
        {status && (
          <p className={`text-xs font-medium ${status.startsWith('Error') ? 'text-red-400' : status.includes('saved') || status.includes('Saved') ? 'text-green-500' : 'text-blue-500'}`}>
            {status}
          </p>
        )}
      </div>
    </SectionCard>
  );
}

function StorageInfoPanel({ activeWorld, characters, locations, things, lore, stories }) {
  return (
    <SectionCard>
      <SectionHeader
        title="Storage"
        description={`Your worlds live as Markdown on disk under Worlds/. Put that folder in Dropbox, iCloud Drive, or a Git repo to sync across machines.`}
      />
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Characters', val: characters.length },
          { label: 'Locations',  val: locations.length },
          { label: 'Things',     val: things.length },
          { label: 'Lore',       val: lore.length },
          { label: 'Stories',    val: stories.length },
        ].map(({ label, val }) => (
          <div key={label} className="rounded-lg bg-secondary/50 px-3 py-2">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold text-foreground">{val}</p>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">
        Files are saved to <code className="bg-secondary px-1 py-0.5 rounded text-xs">Worlds/{activeWorld}/</code> and are editable in any text editor or Obsidian.
        Deleted entries move to{' '}
        <Link to="/trash" className="text-primary font-medium underline-offset-2 hover:underline">Trash</Link>
        {' '}until restored or purged.
      </p>
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
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex flex-col gap-3">
      <h3 className="font-semibold text-base text-red-500 flex items-center gap-2">
        <Trash2 size={16} /> Delete World
      </h3>
      <p className="text-sm text-red-500/80">
        Permanently delete <strong>{activeWorld}</strong> and all of its entities. This cannot be undone.
      </p>
      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="self-start h-9 px-4 rounded-md text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors"
        >
          Delete World…
        </button>
      ) : (
        <div className="flex flex-col gap-3 mt-1 bg-background/50 p-4 rounded-lg border border-red-500/20">
          <p className="text-sm font-medium text-foreground">Are you sure? This cannot be undone.</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirming(false); setError(null); }}
              className="flex-1 h-9 rounded-md text-sm font-medium bg-secondary text-foreground hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="flex-1 h-9 rounded-md text-sm font-medium bg-red-600 text-white hover:bg-red-500 transition-colors"
            >
              Confirm Delete
            </button>
          </div>
        </div>
      )}
    </div>
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
        className="self-start flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
      >
        {done ? <><CheckCircle2 size={14} className="text-green-400" /> Reset applied</> : 'Reset to Defaults'}
      </button>
    </SectionCard>
  );
}

function DataTab({ activeWorld, characters, locations, things, lore, factions, creatures, stories, relationships, books, maps, addEntity, addBook, addRelationship, deleteWorld }) {
  return (
    <div className="flex flex-col gap-6">
      <StorageInfoPanel activeWorld={activeWorld} characters={characters} locations={locations} things={things} lore={lore} stories={stories} />
      <AutomatedBackupPanel />
      <ExportPanel activeWorld={activeWorld} characters={characters} locations={locations} things={things} lore={lore} factions={factions} creatures={creatures} stories={stories} relationships={relationships} books={books} maps={maps} />
      <ImportPanel addEntity={addEntity} addBook={addBook} addRelationship={addRelationship} />
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
  const addEntity       = useWorldStore(state => state.addEntity);
  const addBook         = useWorldStore(state => state.addBook);
  const addRelationship = useWorldStore(state => state.addRelationship);
  const deleteWorld     = useWorldStore(state => state.deleteWorld);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Page header */}
      <header className="flex items-center gap-3 px-6 py-5 border-b border-border bg-card">
        <Sliders size={18} className="text-muted-foreground" />
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Settings</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Customize your WorldBuilder experience.</p>
        </div>
      </header>

      <div className="flex min-h-0">
        {/* Sidebar tabs */}
        <nav className="hidden md:flex flex-col w-52 shrink-0 border-r border-border bg-card/50 p-3 gap-0.5 min-h-full">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors text-left w-full ${active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
              >
                <Icon size={15} />
                {tab.label}
                {active && <ChevronRight size={13} className="ml-auto opacity-60" />}
              </button>
            );
          })}
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden flex border-b border-border bg-card/50 w-full overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0 ${active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        <div className="flex-1 p-6 max-w-2xl">
          {activeTab === 'general' && <GeneralTab />}
          {activeTab === 'appearance' && (
            <div className="flex flex-col gap-6">
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
              addEntity={addEntity}
              addBook={addBook}
              addRelationship={addRelationship}
              deleteWorld={deleteWorld}
            />
          )}
        </div>
      </div>
    </div>
  );
}
