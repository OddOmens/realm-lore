import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Zap, Car, Skull, Sparkles, Ghost, Gamepad2, Rocket, Cloud, Compass } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

const ICON_MAP = {
  box: Box,
  zap: Zap,
  car: Car,
  skull: Skull,
  sparkles: Sparkles,
  ghost: Ghost,
  gamepad: Gamepad2,
  rocket: Rocket,
  cloud: Cloud,
  compass: Compass,
};

const FILTERS = ['All'];

export default function CustomEntities() {
  const { typeId } = useParams();
  const customTypes = useWorldStore(state => state.customTypes);
  const allCustomEntities = useWorldStore(state => state.customEntities);
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState('All');

  const customType = customTypes.find(t => t.id === typeId);
  const entities = allCustomEntities.filter(e => e.entityType === typeId);

  const handleAdd = async () => {
    const created = await addEntity('customEntities', { name: '', entityType: typeId });
    navigate(`/custom/${typeId}/${created.id}`, { state: { autoEdit: true } });
  };

  if (!customType) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <h2 className="text-xl font-bold mb-2 text-foreground">Custom Type Not Found</h2>
        <p className="text-sm">This custom entity type may have been deleted.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  const Icon = ICON_MAP[customType.icon] || Box;

  return (
    <>
      <EntityList
        title={customType.label}
        icon={Icon}
        entityType="customEntities"
        entities={entities}
        onAdd={handleAdd}
        filters={FILTERS}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        totalCount={entities.length}
        renderCard={(entity, viewMode) => (
          <EntityCard key={entity.id} entity={entity} entityType="customEntities" viewMode={viewMode}
            listContent={
              <div className="flex items-center gap-3 pr-8 min-w-0">
                <span className="font-medium text-sm truncate flex-1">{entity.name}</span>
                {entity.tags && entity.tags.length > 0 && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                    {entity.tags[0]}
                  </span>
                )}
              </div>
            }
          >
            {entity.image && (
              <div className="w-full h-32 rounded-lg overflow-hidden mb-3 -mt-1">
                <img src={entity.image} alt={entity.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              </div>
            )}
            <div className="flex items-center gap-2 min-w-0 pr-6 mb-1.5">
              <h4 className="font-semibold text-base leading-snug truncate">{entity.name}</h4>
            </div>
            {entity.tags && entity.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {entity.tags.map(t => (
                  <span key={t} className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                    {t}
                  </span>
                ))}
              </div>
            )}
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
              <PlainTextPreview text={entity.description || entity.notes || 'No description yet.'} />
            </p>
          </EntityCard>
        )}
      />
    </>
  );
}
