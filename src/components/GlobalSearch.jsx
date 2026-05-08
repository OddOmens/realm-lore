import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Users, Map as MapIcon, Box, BookOpen, BookMarked, X, ArrowRight, Flag, PawPrint, Library, MapPin } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';

const TYPE_META = {
  characters: { label: 'Character', icon: Users,       color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20' },
  locations:  { label: 'Location',  icon: MapIcon,     color: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20' },
  things:     { label: 'Thing',     icon: Box,         color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20' },
  factions:   { label: 'Faction',   icon: Flag,        color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  creatures:  { label: 'Creature',  icon: PawPrint,    color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  stories:    { label: 'Story',     icon: BookOpen,    color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  books:      { label: 'Book',      icon: Library,     color: 'text-cyan-400',   bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
  maps:       { label: 'Map',       icon: MapPin,      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'characters', label: 'Characters' },
  { value: 'locations', label: 'Locations' },
  { value: 'things', label: 'Things' },
  { value: 'factions', label: 'Factions' },
  { value: 'creatures', label: 'Creatures' },
  { value: 'books', label: 'Books' },
  { value: 'maps', label: 'Maps' },
  { value: 'stories', label: 'Stories' },
];

const highlightCache = new Map();
function highlight(text, query) {
  if (!query || !text) return text;
  const cacheKey = query.toLowerCase();
  let re = highlightCache.get(cacheKey);
  if (!re) {
    re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    if (highlightCache.size > 20) highlightCache.clear();
    highlightCache.set(cacheKey, re);
  }
  re.lastIndex = 0;
  const parts = text.split(re);
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-primary/30 text-foreground rounded-sm px-0.5">{p}</mark>
      : p
  );
}

export default function GlobalSearch({ onClose }) {
  const navigate = useNavigate();
  const characters = useWorldStore(s => s.characters);
  const locations  = useWorldStore(s => s.locations);
  const things     = useWorldStore(s => s.things);
  const lore       = useWorldStore(s => s.lore);
  const factions   = useWorldStore(s => s.factions);
  const creatures  = useWorldStore(s => s.creatures);
  const stories    = useWorldStore(s => s.stories);
  const books      = useWorldStore(s => s.books);
  const maps       = useWorldStore(s => s.maps);

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const allItems = useMemo(() => [
    ...characters.map(e => ({ ...e, _type: 'characters' })),
    ...locations.map(e  => ({ ...e, _type: 'locations' })),
    ...things.map(e     => ({ ...e, _type: 'things' })),
    ...factions.map(e   => ({ ...e, _type: 'factions' })),
    ...creatures.map(e  => ({ ...e, _type: 'creatures' })),
    ...books.map(e      => ({ ...e, _type: 'books', name: e.name || 'Untitled book' })),
    ...maps.map(e       => ({ ...e, _type: 'maps', name: e.name || 'Untitled map' })),
    ...stories.map(e    => ({ ...e, _type: 'stories' })),
  ], [characters, locations, things, lore, factions, creatures, stories, books, maps]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    // No query = no results, instead of dumping the entire world (avoids
    // jank on large worlds and gives the empty-state hint room to render).
    if (!q) return [];
    return allItems.filter(item => {
      if (filter !== 'all' && item._type !== filter) return false;
      const cleanContent = (item.content || '').replace(/\f/g, ' ');
      return (
        item.name?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        item.author?.toLowerCase().includes(q) ||
        item.genre?.toLowerCase().includes(q) ||
        cleanContent.toLowerCase().includes(q)
      );
    });
  }, [allItems, query, filter]);

  const go = (item) => {
    if (item._type === 'stories') navigate(`/stories/${item.id}`);
    else if (item._type === 'books') navigate(`/books/${item.id}`);
    else if (item._type === 'maps') navigate(`/maps/${item.id}`);
    else navigate(`/${item._type}/${item.id}`);
    onClose();
  };

  const handleKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter' && results[cursor]) go(results[cursor]);
    if (e.key === 'Escape') onClose();
  };

  useEffect(() => {
    const el = listRef.current?.children[cursor];
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const grouped = useMemo(() => {
    const g = {};
    for (const item of results) {
      if (!g[item._type]) g[item._type] = [];
      g[item._type].push(item);
    }
    return g;
  }, [results]);

  const flatWithHeaders = useMemo(() => {
    const rows = [];
    let idx = 0;
    for (const type of ['characters', 'locations', 'things', 'factions', 'creatures', 'books', 'maps', 'stories']) {
      const items = grouped[type];
      if (!items) continue;
      rows.push({ kind: 'header', type, count: items.length });
      for (const item of items) rows.push({ kind: 'item', item, idx: idx++ });
    }
    return rows;
  }, [grouped]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[5vh] sm:pt-[12vh] bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl mx-4 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[70vh]">
        {/* Search bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={17} className="text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setCursor(0); }}
            onKeyDown={handleKey}
            placeholder="Search entities, books, maps, chapters…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-muted-foreground hover:text-foreground transition-colors">
              <X size={15} />
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-xs text-muted-foreground font-mono">
            Esc
          </kbd>
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border overflow-x-auto scrollbar-none">
          {FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => { setFilter(f.value); setCursor(0); }}
              className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
          <span className="ml-auto shrink-0 text-xs text-muted-foreground">{results.length} result{results.length !== 1 ? 's' : ''}</span>
        </div>

        {/* Results */}
        <div ref={listRef} className="overflow-y-auto flex-1 py-2">
          {flatWithHeaders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={28} className="text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {query.trim()
                  ? <>No results for &ldquo;{query}&rdquo;</>
                  : 'Type to search across every entity and story.'}
              </p>
            </div>
          ) : (
            flatWithHeaders.map((row) => {
              if (row.kind === 'header') {
                const meta = TYPE_META[row.type];
                const Icon = meta.icon;
                return (
                  <div key={`h-${row.type}`} className="flex items-center gap-2 px-4 pt-3 pb-1">
                    <Icon size={12} className={meta.color} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{meta.label}s</span>
                    <span className="text-xs text-muted-foreground/50">{row.count}</span>
                  </div>
                );
              }
              const { item, idx } = row;
              const meta = TYPE_META[item._type];
              const Icon = meta.icon;
              const isActive = cursor === idx;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item)}
                  onMouseEnter={() => setCursor(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group ${isActive ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                >
                  <span className={`shrink-0 p-1.5 rounded-md border ${meta.bg} ${meta.border}`}>
                    <Icon size={13} className={meta.color} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {highlight(item.name, query)}
                    </p>
                    {(item.description || item.content) && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {highlight(((item.description || item.content || '').replace(/\f/g, ' ').replace(/\[\[(.*?)\]\]/g, '$1').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')).slice(0, 120), query)}
                      </p>
                    )}
                  </div>
                  {item.type && (
                    <span className="shrink-0 text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                      {item.type}
                    </span>
                  )}
                  <ArrowRight size={13} className={`shrink-0 text-muted-foreground transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><kbd className="px-1.5 py-0.5 rounded border border-border font-mono text-xs">↑↓</kbd> navigate</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><kbd className="px-1.5 py-0.5 rounded border border-border font-mono text-xs">↵</kbd> open</span>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><kbd className="px-1.5 py-0.5 rounded border border-border font-mono text-xs">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
