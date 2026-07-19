import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, RotateCcw, ArrowLeft, Loader2, Skull, Search, X } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import ConfirmModal from '../components/ConfirmModal';

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
  const navigate = useNavigate();
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
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md mb-5 border-b border-border/40 shadow-sm">
        <div className="max-w-3xl w-full px-4 pt-6 pb-3 md:px-8 md:pt-8 flex flex-col gap-5">
          <header>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Trash2 size={22} className="text-muted-foreground shrink-0" />
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Trash</h2>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">
                Deleted entries from “{activeWorld}”. Restore sends them back to your library.
              </p>
            </div>
          </header>
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="relative w-full sm:w-72 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search trash..."
                className="w-full pl-9 pr-9 py-2 text-sm bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-all"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>


      <div className="max-w-3xl px-4 md:px-8">
        {loading && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 size={14} className="animate-spin" /> Loading trash…
          </div>
        )}
        {error && (
          <p className="text-sm text-red-400 mb-4">{error}</p>
        )}
        {!loading && items.length === 0 && !error && (
          <p className="text-sm text-muted-foreground italic">Trash is empty.</p>
        )}
        {!loading && !error && items.length > 0 && (
          <ul className="rounded-xl border border-border divide-y divide-border bg-card overflow-hidden">
            {(query.trim() ? items.filter(i => (i.entity?.name || 'Untitled').toLowerCase().includes(query.trim().toLowerCase())) : items).map(row => (
              <li key={row.trashPath} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {COLL_LABEL[row.collection] || row.collection} · <span className="font-mono text-xs opacity-70">{row.id.slice(0, 8)}…</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">{row.trashPath}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRestoreTarget(row)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border hover:bg-secondary transition-colors shrink-0"
                  title="Restore to library"
                >
                  <RotateCcw size={12} /> Restore
                </button>
                <button
                  type="button"
                  onClick={() => setPurgeTarget(row)}
                  className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                  title="Delete forever"
                >
                  <Skull size={12} /> Purge
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
