import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { 
  Plus, TrendingUp, Users, Map as MapIcon, Box, BookMarked,
  ExternalLink, Flag, PawPrint,
  Swords, Compass, Sparkles, Skull, Landmark, Flame, Eye, MapPin, Pencil, Trash2
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

const ERA_GRADIENT_COLORS = [
  'rgba(59,130,246,0.4)',
  'rgba(34,197,94,0.4)',
  'rgba(245,158,11,0.4)',
  'rgba(168,85,247,0.4)',
  'rgba(244,63,94,0.4)',
];

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
    <Modal title={initial.id ? 'Edit Event' : 'New Event'} onClose={onClose} size="2xl">
      <form onSubmit={e => { e.preventDefault(); if (!values.title.trim()) return; onSave(values); }}>
        <div className="flex flex-col md:flex-row gap-6">
          
          {/* Main Info (Left Column) */}
          <div className="flex-1 space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Event Title *</label>
              <input
                autoFocus
                value={values.title}
                onChange={e => set('title', e.target.value)}
                placeholder="e.g. The Fall of the Iron Throne"
                className="w-full bg-secondary/50 text-base text-foreground rounded-xl px-4 py-3 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
              <textarea
                value={values.description}
                onChange={e => set('description', e.target.value)}
                rows={9}
                placeholder="What happened? Why does it matter?"
                className="w-full bg-secondary/50 text-sm text-foreground rounded-xl px-4 py-3 border border-border focus:outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/40 transition-all"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Linked Entities</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto pr-2" style={{ maxHeight: '200px' }}>
                {allEntities.length === 0 ? (
                  <p className="text-xs text-muted-foreground/50 italic p-1">No entities yet.</p>
                ) : allEntities.map(e => {
                  const meta = TYPE_META[e._type];
                  const Icon = TYPE_ICONS[e._type];
                  const checked = values.linkedIds.includes(e.id);
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => toggleEntity(e.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border transition-all text-left ${checked ? 'bg-primary/10 border-primary/30 ring-1 ring-primary/30 shadow-sm' : 'bg-secondary/30 border-border hover:bg-secondary hover:border-border/80'}`}
                    >
                      <div className={`w-4 h-4 rounded-[4px] border flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-primary border-primary' : 'bg-background border-border'}`}>
                        {checked && <span className="text-primary-foreground text-[10px] leading-none font-bold">✓</span>}
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
          <div className="w-full md:w-72 shrink-0 space-y-5 bg-secondary/20 p-5 rounded-2xl border border-border">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5" title="Used for sorting">Year (Sort Order)</label>
              <input
                type="number"
                value={values.year}
                onChange={e => set('year', parseInt(e.target.value) || 0)}
                placeholder="e.g. 342"
                className="w-full bg-background text-sm text-foreground rounded-lg px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Time / Season</label>
              <input
                value={values.date}
                onChange={e => set('date', e.target.value)}
                placeholder="e.g. Early Spring"
                className="w-full bg-background text-sm text-foreground rounded-lg px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Era / Arc</label>
              <input
                value={values.era}
                onChange={e => set('era', e.target.value)}
                placeholder="e.g. The Dark Age"
                className="w-full bg-background text-sm text-foreground rounded-lg px-3 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/40 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Event Type</label>
              <div className="flex flex-wrap gap-2">
                {['event', 'battle', 'discovery', 'birth', 'death', 'founding', 'collapse', 'prophecy'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all capitalize border ${
                      values.type === t ? 'bg-primary text-primary-foreground border-primary shadow-sm' : 'bg-background text-muted-foreground border-border hover:border-border/80 hover:text-foreground'
                    }`}
                  >{t}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-8 pt-5 border-t border-border">
          <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-6 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm">
            {initial.id ? 'Save Changes' : 'Create Event'}
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

  // Group by era
  const eras = useMemo(() => {
    const map = {};
    events.forEach(e => {
      const era = e.era || 'Ungrouped';
      if (!map[era]) map[era] = [];
      map[era].push(e);
    });
    return map;
  }, [events]);

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
      <div className="flex-1 flex flex-col overflow-hidden bg-background">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-5 border-b border-border bg-card shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <TrendingUp size={20} className="text-rose-400" />
              <h2 className="text-2xl font-bold tracking-tight text-foreground">Timeline</h2>
            </div>
            <p className="text-sm text-muted-foreground">{events.length} event{events.length !== 1 ? 's' : ''} · {eraNames.length} era{eraNames.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
          >
            <Plus size={14} /> Add Event
          </button>
        </header>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-8">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center pb-16">
              <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
                <TrendingUp size={28} className="text-rose-400/60" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No events yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Chronicle your world's history. Add events, group them into eras, and link them to characters and places.
              </p>
              <button
                onClick={() => setAdding(true)}
                className="flex items-center gap-2 h-9 px-5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
              >
                <Plus size={15} /> Add First Event
              </button>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-10">
              {eraNames.map((era, eraIdx) => (
                <div key={era}>
                  {/* Era header */}
                  {era !== 'Ungrouped' && (
                    <div className="flex items-center gap-3 mb-5">
                      <div
                        className="h-px flex-1"
                        style={{ background: `linear-gradient(to right, transparent, ${ERA_GRADIENT_COLORS[eraIdx % ERA_GRADIENT_COLORS.length]})` }}
                      />
                      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground px-2">{era}</span>
                      <div
                        className="h-px flex-1"
                        style={{ background: `linear-gradient(to left, transparent, ${ERA_GRADIENT_COLORS[eraIdx % ERA_GRADIENT_COLORS.length]})` }}
                      />
                    </div>
                  )}

                  {/* Events list */}
                  <div className="relative">
                    {/* Vertical timeline line */}
                    <div className="absolute left-[22px] top-3 bottom-3 w-px bg-border/60" />

                    <div className="space-y-1">
                      {eras[era].map((event) => {
                        const linked = getLinkedEntities(event.linkedIds);

                        return (
                          <div
                            key={event.id}
                            className="relative flex gap-4 group transition-opacity"
                          >
                            {/* Timeline dot */}
                            <div className="relative flex flex-col items-center shrink-0 mt-4">
                              <div className="w-11 h-11 rounded-full bg-card border-2 border-border group-hover:border-primary/40 transition-colors flex items-center justify-center z-10">
                                {(() => {
                                  const IconComponent = EVENT_TYPE_ICONS[event.type] || MapPin;
                                  return <IconComponent size={18} className="text-muted-foreground" />;
                                })()}
                              </div>
                            </div>

                            {/* Event card */}
                            <div className="flex-1 min-w-0 mb-2">
                              <div
                                className="rounded-xl border border-border bg-card hover:border-border/80 transition-colors overflow-hidden"
                              >
                                <div className="flex items-start gap-3 px-4 py-3">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <p className="text-sm font-semibold text-foreground">{event.name}</p>
                                      {(event.date || (typeof event.year === 'number' && event.year !== 0)) && (
                                        <span className="text-xs text-muted-foreground/60 font-mono">
                                          {[
                                            (typeof event.year === 'number' && event.year !== 0) ? `Year ${event.year}` : null,
                                            event.date
                                          ].filter(Boolean).join(' • ')}
                                        </span>
                                      )}
                                      {event.type && event.type !== 'event' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary border border-border text-muted-foreground capitalize">{event.type}</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={e => { e.stopPropagation(); setEditing(event); }}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={e => { e.stopPropagation(); setDeleting(event); }}
                                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>

                                {/* Content */}
                                {(event.description || linked.length > 0) && (
                                  <div className="px-4 pb-4 border-t border-border/50 pt-3 space-y-3">
                                    {event.description && (
                                      <p className="text-sm text-muted-foreground/90 leading-relaxed">
                                        <PlainTextPreview text={event.description} />
                                      </p>
                                    )}
                                    {linked.length > 0 && (
                                      <div>
                                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Involves</p>
                                        <div className="flex flex-wrap gap-2">
                                          {linked.map(e => {
                                            const meta = TYPE_META[e._type];
                                            const Icon = TYPE_ICONS[e._type];
                                            return (
                                              <button
                                                key={e.id}
                                                onClick={ev => { ev.stopPropagation(); navigate(`/${e._type}/${e.id}`); }}
                                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${meta.border} ${meta.bg} text-xs font-medium ${meta.color} hover:opacity-80 transition-opacity`}
                                              >
                                                {Icon && <Icon size={11} />}
                                                {e.name}
                                                <ExternalLink size={10} className="opacity-50" />
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
