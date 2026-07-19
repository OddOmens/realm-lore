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
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-md mb-5 border-b border-border/40 shadow-sm">
        <div className="px-4 pt-6 pb-3 md:px-8 md:pt-8 flex flex-col gap-5">
          <header>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <Wand2 size={22} className="text-primary" />
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Name Generator</h2>
              </div>
              <p className="text-muted-foreground text-sm mt-0.5">Generate lore-friendly names for characters, places, and more.</p>
            </div>
          </header>

          {/* Top row: Search and Filters (Type tabs) */}
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="relative w-full sm:w-72 shrink-0">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search names..."
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
            <div className="flex flex-wrap items-center gap-2 shrink-0 sm:ml-auto">
            {GENERATOR_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => {
                  setActiveType(t.key);
                  setResults([]);
                  setAddedIds(new Set());
                  if (t.key !== 'character') setActiveRace('any');
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  activeType === t.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          </div>
        </div>
      </div>

      <div className="space-y-6 px-4 md:px-8 pb-8">

          {/* Race picker — only shown for Character */}
          {activeType === 'character' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-border bg-card/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Race
                </p>
                <div className="relative">
                  <select
                    value={activeRace}
                    onChange={(e) => { setActiveRace(e.target.value); setResults([]); setAddedIds(new Set()); }}
                    className="w-full appearance-none bg-secondary/50 border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all text-foreground"
                  >
                    {CHARACTER_RACES.map(r => (
                      <option key={r.key} value={r.key}>
                        {r.emoji} {r.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Gender Expression
                </p>
                <div className="relative">
                  <select
                    value={activeGender}
                    onChange={(e) => { setActiveGender(e.target.value); setResults([]); setAddedIds(new Set()); }}
                    className="w-full appearance-none bg-secondary/50 border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all text-foreground"
                  >
                    {[{key: 'any', label: 'Any', emoji: '✨'}, {key: 'male', label: 'Masculine', emoji: '♂️'}, {key: 'female', label: 'Feminine', emoji: '♀️'}].map(g => (
                      <option key={g.key} value={g.key}>
                        {g.emoji} {g.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-card/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Format
                </p>
                <div className="relative">
                  <select
                    value={activeFormat}
                    onChange={(e) => { setActiveFormat(e.target.value); setResults([]); setAddedIds(new Set()); }}
                    className="w-full appearance-none bg-secondary/50 border border-border rounded-lg pl-3 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary transition-all text-foreground"
                  >
                    {[{key: 'any', label: 'Any'}, {key: 'first', label: 'First Name'}, {key: 'full', label: 'Full Name'}].map(f => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Generate button */}
          <div className="flex gap-3">
            <button
              onClick={() => generate(BATCH_SIZE)}
              className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
            >
              <Shuffle size={22} />
              Generate {generateLabel}
            </button>
            <button
              onClick={generateOne}
              title="Generate one more"
              className="px-5 py-5 rounded-2xl bg-secondary border border-border text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-all font-bold text-sm"
            >
              +1
            </button>
          </div>

          {/* Results grid */}
          {results.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Results</p>
                {mapping && mapping.storeType && (
                  <p className="text-[10px] text-muted-foreground/50">Click <Plus size={9} className="inline" /> to create as a {mapping.label}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                {(query.trim() ? results.filter(r => r.name?.toLowerCase().includes(query.trim().toLowerCase())) : results).map(entry => {
                  const added = addedIds.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      className={`group flex items-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                        added
                          ? 'bg-primary/5 border-primary/30 text-muted-foreground'
                          : 'bg-card border-border hover:border-primary/40'
                      }`}
                    >
                      <span className={`flex-1 text-sm font-medium leading-snug ${added ? 'line-through text-muted-foreground/50' : 'text-foreground'}`}>
                        {entry.name}
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          onClick={() => copy(entry.name, entry.id)}
                          title="Copy name"
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                        >
                          {copiedId === entry.id ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                        </button>
                        {mapping && mapping.storeType && !added && (
                          <button
                            onClick={() => handleAdd(entry)}
                            title={`Create as ${mapping.label}`}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
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
            <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
              <Shuffle size={40} className="text-muted-foreground/20" />
              <p className="text-muted-foreground/50 text-sm">
                Hit Generate to roll {BATCH_SIZE} {generateLabel.toLowerCase()}
              </p>
            </div>
          )}

      </div>
    </div>
  );
}
