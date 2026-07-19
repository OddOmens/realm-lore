import { useNavigate } from 'react-router-dom';
import { StickyNote } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import EntityList from '../components/EntityList';
import EntityCard from '../components/EntityCard';
import PlainTextPreview from '../components/PlainTextPreview';

export default function Notes() {
  const notes = useWorldStore(state => state.notes) || [];
  const addEntity = useWorldStore(state => state.addEntity);
  const navigate = useNavigate();

  const handleAdd = async () => {
    const created = await addEntity('notes', { name: '' });
    navigate(`/notes/${created.id}`, { state: { autoEdit: true } });
  };

  return (
    <EntityList
      title="Notes"
      icon={StickyNote}
      entityType="notes"
      entities={notes}
      onAdd={handleAdd}
      totalCount={notes.length}
      renderCard={(entry, viewMode) => (
        <EntityCard key={entry.id} entity={entry} entityType="notes" viewMode={viewMode}
          listContent={
            <div className="flex items-center gap-3 pr-8 min-w-0">
              <span className="font-medium text-sm truncate flex-1">{entry.name || 'Untitled Note'}</span>
            </div>
          }
        >
          <div className="flex items-start justify-between pr-6 mb-2">
            <h4 className="font-semibold text-base leading-snug truncate">{entry.name || 'Untitled Note'}</h4>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-3">
            <PlainTextPreview text={entry.content || 'No content yet.'} />
          </p>
        </EntityCard>
      )}
    />
  );
}
