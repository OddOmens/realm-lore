import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const TYPE_COLORS = {
  Item:         'bg-secondary text-muted-foreground border-border',
  Artifact:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Organization: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Faction:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Spell:        'bg-violet-500/10 text-violet-400 border-violet-500/20',
  Blessing:     'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Curse:        'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const RARITY_STYLES = {
  Common:    'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Uncommon:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Rare:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Very Rare': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Legendary: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Artifact:  'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Unique:    'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
};

const FILTERS = ['All', 'Item', 'Artifact', 'Organization', 'Faction', 'Spell', 'Blessing', 'Curse'];

export default function Things() {
  const things = useWorldStore(state => state.things);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleAdd = async () => {
    const created = await addEntity('things', { name: '' });
    navigate(`/things/${created.id}`, { state: { autoEdit: true } });
  };

  const filtered = activeFilter === 'All'
    ? things
    : things.filter(t => t.type === activeFilter);

  return (
    <>
      <EntityList
        title="Things"
        icon={Box}
        entityType="things"
        entities={filtered}
        onAdd={handleAdd}
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        totalCount={things.length}
        renderCard={(thing, viewMode) => (
          <EntityCard key={thing.id} entity={thing} entityType="things" viewMode={viewMode}
            listContent={
              <div className="flex items-center gap-3 pr-8 min-w-0">
                <span className="font-medium text-sm truncate flex-1">{thing.name}</span>
                {thing.rarity && thing.rarity !== 'N/A' && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${RARITY_STYLES[thing.rarity] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">RARITY</span>
                    {thing.rarity}
                  </span>
                )}
                {thing.type && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[thing.type] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">TYPE</span>
                    {thing.type}
                  </span>
                )}
              </div>
            }
          >
            {thing.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
                <img src={thing.image} alt={thing.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <h4 className="font-semibold text-base leading-snug truncate pr-6 mb-1.5">{thing.name}</h4>
            {(thing.type || (thing.rarity && thing.rarity !== 'N/A')) && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {thing.type && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[thing.type] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">TYPE</span>
                    {thing.type}
                  </span>
                )}
                {thing.rarity && thing.rarity !== 'N/A' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${RARITY_STYLES[thing.rarity] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">RARITY</span>
                    {thing.rarity}
                  </span>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              <PlainTextPreview text={thing.description || thing.origin || 'No description yet.'} />
            </p>
          </EntityCard>
        )}
      />

    </>
  );
}
