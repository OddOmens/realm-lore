import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookMarked } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const FILTERS = ['All', 'Race', 'Faction', 'Class', 'Religion', 'Magic System'];

const SUBTYPE_COLORS = {
  Race:           'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Faction:        'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Class:          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Religion:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  'Magic System': 'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

const STATUS_DOT = {
  Active:    'bg-green-400',
  Extinct:   'bg-red-400',
  Dormant:   'bg-yellow-400',
  Legendary: 'bg-amber-400',
  Emerging:  'bg-blue-400',
  Unknown:   'bg-muted-foreground',
};

export default function Lore() {
  const lore = useWorldStore(state => state.lore);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleAdd = async () => {
    const created = await addEntity('lore', { name: '' });
    navigate(`/lore/${created.id}`, { state: { autoEdit: true } });
  };

  const filtered = useMemo(() => (
    activeFilter === 'All' ? lore : lore.filter(e => e.subtype === activeFilter)
  ), [lore, activeFilter]);

  return (
    <EntityList
      title="Lore"
      icon={BookMarked}
      entityType="lore"
      entities={filtered}
      onAdd={handleAdd}
      filters={FILTERS}
      activeFilter={activeFilter}
      onFilterChange={setActiveFilter}
      totalCount={lore.length}
      renderCard={(entry, viewMode) => (
        <EntityCard key={entry.id} entity={entry} entityType="lore" viewMode={viewMode}
          listContent={
            <div className="flex items-center gap-3 pr-8 min-w-0">
              {entry.status && <span className={`shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[entry.status] || 'bg-muted-foreground'}`} title={entry.status} />}
              <span className="font-medium text-sm truncate flex-1">{entry.name}</span>
              {entry.subtype && <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full border ${SUBTYPE_COLORS[entry.subtype] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>{entry.subtype}</span>}
            </div>
          }
        >
          {entry.image && (
            <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
              <img src={entry.image} alt={entry.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
            </div>
          )}
          <div className="flex items-start justify-between pr-6 mb-2">
            <div className="flex items-center gap-2 min-w-0">
              {entry.status && (
                <span className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${STATUS_DOT[entry.status] || 'bg-muted-foreground'}`} title={entry.status} />
              )}
              <h4 className="font-semibold text-base leading-snug truncate">{entry.name}</h4>
            </div>
            {entry.subtype && (
              <span className={`shrink-0 ml-2 text-xs font-medium px-2 py-0.5 rounded-full border ${SUBTYPE_COLORS[entry.subtype] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                {entry.subtype}
              </span>
            )}
          </div>
          {entry.factionType && entry.subtype === 'Faction' && (
            <p className="text-xs text-muted-foreground mb-1">{entry.factionType}</p>
          )}
          {entry.homeland && entry.subtype === 'Race' && (
            <p className="text-xs text-muted-foreground mb-1 truncate">{entry.homeland}</p>
          )}
          {entry.role && entry.subtype === 'Class' && (
            <p className="text-xs text-muted-foreground mb-1">{entry.role}</p>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">
            <PlainTextPreview text={entry.description || entry.origin || 'No description yet.'} />
          </p>
        </EntityCard>
      )}
    />
  );
}
