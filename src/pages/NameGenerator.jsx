import { useState, useCallback } from 'react';
import { Shuffle, Copy, Check, Wand2, Plus } from 'lucide-react';
import { GENERATOR_TYPES, generateName } from '../lib/nameGenerator';
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
};

export default function NameGenerator() {
  const navigate  = useNavigate();
  const addEntity = useWorldStore(s => s.addEntity);

  const [activeType, setActiveType] = useState('character');
  const [results, setResults]       = useState([]);
  const [addedIds, setAddedIds]     = useState(new Set());
  const [copiedId, setCopiedId]     = useState(null);

  const generate = useCallback((count = BATCH_SIZE) => {
    const names = Array.from({ length: count }, () => ({
      id: Math.random().toString(36).slice(2),
      name: generateName(activeType),
    }));
    setResults(names);
    setAddedIds(new Set());
  }, [activeType]);

  const generateOne = () => {
    const entry = { id: Math.random().toString(36).slice(2), name: generateName(activeType) };
    setResults(r => [entry, ...r].slice(0, BATCH_SIZE));
  };

  const copy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleAdd = async (entry) => {
    const mapping = ENTITY_MAP[activeType];
    if (!mapping) return;
    const created = await addEntity(mapping.storeType, { name: entry.name });
    setAddedIds(s => new Set(s).add(entry.id));
    navigate(`${mapping.path}/${created.id}`);
  };

  const activeLabel = GENERATOR_TYPES.find(t => t.key === activeType)?.label ?? '';
  const mapping = ENTITY_MAP[activeType];

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="sticky top-0 z-10 px-6 py-4 border-b border-border bg-card/90 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <Wand2 size={18} className="text-primary" />
          <h1 className="text-lg font-bold text-foreground">Name Generator</h1>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 py-8 space-y-8">

          {/* Type tabs */}
          <div className="flex flex-wrap gap-2">
            {GENERATOR_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => { setActiveType(t.key); setResults([]); setAddedIds(new Set()); }}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all border ${
                  activeType === t.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:text-foreground hover:bg-secondary'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Generate button */}
          <div className="flex gap-3">
            <button
              onClick={() => generate(BATCH_SIZE)}
              className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl bg-primary text-primary-foreground font-bold text-lg hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/20 active:scale-[0.98]"
            >
              <Shuffle size={22} />
              Generate {activeLabel} Names
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
                {mapping && (
                  <p className="text-[10px] text-muted-foreground/50">Click <Plus size={9} className="inline" /> to create as a {mapping.label}</p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {results.map(entry => {
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
                        {mapping && !added && (
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
              <p className="text-muted-foreground/50 text-sm">Hit Generate to roll {BATCH_SIZE} {activeLabel.toLowerCase()} names</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
