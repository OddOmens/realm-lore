import { useNavigate } from 'react-router-dom';
import { Dna } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const STATUS_STYLES = {
  Common:     'bg-slate-500/10 text-slate-400 border-slate-500/20',
  Uncommon:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Rare:       'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Very Rare': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Endangered: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Extinct:    'bg-red-500/10 text-red-400 border-red-500/20',
  Mythical:   'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  Unknown:    'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
};

export default function Races() {
  const races     = useWorldStore(s => s.races);
  const addEntity = useWorldStore(s => s.addEntity);
  const navigate  = useNavigate();

  const handleAdd = async () => {
    const created = await addEntity('races', { name: '' });
    navigate(`/races/${created.id}`, { state: { autoEdit: true } });
  };

  return (
    <EntityList
      title="Races"
      icon={Dna}
      entityType="races"
      entities={races}
      onAdd={handleAdd}
      totalCount={races.length}
      renderCard={(race, viewMode) => (
        <EntityCard key={race.id} entity={race} entityType="races" viewMode={viewMode}
          listContent={
            <div className="flex items-center gap-3 pr-8 min-w-0">
              <span className="font-medium text-sm truncate flex-1">{race.name}</span>
              {race.status && (
                <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLES[race.status] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                  <span className="opacity-50 mr-1 uppercase">STAT</span>
                  {race.status}
                </span>
              )}
            </div>
          }
        >
          <h4 className="font-semibold text-base leading-snug truncate pr-6 mb-1.5">{race.name}</h4>
          {race.status && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${STATUS_STYLES[race.status] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'}`}>
                <span className="opacity-50 mr-1 uppercase">STAT</span>
                {race.status}
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground line-clamp-2">
            <PlainTextPreview text={race.physiology || race.culture || 'No description yet.'} />
          </p>
        </EntityCard>
      )}
    />
  );
}
