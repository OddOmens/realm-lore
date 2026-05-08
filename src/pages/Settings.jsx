import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { Download, Upload, CheckCircle2, AlertCircle, Settings as SettingsIcon, Trash2 } from 'lucide-react';

function ExportPanel({ activeWorld, characters, locations, things, lore, factions, creatures, stories, relationships, books, maps }) {
  // Single source of truth for what "full backup" contains, so JSON, Markdown,
  // and the displayed counts stay in sync.
  const fullData = {
    world: activeWorld,
    exportedAt: new Date().toISOString(),
    version: '1.1',
    characters, locations, things, lore, factions, creatures,
    stories, relationships, books, maps,
  };

  const handleExportFullBackup = () => {
    const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeWorld}-full-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Slimmer JSON without the full payload (drops base64 map images and
  // soft-derived collections so the file is human-friendlier).
  const handleExportJSON = () => {
    const slim = { ...fullData };
    delete slim.maps;
    const blob = new Blob([JSON.stringify(slim, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeWorld}-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeWorld}-export-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const total =
    characters.length + locations.length + things.length + lore.length +
    factions.length + creatures.length + stories.length + books.length;

  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
      <h3 className="font-semibold text-lg">Export World</h3>
      <p className="text-sm text-muted-foreground">
        Download all data for <strong>{activeWorld}</strong>.
        Currently <strong>{total}</strong> entr{total === 1 ? 'y' : 'ies'} across characters, locations, things, lore, factions, creatures, books, and stories.
      </p>
      <div className="flex gap-2 flex-wrap mt-1">
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
    </div>
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
      // Match the types exported by ExportPanel so a JSON round-trip is loss-free.
      const ENTITY_TYPES = ['characters', 'locations', 'things', 'lore', 'factions', 'creatures', 'stories'];
      for (const type of ENTITY_TYPES) {
        const list = data[type];
        if (!Array.isArray(list)) continue;
        for (const entity of list) {
          const rest = { ...entity };
          delete rest.id;
          delete rest.createdAt;
          delete rest.updatedAt;
          await addEntity(type, rest);
          imported++;
        }
      }
      if (Array.isArray(data.books)) {
        for (const book of data.books) {
          const rest = { ...book };
          delete rest.id;
          delete rest.createdAt;
          delete rest.updatedAt;
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
      // Note: maps are intentionally not auto-imported — they reference local
      // image files and would need user-driven re-attachment.
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
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
      <h3 className="font-semibold text-lg">Import World</h3>
      <p className="text-sm text-muted-foreground">
        Import entities from a JSON export file. Existing entries are not overwritten — imported items get new IDs.
      </p>
      <button
        onClick={() => fileRef.current?.click()}
        className="self-start flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors mt-1 border border-border"
      >
        <Upload size={14} /> Choose File
      </button>
      <input ref={fileRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      {status && status !== 'reading' && (
        <div className={`flex items-center gap-2 text-sm mt-1 ${status.startsWith('Error') ? 'text-red-400' : 'text-green-400'}`}>
          {status.startsWith('Error') ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
          {status}
        </div>
      )}
    </div>
  );
}

function DeleteWorldPanel({ activeWorld, deleteWorld }) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleDelete = async () => {
    if (!passcode) {
      setError('Passcode is required.');
      return;
    }
    try {
      await deleteWorld(activeWorld, passcode);
      setConfirming(false);
      setPasscode('');
      setError(null);
    } catch (err) {
      setError(err.message === 'UNAUTHORIZED' ? 'Invalid passcode' : err.message);
    }
  };

  return (
    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 flex flex-col gap-3">
      <h3 className="font-semibold text-lg text-red-500 flex items-center gap-2">
        <Trash2 size={18} /> Delete World
      </h3>
      <p className="text-sm text-red-500/80">
        Permanently delete <strong>{activeWorld}</strong> and all of its entities. This action cannot be undone.
      </p>

      {!confirming ? (
        <button
          onClick={() => setConfirming(true)}
          className="self-start h-9 px-4 rounded-md text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors mt-1"
        >
          Delete World...
        </button>
      ) : (
        <div className="flex flex-col gap-3 mt-2 bg-background/50 p-4 rounded-lg border border-red-500/20">
          <label className="text-sm font-medium text-foreground">Confirm with Passcode</label>
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            placeholder="Enter app passcode"
            className="w-full bg-card border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => { setConfirming(false); setPasscode(''); setError(null); }}
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

function AutomatedBackupPanel() {
  const config        = useWorldStore(state => state.backupConfig);
  const updateConfig  = useWorldStore(state => state.updateBackupConfig);
  const triggerBackup = useWorldStore(state => state.triggerBackup);
  const activeWorld   = useWorldStore(state => state.activeWorld);

  const [location, setLocation]           = useState(config.location);
  const [frequency, setFrequency]         = useState(String(config.frequency));
  const [retentionDays, setRetentionDays] = useState(String(config.retentionDays ?? 30));
  const [status, setStatus]               = useState('');
  // Tick once a minute so "X minutes ago" stays fresh without forcing backups.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const handleSave = () => {
    updateConfig({
      location,
      frequency: parseInt(frequency, 10) || 0,
      retentionDays: parseInt(retentionDays, 10) || 0,
    });
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
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-4">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Download size={18} /> Automated Backups
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Automatically back up the currently active world on a set schedule.
          Backups are organized by world → date → time, so it's easy to find a
          specific point in time.
        </p>
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
            Relative paths are inside the app folder. Use an absolute path (starting with <code className="bg-secondary px-1 rounded">/</code> or <code className="bg-secondary px-1 rounded">~</code>) to save elsewhere.
            Each backup ends up at <code className="bg-secondary px-1 rounded">{location || 'Backups'}/{activeWorld}/YYYY-MM-DD/HH-MM-SS/</code>.
          </p>
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground mb-1 block">Frequency</label>
            <select
              value={frequency}
              onChange={e => setFrequency(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="0">Off</option>
              <option value="2">Every 2 minutes</option>
              <option value="5">Every 5 minutes</option>
              <option value="15">Every 15 minutes</option>
              <option value="30">Every 30 minutes</option>
              <option value="60">Every 1 hour</option>
            </select>
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-foreground mb-1 block">Keep History For</label>
            <select
              value={retentionDays}
              onChange={e => setRetentionDays(e.target.value)}
              className="w-full bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="0">Forever (no cleanup)</option>
              <option value="7">7 days</option>
              <option value="15">15 days</option>
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-2">
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
        {status && <p className={`text-xs font-medium ${status.startsWith('Error') ? 'text-red-400' : status.includes('saved') || status.includes('Saved') ? 'text-green-500' : 'text-blue-500'}`}>{status}</p>}
      </div>
    </div>
  );
}

export default function Settings() {
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
      <header className="flex items-center gap-2.5 px-6 py-5 border-b border-border bg-card mb-8">
        <SettingsIcon size={20} className="text-muted-foreground" />
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Settings & Data</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your universe data.</p>
        </div>
      </header>
      <div className="px-6 pb-8">

      <div className="rounded-xl border border-border bg-card p-6 mb-8 max-w-3xl flex flex-col gap-3">
        <h3 className="font-semibold text-lg">Folders & sync</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your worlds live as Markdown on disk under <code className="bg-secondary px-1 py-0.5 rounded text-xs">Worlds/</code>.
          Put that folder in Dropbox, iCloud Drive, or a Git repo if you want the same universe on another machine.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          When you delete an entry it moves to{' '}
          <Link to="/trash" className="text-primary font-medium underline-offset-2 hover:underline">Trash</Link>
          {' '}until you restore or purge it (passcode required for purge).
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 max-w-3xl">
        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
          <h3 className="font-semibold text-lg">Local Storage Engine</h3>
          <p className="text-sm text-muted-foreground">
            Your data is saved directly to your hard drive as native <strong>.md</strong> files inside{' '}
            <code className="bg-secondary px-1 py-0.5 rounded text-xs">Worlds/{activeWorld}/</code>.
            <br /><br />
            To back up your universe, copy the <code className="bg-secondary px-1 py-0.5 rounded text-xs">Worlds/</code> folder or commit it to Git.
            Files are editable in any text editor or Obsidian.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 flex flex-col gap-3">
          <h3 className="font-semibold text-lg">Current World</h3>
          <p className="text-sm text-muted-foreground">
            Active world: <strong>{activeWorld}</strong>
          </p>
          <div className="grid grid-cols-2 gap-2 mt-1">
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
        </div>

        <ExportPanel
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
        />

        <ImportPanel
          addEntity={addEntity}
          addBook={addBook}
          addRelationship={addRelationship}
        />
        <AutomatedBackupPanel />
        <DeleteWorldPanel activeWorld={activeWorld} deleteWorld={deleteWorld} />
      </div>
      </div>
    </div>
  );
}
