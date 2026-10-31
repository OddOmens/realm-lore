import { useState, useCallback } from 'react';
import { Pencil, Trash2, ExternalLink, Copy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ContextMenu from './ContextMenu';
import ConfirmModal from './ConfirmModal';
import { useWorldStore } from '../store/useWorldStore';

export default function EntityCard({ entity, entityType, onClick, viewMode, listContent, children }) {
  const deleteEntity = useWorldStore(s => s.deleteEntity);
  const addEntity    = useWorldStore(s => s.addEntity);
  const navigate = useNavigate();
  const [menu, setMenu] = useState(null);
  const [confirming, setConfirming] = useState(false);

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClick = () => {
    if (onClick) onClick();
    else navigate(`/${entityType}/${entity.id}`);
  };

  const handleDuplicate = useCallback(async () => {
    const rest = { ...entity };
    delete rest.id;
    delete rest.createdAt;
    delete rest.updatedAt;
    const copy = await addEntity(entityType, { ...rest, name: `${entity.name} (copy)` });
    if (copy?.id) navigate(`/${entityType}/${copy.id}`);
  }, [entity, entityType, addEntity, navigate]);

  const menuItems = [
    { label: 'Open Wiki Page', icon: ExternalLink, onClick: () => navigate(`/${entityType}/${entity.id}`) },
    { label: 'Edit', icon: Pencil, onClick: () => navigate(`/${entityType}/${entity.id}`, { state: { autoEdit: true } }) },
    { label: 'Duplicate', icon: Copy, onClick: handleDuplicate },
    { divider: true },
    { label: 'Delete', icon: Trash2, danger: true, onClick: () => setConfirming(true) },
  ];

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onContextMenu={handleContextMenu}
        onClick={handleClick}
        onKeyDown={e => { if (e.key === 'Enter') handleClick(); }}
        className={`cursor-pointer group relative outline-none focus-visible:ring-2 focus-visible:ring-ring/40 ${viewMode === 'list' ? 'bg-card px-4 py-2.5 transition-colors hover:bg-accent/60' : 'card card-hover h-full p-4'}`}
      >
        {viewMode === 'list' && listContent ? listContent : children}
        <button
          onClick={(e) => { e.stopPropagation(); navigate(`/${entityType}/${entity.id}`, { state: { autoEdit: true } }); }}
          className={`absolute right-2 p-1.5 rounded-md opacity-100 sm:opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground hover:bg-accent transition-all ${viewMode === 'list' ? 'top-1/2 -translate-y-1/2' : 'top-2'}`}
          title="Edit"
        >
          <Pencil size={13} />
        </button>
      </div>

      {menu && (
        <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} />
      )}

      {confirming && (
        <ConfirmModal
          title="Delete Entry"
          message={`Are you sure you want to delete "${entity.name}"? This cannot be undone.`}
          onConfirm={() => deleteEntity(entityType, entity.id)}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
