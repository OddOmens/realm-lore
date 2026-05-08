import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PawPrint } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const TYPE_COLORS = {
  Animal:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Monster:     'bg-red-500/10 text-red-400 border-red-500/20',
  Beast:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Dragon:      'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Undead:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Construct:   'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  Elemental:   'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  Fey:         'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
  Fiend:       'bg-rose-500/10 text-rose-400 border-rose-500/20',
  Monstrosity: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Plant:       'bg-green-500/10 text-green-400 border-green-500/20',
};

const DANGER_STYLES = {
  None:         'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Harmless:     'bg-green-500/10 text-green-400 border-green-500/20',
  Low:          'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Medium:       'bg-amber-500/10 text-amber-400 border-amber-500/20',
  High:         'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Very High':   'bg-red-500/10 text-red-400 border-red-500/20',
  Deadly:       'bg-red-500/10 text-red-400 border-red-500/20',
  Extreme:      'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Catastrophic: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
};

const FILTERS = ['All', 'Animal', 'Monster', 'Beast', 'Dragon', 'Undead', 'Construct', 'Elemental', 'Fey', 'Fiend', 'Monstrosity', 'Plant', 'Other'];

export default function Creatures() {
  const creatures = useWorldStore(state => state.creatures);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleAdd = async () => {
    const created = await addEntity('creatures', { name: '' });
    navigate(`/creatures/${created.id}`, { state: { autoEdit: true } });
  };

  const filtered = activeFilter === 'All'
    ? creatures
    : creatures.filter(t => t.type === activeFilter);

  return (
    <>
      <EntityList
        title="Creatures"
        icon={PawPrint}
        entityType="creatures"
        entities={filtered}
        onAdd={handleAdd}
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        totalCount={creatures.length}
        renderCard={(creature, viewMode) => (
          <EntityCard key={creature.id} entity={creature} entityType="creatures" viewMode={viewMode}
            listContent={
              <div className="flex items-center gap-3 pr-8 min-w-0">
                <span className="font-medium text-sm truncate flex-1">{creature.name}</span>
                {creature.danger && creature.danger !== 'Unknown' && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${DANGER_STYLES[creature.danger] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">DNG</span>
                    {creature.danger}
                  </span>
                )}
                {creature.type && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[creature.type] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">TYPE</span>
                    {creature.type}
                  </span>
                )}
              </div>
            }
          >
            {creature.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
                <img src={creature.image} alt={creature.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <h4 className="font-semibold text-base leading-snug truncate pr-6 mb-1.5">{creature.name}</h4>
            {(creature.type || (creature.danger && creature.danger !== 'Unknown')) && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {creature.type && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${TYPE_COLORS[creature.type] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">TYPE</span>
                    {creature.type}
                  </span>
                )}
                {creature.danger && creature.danger !== 'Unknown' && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${DANGER_STYLES[creature.danger] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">DNG</span>
                    {creature.danger}
                  </span>
                )}
              </div>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              <PlainTextPreview text={creature.description || creature.behavior || 'No description yet.'} />
            </p>
          </EntityCard>
        )}
      />
    </>
  );
}
