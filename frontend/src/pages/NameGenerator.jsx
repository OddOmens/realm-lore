import { useState, useCallback } from 'react';
import { Shuffle, Copy, Check, Wand2, Plus, Search, X } from 'lucide-react';
import { GENERATOR_TYPES, CHARACTER_RACES, generateName } from '../lib/nameGenerator';
import { useWorldStore } from '../store/useWorldStore';
import { useNavigate } from 'react-router-dom';

const BATCH_SIZE = 12;

// Maps generator type → store entity type + nav path (null = no entity list)
const ENTITY_MAP = {
  character: { storeType: 'characters', path: '/characters', label: 'Character' },
  town:      { storeType: 'locations',  path: '/locations',  label: 'Location'  },
  item:      { storeType: 'things',     path: '/things',     label: 'Thing'     },
  faction:   { storeType: 'factions',   path: '/factions',   label: 'Faction'   },
  place:     { storeType: 'locations',  path: '/locations',  label: 'Location'  },
  creature:  { storeType: 'creatures',  path: '/creatures',  label: 'Creature'  },
  lore:      { storeType: 'lore',       path: '/lore',       label: 'Lore'      },
  race:      { storeType: null,         path: null,          label: null        },
  tavern:    { storeType: 'locations',  path: '/locations',  label: 'Location'  },
  ship:      { storeType: 'things',     path: '/things',     label: 'Thing'     },
  deity:     { storeType: 'lore',       path: '/lore',       label: 'Lore'      },
};

export default function NameGenerator() {
  const navigate  = useNavigate();
  const addEntity = useWorldStore(s => s.addEntity);

  const [activeType, setActiveType]   = useState('character');
  const [activeRace, setActiveRace]   = useState('any');
  const [activeGender, setActiveGender] = useState('any');
  const [activeFormat, setActiveFormat] = useState('any');
  const [results, setResults]         = useState([]);
  const [addedIds, setAddedIds]       = useState(new Set());
  const [copiedId, setCopiedId]       = useState(null);
  const [query, setQuery] = useState('');

  const generate = useCallback((count = BATCH_SIZE) => {
    setResults(prevResults => {
      const existingNames = new Set(prevResults.map(r => r.name));
      const newNames = [];
      let attempts = 0;
      while (newNames.length < count && attempts < count * 3) {
        let candidate = generateName(activeType, activeRace, { gender: activeGender, format: activeFormat });
        if (!existingNames.has(candidate)) {
          existingNames.add(candidate);
          newNames.push({ id: Math.random().toString(36).slice(2), name: candidate });
        }
        attempts++;
      }
      return [...newNames, ...prevResults].slice(0, 100);
    });
    setAddedIds(new Set());
  }, [activeType, activeRace, activeGender, activeFormat]);

  const generateOne = () => {
    setResults(prevResults => {
      const existingNames = new Set(prevResults.map(r => r.name));
      let candidate;
      let attempts = 0;
      do {
        candidate = generateName(activeType, activeRace, { gender: activeGender, format: activeFormat });
        attempts++;
      } while (existingNames.has(candidate) && attempts < 10);
      
      const entry = { id: Math.random().toString(36).slice(2), name: candidate };
      return [entry, ...prevResults].slice(0, 100);
    });
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAdd = async (entry) => {
    const mapping = ENTITY_MAP[activeType];
    if (!mapping || !mapping.storeType) return;
    const created = await addEntity(mapping.storeType, { name: entry.name });
    setAddedIds(s => new Set(s).add(entry.id));
    navigate(`${mapping.path}/${created.id}`);
  };

  const activeTypeLabel = GENERATOR_TYPES.find(t => t.key === activeType)?.label ?? '';
  const activeRaceLabel = CHARACTER_RACES.find(r => r.key === activeRace)?.label ?? '';
  const mapping = ENTITY_MAP[activeType];

  const generateLabel = activeType === 'character' && activeRace !== 'any'
    ? `${activeRaceLabel} Names`
    : `${activeTypeLabel} Names`;

  return (
    <div className="flex-1 overflow-y-auto w-full">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="mx-auto w-full max-w-6xl px-4 pt-6 pb-3 sm:px-8 md:pt-8 flex flex-col gap-4">
          <header className="min-w-0">
            <div className="flex items-center gap-2.5">
              <Wand2 size={20} className="shrink-0 text-muted-foreground" />
              <h1 className="page-title truncate">Name Generator</h1>
            </div>
            <p className="page-subtitle">Generate lore-friendly names for characters, places, and more.</p>
          </header>

          {/* Search and generator type tabs */}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
            <div className="relative w-full sm:w-64 shrink-0">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search names…"
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
            <div className="min-w-0 overflow-x-auto scrollbar-none">
              <div className="tabs" role="tablist">
                {GENERATOR_TYPES.map(t => (
                  <button
                    key={t.key}
                    role="tab"
                    aria-selected={activeType === t.key}
                    onClick={() => {
                      setActiveType(t.key);
                      setResults([]);
                      setAddedIds(new Set());
                      if (t.key !== 'character') setActiveRace('any');
                    }}
                    className="tab"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl space-y-6 px-4 pt-5 pb-8 sm:px-8">

          {/* Race picker — only shown for Character */}
          {activeType === 'character' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="card p-3">
                <p className="section-label mb-2">
                  Race
                </p>
                <div className="relative">
                  <select
                    value={activeRace}
                    onChange={(e) => { setActiveRace(e.target.value); setResults([]); setAddedIds(new Set()); }}
                    className="input appearance-none pr-9"
                  >
                    {CHARACTER_RACES.map(r => (
                      <option key={r.key} value={r.key}>
                        {r.emoji} {r.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="card p-3">
                <p className="section-label mb-2">
                  Gender Expression
                </p>
                <div className="relative">
                  <select
                    value={activeGender}
                    onChange={(e) => { setActiveGender(e.target.value); setResults([]); setAddedIds(new Set()); }}
                    className="input appearance-none pr-9"
                  >
                    {[{key: 'any', label: 'Any', emoji: '✨'}, {key: 'male', label: 'Masculine', emoji: '♂️'}, {key: 'female', label: 'Feminine', emoji: '♀️'}].map(g => (
                      <option key={g.key} value={g.key}>
                        {g.emoji} {g.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="card p-3">
                <p className="section-label mb-2">
                  Format
                </p>
                <div className="relative">
                  <select
                    value={activeFormat}
                    onChange={(e) => { setActiveFormat(e.target.value); setResults([]); setAddedIds(new Set()); }}
                    className="input appearance-none pr-9"
                  >
                    {[{key: 'any', label: 'Any'}, {key: 'first', label: 'First Name'}, {key: 'full', label: 'Full Name'}].map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="flex gap-2">
            <button
              onClick={() => generate(BATCH_SIZE)}
              className="btn btn-primary h-10 flex-1 text-[0.9375rem]"
            >
              <Shuffle />
              Generate {generateLabel}
            </button>
            <button
              onClick={generateOne}
              title="Generate one more"
              className="btn btn-outline h-10 px-4"
            >
              +1
            </button>
          </div>

          {/* Results grid */}
          {results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="section-title">Results</p>
                {mapping && mapping.storeType && (
                  <p className="text-xs text-muted-foreground">Click <Plus size={9} className="inline" /> to create as a {mapping.label}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                {(query.trim() ? results.filter(r => r.name?.toLowerCase().includes(query.trim().toLowerCase())) : results).map(entry => {
                  const added = addedIds.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`group flex items-center gap-2 pl-3 pr-1.5 h-11 rounded-lg border transition-colors ${
                        added
                          ? 'bg-muted/50 border-border text-muted-foreground'
                          : 'bg-card border-border hover:border-foreground/15 hover:bg-accent/40'
                      }`}
                    >
                      <span className={`flex-1 min-w-0 truncate text-sm font-medium ${added ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                        {entry.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => copy(entry.name, entry.id)}
                          title="Copy name"
                          className="btn btn-ghost btn-icon btn-sm"
                        >
                          {copiedId === entry.id ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        </button>
                        {mapping && mapping.storeType && !added && (
                          <button
                            onClick={() => handleAdd(entry)}
                            title={`Create as ${mapping.label}`}
                            className="btn btn-ghost btn-icon btn-sm hover:text-brand"
                          >
                            <Plus size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {results.length === 0 && (
            <div className="flex flex-col items-center justify-center px-6 py-14 text-center rounded-lg border border-dashed border-border">
              <span className="mb-3 grid size-10 place-items-center rounded-lg bg-muted text-muted-foreground">
                <Shuffle size={18} />
              </span>
              <p className="text-muted-foreground text-sm">
                Hit Generate to roll {BATCH_SIZE} {generateLabel.toLowerCase()}
              </p>
            </div>
          )}

      </div>
    </div>
  );
}
