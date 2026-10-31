import TextareaAutosize from 'react-textarea-autosize';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { 
  Plus, TrendingUp, Users, Map as MapIcon, Box, BookMarked,
  ExternalLink, Flag, PawPrint, Clock,
  Swords, Compass, Sparkles, Skull, Landmark, Flame, Eye, MapPin, Pencil, Trash2, Search, X
} from 'lucide-react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import PlainTextPreview from '../components/PlainTextPreview';

const TYPE_META = {
  characters: { color: 'text-blue-400',   dot: 'bg-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-500/10'   },
  locations:  { color: 'text-green-400',  dot: 'bg-green-400',  border: 'border-green-500/30',  bg: 'bg-green-500/10'  },
  things:     { color: 'text-amber-400',  dot: 'bg-amber-400',  border: 'border-amber-500/30',  bg: 'bg-amber-500/10'  },
  lore:       { color: 'text-purple-400', dot: 'bg-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
  factions:   { color: 'text-indigo-400', dot: 'bg-indigo-400', border: 'border-indigo-500/30', bg: 'bg-indigo-500/10' },
  creatures:  { color: 'text-orange-400', dot: 'bg-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-500/10' },
};

const TYPE_ICONS = { characters: Users, locations: MapIcon, things: Box, lore: BookMarked, factions: Flag, creatures: PawPrint };

function EventModal({ initial = {}, onSave, onClose, allEntities }) {
  const [values, setValues] = useState({
    title:       initial.title || '',
    date:        initial.date || '',
    year:        initial.year || 0,
    era:         initial.era || '',
    description: initial.description || '',
    type:        initial.type || 'event',
    linkedIds:   initial.linkedIds || [],
  });
  const set = (k, v) => setValues(p => ({ ...p, [k]: v }));

  const toggleEntity = (id) => {
    set('linkedIds', values.linkedIds.includes(id)
      ? values.linkedIds.filter(x => x !== id)
      : [...values.linkedIds, id]
    );
  };

  return (
    <Modal title={initial.id ? 'Edit event' : 'New event'} onClose={onClose} size="2xl">
      <form onSubmit={e => { e.preventDefault(); if (!values.title.trim()) return; onSave(values); }}>
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* Main Info (Left Column) */}
          <div className="flex-1 space-y-5">
            <div>
              <label className="block section-label mb-1.5">Event Title *</label>
              <input
                autoFocus
                value={values.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. The Fall of the Iron Throne"
                className="input h-9"
              />
            </div>

            <div>
              <label className="block section-label mb-1.5">Description</label>
              <TextareaAutosize
                value={values.description}
                onChange={e => set('description', e.target.value)}
                minRows={9}
                placeholder="What happened? Why does it matter?"
                className="input resize-none"
              />
            </div>

            <div>
              <label className="block section-label mb-1.5">Linked Entities</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-2" style={{ maxHeight: '200px' }}>
                {allEntities.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic p-1">No entities yet.</p>
                ) : allEntities.map(e => {
                  const meta = TYPE_META[e._type];
                  const Icon = TYPE_ICONS[e._type];
                  const checked = values.linkedIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEntity(e.id)}
                      className={`flex items-center gap-2.5 px-2.5 h-9 rounded-md border transition-colors text-left ${checked ? 'bg-brand-soft border-brand/30' : 'border-border hover:bg-accent'}`}
                    >
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-brand border-brand' : 'bg-background border-input'}`}>
                        {checked && <span className="text-brand-foreground text-[10px] leading-none font-bold">✓</span>}
                      </div>
                      <div className="flex items-center gap-2 min-w-0">
                        {Icon && <Icon size={14} className={`${meta.color} shrink-0`} />}
                        <span className={`text-sm truncate font-medium ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{e.name}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Metadata (Right Column) */}
          <div className="w-full md:w-64 shrink-0 space-y-4 bg-surface p-4 rounded-lg border border-border">
            <div>
              <label className="block section-label mb-1.5" title="Used for sorting">Year (Sort Order)</label>
              <input
                type="number"
                value={values.year}
                onChange={e => set('year', parseInt(e.target.value) || 0)}
                placeholder="e.g. 342"
                className="input"
              />
            </div>
            <div>
              <label className="block section-label mb-1.5">Time / Season</label>
              <input
                value={values.date}
                onChange={e => set('date', e.target.value)}
                placeholder="e.g. Early Spring"
                className="input"
              />
            </div>
            <div>
              <label className="block section-label mb-1.5">Era / Arc</label>
              <input
                value={values.era}
                onChange={e => set('era', e.target.value)}
                placeholder="e.g. The Dark Age"
                className="input"
              />
            </div>
            <div>
              <label className="block section-label mb-1.5">Event Type</label>
              <div className="flex flex-wrap gap-1.5">
                {['event', 'battle', 'discovery', 'birth', 'death', 'founding', 'collapse', 'prophecy'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={`h-7 px-2.5 rounded-md text-xs font-medium transition-colors capitalize border ${
                      values.type === t ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-input hover:bg-accent hover:text-foreground'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-border">
          <button type="button" onClick={onClose} className="btn btn-outline">
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {initial.id ? 'Save changes' : 'Create event'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const EVENT_TYPE_ICONS = {
  battle:    Swords, 
  discovery: Compass, 
  birth:     Sparkles, 
  death:     Skull,
  founding:  Landmark, 
  collapse:  Flame, 
  prophecy:  Eye, 
  event:     MapPin,
};

export default function Timeline() {
  const navigate    = useNavigate();
  const characters  = useWorldStore(s => s.characters);
  const locations   = useWorldStore(s => s.locations);
  const things      = useWorldStore(s => s.things);
  const lore        = useWorldStore(s => s.lore);
  const factions    = useWorldStore(s => s.factions);
  const creatures   = useWorldStore(s => s.creatures);
  const addEntity                 = useWorldStore(s => s.addEntity);
  const updateEntity              = useWorldStore(s => s.updateEntity);
  const deleteEntity              = useWorldStore(s => s.deleteEntity);
  const renameEntityAcrossLibrary = useWorldStore(s => s.renameEntityAcrossLibrary);

  const events = useMemo(() => {
    const getEffectiveYear = (e) => {
      // If year is explicitly set to a non-zero number, prefer it
      if (typeof e.year === 'number' && e.year !== 0) return e.year;

      // Check the date string
      const d = e.date?.toLowerCase() || '';
      if (d.includes('unknown')) return -Infinity;

      // Try to parse a number from the date string (for legacy events)
      const match = d.match(/-?\d+/);
      if (match) return parseInt(match[0], 10);

      return e.year || 0;
    };

    return lore.filter(e => e._isTimelineEvent === true)
      .sort((a, b) => {
        const ya = getEffectiveYear(a);
        const yb = getEffectiveYear(b);
        if (ya !== yb) return ya - yb;
        return (a._order ?? 0) - (b._order ?? 0);
      });
  }, [lore]);

  const allEntities = useMemo(() => [
    ...characters.map(e => ({ ...e, _type: 'characters' })),
    ...locations.map(e  => ({ ...e, _type: 'locations'  })),
    ...things.map(e     => ({ ...e, _type: 'things'     })),
    ...lore.filter(e => !e._isTimelineEvent).map(e => ({ ...e, _type: 'lore' })),
    ...factions.map(e   => ({ ...e, _type: 'factions'   })),
    ...creatures.map(e  => ({ ...e, _type: 'creatures'  })),
  ], [characters, locations, things, lore, factions, creatures]);

  const [adding, setAdding]       = useState(false);
  const [editing, setEditing]     = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [query, setQuery]         = useState('');

  // Group by era
  const eras = useMemo(() => {
    const map = {};
    const q = query.trim().toLowerCase();
    events.forEach(e => {
      if (q && !e.name?.toLowerCase().includes(q) && !e.description?.toLowerCase().includes(q) && !e.type?.toLowerCase().includes(q)) return;
      const era = e.era || 'Ungrouped';
      if (!map[era]) map[era] = [];
      map[era].push(e);
    });
    return map;
  }, [events, query]);

  const eraNames = Object.keys(eras);

  const handleAdd = async (values) => {
    await addEntity('lore', {
      name: values.title,
      _isTimelineEvent: true,
      _order: events.length,
      year: values.year,
      era: values.era,
      date: values.date,
      description: values.description,
      type: values.type,
      linkedIds: values.linkedIds,
      subtype: 'Timeline',
    });
    setAdding(false);
  };

  const handleEdit = async (values) => {
    const oldName = editing.name || '';
    const newName = values.title;
    const extra = {
      year: values.year,
      era: values.era,
      date: values.date,
      description: values.description,
      type: values.type,
      linkedIds: values.linkedIds,
    };
    if (newName && newName !== oldName) {
      await renameEntityAcrossLibrary('lore', editing.id, oldName, newName, extra);
    } else {
      await updateEntity('lore', editing.id, { name: newName, ...extra });
    }
    setEditing(null);
  };

  const handleDelete = async (id) => {
    await deleteEntity('lore', id);
  };



  const getLinkedEntities = (linkedIds = []) =>
    allEntities.filter(e => linkedIds.includes(e.id));

  return (
    <>
    <div className="flex-1 overflow-y-auto w-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-3 sm:px-8 md:pt-8 flex flex-col gap-4">
          <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2.5">
                <Clock size={20} className="shrink-0 text-muted-foreground" />
                <h1 className="page-title truncate">Timeline</h1>
              </div>
              <p className="page-subtitle">Chronological history of your world.</p>
            </div>
            <button onClick={() => setAdding(true)} className="btn btn-primary">
              <Plus /> New event
            </button>
          </header>

          <div className="relative w-full sm:w-64 shrink-0">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search timeline…"
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
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl px-4 pt-6 pb-8 sm:px-8">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
              <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <TrendingUp size={18} />
              </span>
              <h3 className="text-sm font-semibold text-foreground">No events yet</h3>
              <p className="mt-1 text-sm text-muted-foreground mb-4 max-w-xs">
                Chronicle your world's history. Add events, group them into eras, and link them to characters and places.
              </p>
              <button
                onClick={() => setAdding(true)}
                className="btn btn-primary"
              >
                <Plus /> Add first event
              </button>
            </div>
          ) : (
            <div className="space-y-10">
              {eraNames.map((era) => (
                <div key={era}>
                  {/* Era header */}
                  {era !== 'Ungrouped' && (
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="section-title shrink-0">{era}</h2>
                      <span className="text-xs text-muted-foreground">{eras[era].length}</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                  )}

                  {/* Events list */}
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[17px] top-4 bottom-4 w-px bg-border" />

                    <div className="space-y-2">
                      {eras[era].map((event) => {
                        const linked = getLinkedEntities(event.linkedIds);

                        return (
                          <div
                            key={event.id}
                            className="relative flex gap-3 group"
                          >
                            {/* Timeline dot */}
                            <div className="relative flex flex-col items-center shrink-0 mt-2">
                              <div className="size-9 rounded-full bg-background border border-border group-hover:border-brand/50 group-hover:text-brand text-muted-foreground transition-colors flex items-center justify-center z-10">
                                {(() => {
                                  const IconComponent = EVENT_TYPE_ICONS[event.type] || MapPin;
                                  return <IconComponent size={16} />;
                                })()}
                              </div>
                            </div>

                            {/* Event card */}
                            <div className="flex-1 min-w-0">
                              <div
                                className="card transition-colors group-hover:border-foreground/15 overflow-hidden"
                              >
                                <div className="flex items-start gap-3 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-semibold text-foreground">{event.name}</p>
                                      {(event.date || (typeof event.year === 'number' && event.year !== 0)) && (
                                        <span className="text-xs text-muted-foreground tabular-nums">
                                          {[
                                            (typeof event.year === 'number' && event.year !== 0) ? `Year ${event.year}` : null,
                                            event.date
                                          ].filter(Boolean).join(' • ')}
                                        </span>
                                      )}
                                      {event.type && event.type !== 'event' && (
                                        <span className="badge capitalize">{event.type}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditing(event); }}
                                      className="btn btn-ghost btn-icon btn-sm opacity-0 group-hover:opacity-100"
                                      aria-label="Edit event"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); setDeleting(event); }}
                                      className="btn btn-ghost btn-icon btn-sm hover:text-destructive opacity-0 group-hover:opacity-100"
                                      aria-label="Delete event"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Content */}
                                {(event.description || linked.length > 0) && (
                                  <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                                    {event.description && (
                                      <p className="text-sm text-muted-foreground leading-relaxed">
                                        <PlainTextPreview text={event.description} />
                                      </p>
                                    )}
                                    {linked.length > 0 && (
                                      <div>
                                        <p className="section-label mb-1.5">Involves</p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {linked.map(e => {
                                            const meta = TYPE_META[e._type];
                                            const Icon = TYPE_ICONS[e._type];
                                            return (
                                              <button
                                                key={e.id}
                                                onClick={ev => { ev.stopPropagation(); navigate(`/${e._type}/${e.id}`); }}
                                                className="flex items-center gap-1.5 h-6 px-2 rounded-md border border-border text-xs font-medium text-foreground hover:bg-accent transition-colors"
                                              >
                                                {Icon && <Icon size={12} className={meta.color} />}
                                                {e.name}
                                                <ExternalLink size={10} className="text-muted-foreground" />
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {adding && (
        <EventModal
          allEntities={allEntities}
          onSave={handleAdd}
          onClose={() => setAdding(false)}
        />
      )}

      {editing && (
        <EventModal
          initial={{ ...editing, title: editing.name }}
          allEntities={allEntities}
          onSave={handleEdit}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete event?"
          message={`"${deleting.name || 'Untitled event'}" will be removed from the timeline. This cannot be undone.`}
          confirmLabel="Delete event"
          onConfirm={() => handleDelete(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
