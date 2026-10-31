import { useEffect, useState, useCallback } from 'react';
import { Trash2, RotateCcw, Loader2, Skull, Search, X } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import ConfirmModal from '../components/ConfirmModal';
import { displayWorldName } from '../lib/worlds';

const COLL_LABEL = {
  characters: 'Character',
  locations: 'Location',
  things: 'Thing',
  lore: 'Lore',
  factions: 'Faction',
  creatures: 'Creature',
  races: 'Race',
  stories: 'Story',
  relationships: 'Relationship',
  maps: 'Map',
  books: 'Book',
  customStamps: 'Custom stamp',
};

export default function Trash() {
  const activeWorld = useWorldStore(s => s.activeWorld);
  const listTrashItems = useWorldStore(s => s.listTrashItems);
  const restoreTrashEntry = useWorldStore(s => s.restoreTrashEntry);
  const purgeTrashEntry = useWorldStore(s => s.purgeTrashEntry);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restoreTarget, setRestoreTarget] = useState(null);
  const [purgeTarget, setPurgeTarget] = useState(null);
  const [query, setQuery] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const rows = await listTrashItems();
      setItems(rows);
    } catch (e) {
      setError(e.message || String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [listTrashItems]);

  useEffect(() => {
    const id = requestAnimationFrame(() => { void refresh(); });
    return () => cancelAnimationFrame(id);
  }, [refresh, activeWorld]);

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="page-narrow">
        <header className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="page-title">Trash</h1>
            <p className="page-subtitle">
              Deleted entries from “{displayWorldName(activeWorld)}”. Restore sends them back to your library.
            </p>
          </div>
        </header>

        <div className="relative mt-6 mb-4 w-full sm:w-64">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search trash…"
            className="input pl-8 pr-8"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading trash…
          </div>
        )}
        {error && (
          <p className="text-sm text-destructive mb-4">{error}</p>
        )}
        {!loading && items.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-14 text-center">
            <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
              <Trash2 size={18} />
            </span>
            <p className="text-sm font-semibold text-foreground">Trash is empty</p>
            <p className="mt-1 text-sm text-muted-foreground">Deleted entries show up here until you restore or purge them.</p>
          </div>
        )}
        {!loading && !error && items.length > 0 && (
          <ul className="rounded-lg border border-border divide-y divide-border bg-card overflow-hidden">
            {(query.trim() ? items.filter(i => (i.entity?.name || 'Untitled').toLowerCase().includes(query.trim().toLowerCase())) : items).map(row => (
              <li key={row.trashPath} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-accent/60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {COLL_LABEL[row.collection] || row.collection} · <span className="font-mono text-xs text-muted-foreground">{row.id.slice(0, 8)}…</span>
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{row.trashPath}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoreTarget(row)}
                  className="btn btn-outline btn-sm"
                  title="Restore to library"
                >
                  <RotateCcw /> Restore
                </button>
                <button
                  type="button"
                  onClick={() => setPurgeTarget(row)}
                  className="btn btn-destructive btn-sm"
                  title="Delete forever"
                >
                  <Skull /> Purge
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {restoreTarget && (
        <ConfirmModal
          title="Restore entry?"
          message={`This puts the file back at its original path (${restoreTarget.collection}/${restoreTarget.id}.md). If something already replaced it, restore will fail.`}
          confirmLabel="Restore"
          onConfirm={async () => {
            try {
              await restoreTrashEntry(restoreTarget.trashPath);
              setRestoreTarget(null);
              await refresh();
            } catch (e) {
              alert(e.message || String(e));
            }
          }}
          onClose={() => setRestoreTarget(null)}
        />
      )}
      {purgeTarget && (
        <ConfirmModal
          title="Delete forever?"
          message="This permanently removes the file from trash. You cannot undo this."
          confirmLabel="Purge"
          onConfirm={async () => {
            try {
              await purgeTrashEntry(purgeTarget.trashPath);
              setPurgeTarget(null);
              await refresh();
            } catch (e) {
              alert(e.message || String(e));
            }
          }}
          onClose={() => setPurgeTarget(null)}
        />
      )}
    </div>
  );
}
