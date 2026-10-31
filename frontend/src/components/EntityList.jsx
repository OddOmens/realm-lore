import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, X, Plus, Tag, CheckSquare, Square, LayoutGrid, List as ListIcon } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';
import { List as VirtualList, Grid as VirtualGrid } from 'react-window';

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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 animate-backdrop-in" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="bg-popover sm:ring-1 sm:ring-foreground/10 rounded-t-[14px] sm:rounded-xl shadow-lg w-full sm:max-w-sm sm:mx-4 overflow-hidden animate-sheet pb-[env(safe-area-inset-bottom)] sm:pb-0" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Bulk Tag</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.length} selected</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground transition-colors"><X size={14} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="tabs w-full">
            {['add', 'remove'].map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`tab flex-1 capitalize ${mode === m ? 'is-active' : ''}`}
              >{m} tags</button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              autoFocus
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Tags, comma-separated…"
              className="input"
            />
            <button
              type="submit"
              disabled={!input.trim() || saving}
              className="btn btn-primary w-full"
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
                    className="px-2 py-0.5 rounded-md border border-border text-xs text-foreground hover:bg-accent transition-colors"
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

// ── Virtualized rendering ──────────────────────────────────────────────────
const GRID_ROW_HEIGHT = 280;   // px per grid card row
const LIST_ROW_HEIGHT = 72;    // px per list row
const GAP = 16;                // gap between items

function useContainerSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

function getColumnCount(width) {
  if (width >= 1280) return 4;  // xl
  if (width >= 1024) return 3;  // lg
  if (width >= 768) return 2;   // md
  return 1;
}

function VirtualizedEntityGrid({ items, viewMode, selectMode, selected, toggleSelect, renderCard }) {
  const containerRef = useRef(null);
  const { width, height } = useContainerSize(containerRef);

  const columnCount = viewMode === 'grid' ? getColumnCount(width) : 1;
  const rowCount = Math.ceil(items.length / columnCount);
  const columnWidth = width > 0 ? (width - GAP * (columnCount - 1)) / columnCount : 300;

  const renderItem = useCallback((entity) => (
    <div className="relative h-full">
      {selectMode && (
        <button
          onClick={e => { e.stopPropagation(); toggleSelect(entity.id); }}
          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center transition-colors border ${
            selected.has(entity.id)
              ? 'bg-brand border-brand text-brand-foreground'
              : 'bg-background border-input text-transparent hover:border-ring'
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
  ), [selectMode, selected, toggleSelect, renderCard, viewMode]);

  // For small lists (< 50 items), skip virtualization overhead
  if (items.length < 50) {
    return (
      <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3" : "flex flex-col divide-y divide-border rounded-lg border border-border overflow-hidden"}>
        {items.map(entity => (
          <div key={entity.id}>{renderItem(entity)}</div>
        ))}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div ref={containerRef} style={{ height: 'calc(100dvh - 320px)', minHeight: 400 }}>
        {width > 0 && (
          <VirtualList
            height={Math.max(height, 400)}
            width={width}
            itemCount={items.length}
            itemSize={LIST_ROW_HEIGHT}
            overscanCount={5}
          >
            {({ index, style }) => (
              <div style={{ ...style, paddingBottom: 12 }}>
                {renderItem(items[index])}
              </div>
            )}
          </VirtualList>
        )}
      </div>
    );
  }

  // Grid mode
  return (
    <div ref={containerRef} style={{ height: 'calc(100dvh - 320px)', minHeight: 400 }}>
      {width > 0 && (
        <VirtualGrid
          height={Math.max(height, 400)}
          width={width}
          columnCount={columnCount}
          columnWidth={columnWidth + GAP}
          rowCount={rowCount}
          rowHeight={GRID_ROW_HEIGHT + GAP}
          overscanRowCount={3}
        >
          {({ columnIndex, rowIndex, style }) => {
            const itemIndex = rowIndex * columnCount + columnIndex;
            if (itemIndex >= items.length) return null;
            return (
              <div style={{ ...style, width: style.width - GAP, paddingBottom: GAP }}>
                {renderItem(items[itemIndex])}
              </div>
            );
          }}
        </VirtualGrid>
      )}
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
    <div className="flex-1 overflow-y-auto w-full">
      {/* Sticky Header block */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-3 sm:px-8 md:pt-8 flex flex-col gap-4">
          {/* Title row */}
          <header className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <div className="min-w-[min(16rem,100%)] flex-1">
              <div className="flex items-center gap-2.5">
                {PageIcon && <PageIcon size={20} className="shrink-0 text-muted-foreground" />}
                <h1 className="page-title truncate">{title}</h1>
              </div>
              <p className="page-subtitle">
                {totalCount === 0
                  ? `No ${title.toLowerCase()} yet.`
                  : `${showingCount === totalCount ? totalCount : `${showingCount} of ${totalCount}`} ${title.toLowerCase()}`}
              </p>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectMode ? (
                <>
                  <button onClick={selectAll} className="btn btn-outline">
                    <CheckSquare /> All
                  </button>
                  {selected.size > 0 && (
                    <button onClick={() => setBulkTagOpen(true)} className="btn btn-outline">
                      <Tag /> Tag {selected.size}
                    </button>
                  )}
                  <button onClick={clearSelect} className="btn btn-ghost">
                    <X /> Done
                  </button>
                </>
              ) : (
                <>
                  {totalCount > 0 && (
                    <button
                      onClick={() => setSelectMode(true)}
                      className="btn btn-outline"
                      title="Select multiple to bulk tag"
                    >
                      <Square /> Select
                    </button>
                  )}
                  <button onClick={onAdd} className="btn btn-primary">
                    <Plus /> New
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Search, filters and view toggle */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Search ${title.toLowerCase()}…`}
                className="input pl-8 pr-8"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {filters && (
              <div className="min-w-0 overflow-x-auto scrollbar-none">
                <div className="tabs" role="tablist">
                  {filters.map(f => (
                    <button
                      key={f}
                      role="tab"
                      aria-selected={activeFilter === f}
                      onClick={() => onFilterChange(f)}
                      className="tab"
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={toggleViewMode}
              className="btn btn-ghost btn-icon hidden sm:inline-flex sm:ml-auto"
              title={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
              aria-label={`Switch to ${viewMode === 'grid' ? 'list' : 'grid'} view`}
            >
              {viewMode === 'grid' ? <ListIcon /> : <LayoutGrid />}
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-8 sm:px-8">
        {/* Empty states */}
        {totalCount === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
            {PageIcon && (
              <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <PageIcon size={18} />
              </span>
            )}
            <h3 className="text-sm font-semibold text-foreground">No {title.toLowerCase()} yet</h3>
            <p className="mt-1 text-sm text-muted-foreground mb-4">Create the first one to get started.</p>
            <button onClick={onAdd} className="btn btn-primary">
              <Plus /> New {title.slice(0, -1).toLowerCase()}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
            <Search size={24} className="text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              {query ? `No results for "${query}"` : `No ${activeFilter} ${title.toLowerCase()}`}
            </p>
            <button
              onClick={() => { setQuery(''); if (isFiltered) onFilterChange('All'); }}
              className="btn btn-ghost btn-sm mt-3"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <VirtualizedEntityGrid
            items={filtered}
            viewMode={viewMode}
            selectMode={selectMode}
            selected={selected}
            toggleSelect={toggleSelect}
            renderCard={renderCard}
          />
        )}
      </div>

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
