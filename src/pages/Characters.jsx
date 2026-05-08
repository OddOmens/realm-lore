import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const ROLE_COLORS = {
  Hero:     'bg-blue-500/10 text-blue-400 border-blue-500/20',
  Villain:  'bg-red-500/10 text-red-400 border-red-500/20',
  Antihero: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  Mentor:   'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Ally:     'bg-green-500/10 text-green-400 border-green-500/20',
  Neutral:  'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const STATUS_DOT = {
  Alive:     'bg-green-400',
  Dead:      'bg-red-400',
  Unknown:   'bg-muted-foreground',
  Undead:    'bg-purple-400',
  Imprisoned:'bg-yellow-400',
};

const FILTERS = ['All', 'Hero', 'Villain', 'Antihero', 'Mentor', 'Ally', 'Neutral'];

export default function Characters() {
  const characters = useWorldStore(state => state.characters);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const handleAdd = async () => {
    const created = await addEntity('characters', { name: '' });
    navigate(`/characters/${created.id}`, { state: { autoEdit: true } });
  };

  const filtered = activeFilter === 'All'
    ? characters
    : characters.filter(c => c.role === activeFilter);

  return (
    <>
      <EntityList
        title="Characters"
        icon={Users}
        entityType="characters"
        entities={filtered}
        onAdd={handleAdd}
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        totalCount={characters.length}
        renderCard={(char, viewMode) => (
          <EntityCard key={char.id} entity={char} entityType="characters" viewMode={viewMode}
            listContent={
              <div className="flex items-center gap-3 pr-8 min-w-0">
                {char.status && <span className={`shrink-0 w-2 h-2 rounded-full ${STATUS_DOT[char.status] || 'bg-muted-foreground'}`} title={char.status} />}
                <span className="font-medium text-sm truncate flex-1">{char.name}</span>
                {(char.race || char.age) && <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">{[char.race, char.age && `Age ${char.age}`].filter(Boolean).join(' · ')}</span>}
                {char.role && (
                  <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${ROLE_COLORS[char.role] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                    <span className="opacity-50 mr-1 uppercase">ROLE</span>
                    {char.role}
                  </span>
                )}
              </div>
            }
          >
            {char.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
                <img src={char.image} alt={char.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0 pr-6 mb-1.5">
              {char.status && (
                <span className={`shrink-0 w-2 h-2 rounded-full mt-0.5 ${STATUS_DOT[char.status] || 'bg-muted-foreground'}`} title={char.status} />
              )}
              <h4 className="font-semibold text-base leading-snug truncate">{char.name}</h4>
            </div>
            {char.role && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${ROLE_COLORS[char.role] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                  <span className="opacity-50 mr-1 uppercase">ROLE</span>
                  {char.role}
                </span>
              </div>
            )}
            {char.alias && <p className="text-xs text-muted-foreground mb-1 italic">"{char.alias}"</p>}
            {(char.race || char.age) && (
              <p className="text-xs text-muted-foreground mb-2">
                {[char.race, char.age && `Age ${char.age}`].filter(Boolean).join(' · ')}
              </p>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2">
              <PlainTextPreview text={char.description || char.background || 'No description yet.'} />
            </p>
          </EntityCard>
        )}
      />

    </>
  );
}
