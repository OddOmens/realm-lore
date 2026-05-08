import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Map } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const TYPE_COLORS = {
  City:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Town:       'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Village:    'bg-teal-500/10 text-teal-400 border-teal-500/20',
  Dungeon:    'bg-red-500/10 text-red-400 border-red-500/20',
  Forest:     'bg-green-500/10 text-green-400 border-green-500/20',
  Mountain:   'bg-stone-500/10 text-stone-400 border-stone-500/20',
  Ocean:      'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Ruin:       'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Kingdom:    'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Plane:      'bg-violet-500/10 text-violet-400 border-violet-500/20',
};

const STATUS_STYLES = {
  Thriving:   'text-green-400',
  Abandoned:  'text-yellow-400',
  Ruins:      'text-orange-400',
  Hidden:     'text-purple-400',
  Contested:  'text-red-400',
  Destroyed:  'text-muted-foreground line-through',
};

const FILTERS = ['All', 'City', 'Town', 'Village', 'Dungeon', 'Forest', 'Mountain', 'Ocean', 'Ruin', 'Kingdom', 'Plane'];

export default function Locations() {
  const locations = useWorldStore(state => state.locations);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleAdd = async () => {
    const created = await addEntity('locations', { name: '' });
    navigate(`/locations/${created.id}`, { state: { autoEdit: true } });
  };

  const filtered = activeFilter === 'All'
    ? locations
    : locations.filter(l => l.type === activeFilter);

  return (
    <>
      <EntityList
        title="Locations"
        icon={Map}
        entityType="locations"
        entities={filtered}
        onAdd={handleAdd}
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        totalCount={locations.length}
        renderCard={(loc, viewMode) => (
          <EntityCard key={loc.id} entity={loc} entityType="locations" viewMode={viewMode}
            listContent={
              <div className="flex items-center gap-3 pr-8 min-w-0">
                <span className="font-medium text-sm truncate flex-1">{loc.name}</span>
                {loc.region && <span className="text-xs text-muted-foreground shrink-0 hidden sm:block truncate max-w-[140px]">{loc.region}</span>}
                {loc.status && <span className={`shrink-0 text-xs font-medium ${STATUS_STYLES[loc.status] || 'text-zinc-400'}`}>{loc.status}</span>}
                {loc.type && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[loc.type] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">TYPE</span>
                    {loc.type}
                  </span>
                )}
              </div>
            }
          >
            {loc.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
                <img src={loc.image} alt={loc.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <h4 className="font-semibold text-base leading-snug truncate pr-6 mb-1.5">{loc.name}</h4>
            {loc.type && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[loc.type] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                  <span className="opacity-50 mr-1 uppercase">TYPE</span>
                  {loc.type}
                </span>
              </div>
            )}
            {loc.region && (
              <p className="text-xs text-muted-foreground mb-2">
                {loc.region}
                {loc.status && <span className={` ml-2 ${STATUS_STYLES[loc.status] || 'text-muted-foreground'}`}>· {loc.status}</span>}
              </p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              <PlainTextPreview text={loc.description || loc.atmosphere || 'No description yet.'} />
            </p>
          </EntityCard>
        )}
      />

    </>
  );
}
