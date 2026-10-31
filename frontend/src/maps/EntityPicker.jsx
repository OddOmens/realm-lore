import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import Modal from '../components/Modal';
import { TYPE_META } from './entities';

// ── Entity picker (used for both adding pins and choosing protagonist) ───────
export default function EntityPicker({ title, allowedTypes, onPick, onClose }) {
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);
  const [query, setQuery] = useState('');

  const all = useMemo(() => {
    const out = [];
    const add = (arr, type) => {
      if (allowedTypes && !allowedTypes.includes(type)) return;
      for (const e of arr) if (e.name) out.push({ ...e, _type: type });
    };
    add(characters, 'characters');
    add(locations, 'locations');
    add(things, 'things');
    add(lore.filter(e => !e._isTimelineEvent), 'lore');
    add(factions, 'factions');
    add(creatures, 'creatures');
    return out;
  }, [characters, locations, things, lore, factions, creatures, allowedTypes]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return all;
    return all.filter(e => e.name.toLowerCase().includes(q));
  }, [all, query]);

  return (
    <Modal title={title} onClose={onClose} size="md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name…"
            className="input pl-8"
          />
        </div>
        <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground italic p-6 text-center">No entities match.</p>
          ) : (
            filtered.map(e => {
              const meta = TYPE_META[e._type];
              const Icon = meta.icon;
              return (
                <button
                  key={`${e._type}-${e.id}`}
                  onClick={() => onPick(e)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/60 transition-colors"
                >
                  <span
                    className="shrink-0 w-7 h-7 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${meta.color}22`, border: `1px solid ${meta.color}55` }}
                  >
                    <Icon size={13} style={{ color: meta.color }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{e.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.label}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}
