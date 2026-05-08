import { useState, useMemo } from 'react';
import { Search, X, Plus, Tag, CheckSquare, Square, LayoutGrid, List as ListIcon } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';

// Consistent page icon colors per entity type
const ICON_COLORS = {
  characters: 'text-blue-400',
  locations:  'text-green-400',
  things:     'text-amber-400',
  lore:       'text-purple-400',
};

function BulkTagModal({ selectedIds, entityType, onClose }) {
  const entities     = useWorldStore(s => s[entityType] || []);
  const updateEntity = useWorldStore(s => s.updateEntity);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('add'); // 'add' | 'remove'
  const [saving, setSaving] = useState(false);

  const allTags = useMemo(() => {
    const set = new Set();
    entities.forEach(e => (Array.isArray(e.tags) ? e.tags : []).forEach(t => set.add(t)));
    return [...set].sort();
  }, [entities]);

  const applyTags = async (tagsToApply) => {
    setSaving(true);
    await Promise.all(selectedIds.map(id => {
      const entity = entities.find(e => e.id === id);
      if (!entity) return null;
      const current = Array.isArray(entity.tags) ? entity.tags : [];
      const next = mode === 'add'
        ? [...new Set([...current, ...tagsToApply])]
        : current.filter(t => !tagsToApply.includes(t));
      return updateEntity(entityType, id, { tags: next });
    }));
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const tags = input.split(',').map(t => t.trim()).filter(Boolean);
    if (tags.length) applyTags(tags);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bulk Tag</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.length} selected</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex gap-1 p-1 bg-secondary/50 rounded-lg">
            {['add', 'remove'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${mode === m ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >{m} tags</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Tags, comma-separated…"
              className="w-full bg-secondary text-foreground text-sm rounded-lg px-3 py-2 border border-border focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
            />
            <button
              type="submit"
              disabled={!input.trim() || saving}
              className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Applying…' : `${mode === 'add' ? 'Add' : 'Remove'} Tags`}
            </button>
          </form>

          {allTags.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground mb-2">Existing tags (click to {mode})</p>
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {allTags.map(t => (
                  <button
                    key={t}
                    onClick={() => applyTags([t])}
                    className="px-2.5 py-1 rounded-full bg-secondary border border-border text-xs text-foreground hover:bg-primary/20 hover:border-primary/40 transition-colors"
                  >{t}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EntityList({ title, icon: PageIcon, entities, entityType, onAdd, renderCard, filters, activeFilter, onFilterChange, totalCount: totalCountProp }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [bulkTagOpen, setBulkTagOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('entityViewMode') || 'grid');

  const toggleViewMode = () => {
    const next = viewMode === 'grid' ? 'list' : 'grid';
    setViewMode(next);
    localStorage.setItem('entityViewMode', next);
  };

  const filtered = useMemo(() => {
    if (!query.trim()) return entities;
    const q = query.toLowerCase();
    return entities.filter(e =>
      e.name?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q) ||
      e.background?.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q) ||
      (Array.isArray(e.tags) && e.tags.some(t => t.toLowerCase().includes(q)))
    );
  }, [entities, query]);

  const showingCount = filtered.length;
  const totalCount = totalCountProp ?? entities.length;
  const isFiltered = activeFilter && activeFilter !== 'All';

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(filtered.map(e => e.id)));
  const clearSelect = () => { setSelected(new Set()); setSelectMode(false); };

  return (
    <div className="flex-1 px-4 py-6 md:p-8 overflow-y-auto w-full">
      {/* Header */}
      <header className="mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            {PageIcon && <PageIcon size={22} className={ICON_COLORS[entityType] || 'text-muted-foreground'} />}
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            {totalCount === 0
              ? `No ${title.toLowerCase()} yet.`
              : `${showingCount === totalCount ? totalCount : `${showingCount} of ${totalCount}`} ${title.toLowerCase()}`}
          </p>
        </div>
      </header>

      {/* Search, Actions & Filters (Sticky) */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md pt-4 pb-3 -mx-4 px-4 md:-mx-8 md:px-8 -mt-4 mb-5 border-b border-border/40 flex flex-col gap-3">
        {/* Top row: Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
          <div className="relative w-full sm:w-72 shrink-0">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Search ${title.toLowerCase()}…`}
              className="w-full pl-9 pr-9 py-2 text-sm bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0 sm:ml-auto">
            {selectMode ? (
              <>
                <button
                  onClick={selectAll}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
                >
                  <CheckSquare size={13} /> All
                </button>
                {selected.size > 0 && (
                  <button
                    onClick={() => setBulkTagOpen(true)}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-secondary border border-border text-foreground hover:bg-secondary/80 transition-colors"
                  >
                    <Tag size={13} /> Tag {selected.size}
                  </button>
                )}
                <button
                  onClick={clearSelect}
                  className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  <X size={13} /> Done
                </button>
              </>
            ) : (
              <>
                {totalCount > 0 && (
                  <button
                    onClick={() => setSelectMode(true)}
                    className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors border border-border"
                    title="Select multiple to bulk tag"
                  >
                    <Square size={13} /> Select
                  </button>
                )}
                <button
                  onClick={onAdd}
                  className="flex items-center gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-9 px-4 rounded-lg text-sm font-medium transition-colors"
                >
                  <Plus size={15} /> Add New
                </button>
              </>
            )}

            <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>
            <button 
              onClick={toggleViewMode} 
              className="p-2 rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors" 
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <ListIcon size={16} /> : <LayoutGrid size={16} />}
            </button>
          </div>
        </div>

        {/* Bottom row: Filters */}
        {filters && (
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none min-w-0 pb-1">
            {filters.map(f => (
              <button
                key={f}
                onClick={() => onFilterChange(f)}
                className={`shrink-0 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  activeFilter === f
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Empty states */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center rounded-xl border border-dashed border-border">
          <h3 className="text-lg font-semibold text-foreground mb-1">No {title.toLowerCase()} yet</h3>
          <p className="text-sm text-muted-foreground mb-5">Get started by creating your first entry.</p>
          <button
            onClick={onAdd}
            className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-border bg-secondary/50 text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Plus size={14} /> Create {title.slice(0, -1)}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center rounded-xl border border-dashed border-border">
          <Search size={28} className="text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {query ? `No results for "${query}"` : `No ${activeFilter} ${title.toLowerCase()}`}
          </p>
          <button
            onClick={() => { setQuery(''); if (isFiltered) onFilterChange('All'); }}
            className="mt-3 text-xs text-muted-foreground/60 hover:text-muted-foreground underline transition-colors"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-3"}>
          {filtered.map(entity => (
            <div key={entity.id} className="relative">
              {selectMode && (
                <button
                  onClick={e => { e.stopPropagation(); toggleSelect(entity.id); }}
                  className={`absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center transition-colors border ${
                    selected.has(entity.id)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-card/80 border-border text-transparent hover:border-primary/50'
                  }`}
                >
                  {selected.has(entity.id) && <span className="text-xs leading-none">✓</span>}
                </button>
              )}
              <div
                className={selectMode ? 'pointer-events-none' : ''}
                onClick={selectMode ? () => toggleSelect(entity.id) : undefined}
              >
                {renderCard(entity, viewMode)}
              </div>
            </div>
          ))}
        </div>
      )}

      {bulkTagOpen && entityType && (
        <BulkTagModal
          selectedIds={[...selected]}
          entityType={entityType}
          onClose={() => { setBulkTagOpen(false); clearSelect(); }}
        />
      )}
    </div>
  );
}
