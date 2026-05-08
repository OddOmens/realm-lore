import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flag } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const TYPE_COLORS = {
  Guild:        'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Kingdom:      'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Empire:       'bg-red-500/10 text-red-400 border-red-500/20',
  Cult:         'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Order:        'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Tribe:        'bg-green-500/10 text-green-400 border-green-500/20',
  Syndicate:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  Alliance:     'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Organization: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Other:        'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const FILTERS = ['All', 'Guild', 'Kingdom', 'Empire', 'Cult', 'Order', 'Tribe', 'Syndicate', 'Alliance', 'Organization'];

export default function Factions() {
  const factions = useWorldStore(state => state.factions);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleAdd = async () => {
    const created = await addEntity('factions', { name: '' });
    navigate(`/factions/${created.id}`, { state: { autoEdit: true } });
  };

  const filtered = activeFilter === 'All'
    ? factions
    : factions.filter(f => f.factionType === activeFilter);

  return (
    <>
      <EntityList
        title="Factions"
        icon={Flag}
        entityType="factions"
        entities={filtered}
        onAdd={handleAdd}
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        totalCount={factions.length}
        renderCard={(faction, viewMode) => (
          <EntityCard key={faction.id} entity={faction} entityType="factions" viewMode={viewMode}
            listContent={
              <div className="flex items-center gap-3 pr-8 min-w-0">
                <span className="font-medium text-sm truncate flex-1">{faction.name}</span>
                {faction.location && <span className="text-xs text-muted-foreground shrink-0 hidden sm:block truncate max-w-[140px]">📍 {faction.location}</span>}
                {faction.factionType && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[faction.factionType] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">TYPE</span>
                    {faction.factionType}
                  </span>
                )}
              </div>
            }
          >
            {faction.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
                <img src={faction.image} alt={faction.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <h4 className="font-semibold text-base leading-snug truncate pr-6 mb-1.5">{faction.name}</h4>
            {faction.factionType && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[faction.factionType] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                  <span className="opacity-50 mr-1 uppercase">TYPE</span>
                  {faction.factionType}
                </span>
              </div>
            )}
            {faction.location && (
              <p className="text-xs mb-2 font-medium text-muted-foreground">
                📍 {faction.location}
              </p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              <PlainTextPreview text={faction.description || faction.history || 'No description yet.'} />
            </p>
          </EntityCard>
        )}
      />

    </>
  );
}
