import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Dice5, Swords, Table2, Sparkles, Plus, Trash2, RotateCcw, Play, X } from 'lucide-react';
import { useAppSettings } from '../store/useAppSettings';

// ─── Dice Roller ─────────────────────────────────────────────────────────────

const DICE = [
  { sides: 4,   label: 'd4',   color: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { sides: 6,   label: 'd6',   color: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { sides: 8,   label: 'd8',   color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' },
  { sides: 10,  label: 'd10',  color: 'bg-green-500/20 border-green-500/40 text-green-300' },
  { sides: 12,  label: 'd12',  color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
  { sides: 20,  label: 'd20',  color: 'bg-violet-500/20 border-violet-500/40 text-violet-300' },
  { sides: 100, label: 'd100', color: 'bg-pink-500/20 border-pink-500/40 text-pink-300' },
];

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function DiceRoller() {
  const [pool, setPool] = useState([]); // [{ sides, count }]
  const [results, setResults] = useState(null);
  const [rolling, setRolling] = useState(false);
  const [modifier, setModifier] = useState(0);
  const [history, setHistory] = useState([]);

  const addDie = (sides) => {
    setPool(prev => {
      const existing = prev.find(d => d.sides === sides);
      if (existing) return prev.map(d => d.sides === sides ? { ...d, count: d.count + 1 } : d);
      return [...prev, { sides, count: 1 }];
    });
  };

  const removeDie = (sides) => {
    setPool(prev => prev
      .map(d => d.sides === sides ? { ...d, count: d.count - 1 } : d)
      .filter(d => d.count > 0)
    );
  };

  const roll = useCallback(() => {
    if (!pool.length) return;
    setRolling(true);
    setTimeout(() => {
      const rolls = pool.flatMap(({ sides, count }) =>
        Array.from({ length: count }, () => ({ sides, value: rollDie(sides) }))
      );
      const total = rolls.reduce((s, r) => s + r.value, 0) + modifier;
      const entry = { rolls, modifier, total, label: pool.map(d => `${d.count}d${d.sides}`).join(' + '), ts: Date.now() };
      setResults(entry);
      setHistory(h => [entry, ...h].slice(0, 10));
      setRolling(false);
    }, 400);
  }, [pool, modifier]);

  const clear = () => { setPool([]); setResults(null); };

  const poolLabel = pool.length
    ? pool.map(d => `${d.count}d${d.sides}`).join(' + ') + (modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '')
    : 'No dice selected';

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Dice grid */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Select Dice</h3>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {DICE.map(d => {
            const inPool = pool.find(p => p.sides === d.sides);
            return (
              <button
                key={d.sides}
                onClick={() => addDie(d.sides)}
                className={`relative flex flex-col items-center justify-center h-16 rounded-lg border-2 font-bold text-lg transition-all hover:scale-105 active:scale-95 ${d.color}`}
              >
                {d.label}
                {inPool && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">
                    {inPool.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Pool + modifier */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0 text-sm text-muted-foreground font-mono bg-secondary/60 rounded-md px-3 py-2 truncate">
            {poolLabel}
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setModifier(m => m - 1)} className="w-7 h-7 rounded bg-secondary border border-border text-sm hover:bg-secondary/80">−</button>
            <span className="w-10 text-center text-sm font-mono">{modifier >= 0 ? `+${modifier}` : modifier}</span>
            <button onClick={() => setModifier(m => m + 1)} className="w-7 h-7 rounded bg-secondary border border-border text-sm hover:bg-secondary/80">+</button>
          </div>
          {pool.length > 0 && (
            <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              <RotateCcw size={12} /> Clear
            </button>
          )}
        </div>

        {/* Remove individual dice */}
        {pool.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {pool.map(d => (
              <button
                key={d.sides}
                onClick={() => removeDie(d.sides)}
                className="flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-secondary border border-border text-muted-foreground hover:text-red-400 hover:border-red-500/40 transition-colors"
              >
                <X size={10} /> {d.count}d{d.sides}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={roll}
          disabled={!pool.length || rolling}
          className="flex items-center justify-center gap-2 h-11 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Dice5 size={16} className={rolling ? 'animate-spin' : ''} />
          {rolling ? 'Rolling…' : 'Roll!'}
        </button>
      </div>

      {/* Result */}
      {results && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 flex flex-col gap-3">
          <div className="text-center">
            <p className="text-5xl font-black text-violet-300 tabular-nums">{results.total}</p>
            <p className="text-xs text-muted-foreground mt-1">{results.label}{results.modifier !== 0 ? ` ${results.modifier > 0 ? '+' : ''}${results.modifier}` : ''}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {results.rolls.map((r, i) => {
              const isCrit = r.value === r.sides;
              const isFumble = r.value === 1;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center w-9 h-9 rounded-lg text-sm font-bold border ${
                    isCrit ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300' :
                    isFumble ? 'bg-red-500/20 border-red-500/50 text-red-400' :
                    'bg-secondary border-border text-foreground'
                  }`}
                  title={`d${r.sides}`}
                >
                  {r.value}
                </span>
              );
            })}
            {results.modifier !== 0 && (
              <span className="inline-flex items-center justify-center px-2 h-9 rounded-lg text-sm font-bold border bg-secondary border-border text-muted-foreground">
                {results.modifier > 0 ? '+' : ''}{results.modifier}
              </span>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Rolls</h3>
          <div className="flex flex-col gap-1">
            {history.slice(1).map((h, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1 border-b border-border/50 last:border-0">
                <span className="text-muted-foreground font-mono text-xs">{h.label}</span>
                <span className="font-bold text-foreground">{h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Initiative Tracker ───────────────────────────────────────────────────────

const CONDITIONS = ['Blinded', 'Charmed', 'Deafened', 'Frightened', 'Grappled', 'Incapacitated', 'Invisible', 'Paralyzed', 'Petrified', 'Poisoned', 'Prone', 'Restrained', 'Stunned', 'Unconscious'];

function InitiativeTracker() {
  const [combatants, setCombatants] = useState([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [round, setRound] = useState(1);
  const [started, setStarted] = useState(false);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newHp, setNewHp]   = useState('');

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);

  const add = () => {
    const name = newName.trim() || 'Combatant';
    const init = parseInt(newInit) || Math.floor(Math.random() * 20) + 1;
    const hp   = parseInt(newHp) || 10;
    setCombatants(prev => [...prev, { id: Date.now(), name, initiative: init, maxHp: hp, currentHp: hp, conditions: [] }]);
    setNewName(''); setNewInit(''); setNewHp('');
  };

  const update = (id, patch) => setCombatants(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id) => setCombatants(prev => prev.filter(c => c.id !== id));

  const nextTurn = () => {
    const next = (currentTurn + 1) % sorted.length;
    if (next === 0) setRound(r => r + 1);
    setCurrentTurn(next);
  };

  const toggleCondition = (id, cond) => {
    setCombatants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const has = c.conditions.includes(cond);
      return { ...c, conditions: has ? c.conditions.filter(x => x !== cond) : [...c.conditions, cond] };
    }));
  };

  const reset = () => { setStarted(false); setCurrentTurn(0); setRound(1); };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Add combatant */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Add Combatant</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Name"
            className="flex-1 min-w-[120px] bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={newInit}
            onChange={e => setNewInit(e.target.value)}
            placeholder="Init"
            type="number"
            className="w-20 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={newHp}
            onChange={e => setNewHp(e.target.value)}
            placeholder="HP"
            type="number"
            className="w-20 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <button
            onClick={add}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Combat controls */}
      {combatants.length > 0 && (
        <div className="flex items-center gap-2">
          {!started ? (
            <button
              onClick={() => { setStarted(true); setCurrentTurn(0); setRound(1); }}
              className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-500 transition-colors"
            >
              <Play size={14} /> Start Combat
            </button>
          ) : (
            <>
              <span className="text-sm text-muted-foreground">Round <strong className="text-foreground">{round}</strong></span>
              <button
                onClick={nextTurn}
                className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
              >
                Next Turn →
              </button>
              <button
                onClick={reset}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw size={13} /> Reset
              </button>
            </>
          )}
          <button
            onClick={() => { setCombatants([]); reset(); }}
            className="ml-auto flex items-center gap-1.5 h-9 px-3 rounded-md text-sm text-muted-foreground hover:text-red-400 transition-colors"
          >
            <Trash2 size={13} /> Clear All
          </button>
        </div>
      )}

      {/* Combatant list */}
      <div className="flex flex-col gap-2">
        {sorted.map((c, idx) => {
          const isActive = started && idx === currentTurn;
          const hpPct = Math.max(0, (c.currentHp / c.maxHp) * 100);
          const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-500' : 'bg-red-500';
          return (
            <div
              key={c.id}
              className={`rounded-xl border p-4 flex flex-col gap-2 transition-colors ${
                isActive ? 'border-violet-500/60 bg-violet-500/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                  isActive ? 'bg-violet-600 text-white' : 'bg-secondary text-muted-foreground'
                }`}>
                  {c.initiative}
                </div>
                <span className="font-medium text-sm flex-1">{c.name}</span>
                {/* HP controls */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => update(c.id, { currentHp: Math.max(0, c.currentHp - 1) })}
                    className="w-6 h-6 rounded bg-secondary border border-border text-xs hover:bg-red-500/20 hover:border-red-500/40"
                  >−</button>
                  <span className="text-sm font-mono w-16 text-center">{c.currentHp}/{c.maxHp}</span>
                  <button
                    onClick={() => update(c.id, { currentHp: Math.min(c.maxHp, c.currentHp + 1) })}
                    className="w-6 h-6 rounded bg-secondary border border-border text-xs hover:bg-green-500/20 hover:border-green-500/40"
                  >+</button>
                </div>
                <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>

              {/* HP bar */}
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all ${hpColor}`} style={{ width: `${hpPct}%` }} />
              </div>

              {/* Conditions */}
              <div className="flex flex-wrap gap-1">
                {CONDITIONS.map(cond => {
                  const active = c.conditions.includes(cond);
                  return (
                    <button
                      key={cond}
                      onClick={() => toggleCondition(c.id, cond)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                        active
                          ? 'bg-orange-500/20 border-orange-500/50 text-orange-300'
                          : 'border-border text-muted-foreground/50 hover:text-muted-foreground'
                      }`}
                    >
                      {cond}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Encounter Table Roller ───────────────────────────────────────────────────

function EncounterRoller() {
  const [tables, setTables] = useState([
    {
      id: 1,
      name: 'Forest Encounters',
      die: 8,
      entries: [
        { id: 1, range: '1', result: 'A pack of wolves (2d4)' },
        { id: 2, range: '2', result: 'Goblin scouts (1d6+2)' },
        { id: 3, range: '3', result: 'Abandoned campsite with supplies' },
        { id: 4, range: '4', result: 'A friendly ranger who offers directions' },
        { id: 5, range: '5', result: 'Giant spider ambush (1d4)' },
        { id: 6, range: '6', result: 'A wounded deer — investigate?' },
        { id: 7, range: '7', result: 'Bandit ambush (1d8+4)' },
        { id: 8, range: '8', result: 'Ancient stone ruins, possibly inhabited' },
      ],
    },
  ]);
  const [activeTable, setActiveTable] = useState(0);
  const [lastRoll, setLastRoll] = useState(null);
  const [newEntry, setNewEntry] = useState('');

  const table = tables[activeTable];

  const rollTable = () => {
    if (!table?.entries.length) return;
    const roll = Math.floor(Math.random() * table.die) + 1;
    const entry = table.entries.find(e => {
      const parts = e.range.split('-').map(Number);
      if (parts.length === 2) return roll >= parts[0] && roll <= parts[1];
      return Number(e.range) === roll;
    }) || table.entries[Math.floor(Math.random() * table.entries.length)];
    setLastRoll({ roll, result: entry?.result ?? 'Nothing found.' });
  };

  const addEntry = () => {
    if (!newEntry.trim()) return;
    setTables(prev => prev.map((t, i) => {
      if (i !== activeTable) return t;
      const nextRange = String(t.entries.length + 1);
      return { ...t, entries: [...t.entries, { id: Date.now(), range: nextRange, result: newEntry.trim() }] };
    }));
    setNewEntry('');
  };

  const removeEntry = (entryId) => {
    setTables(prev => prev.map((t, i) => i !== activeTable ? t : { ...t, entries: t.entries.filter(e => e.id !== entryId) }));
  };

  const addTable = () => {
    const t = { id: Date.now(), name: `Table ${tables.length + 1}`, die: 6, entries: [] };
    setTables(prev => [...prev, t]);
    setActiveTable(tables.length);
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Table selector */}
      <div className="flex gap-2 flex-wrap items-center">
        {tables.map((t, i) => (
          <button
            key={t.id}
            onClick={() => { setActiveTable(i); setLastRoll(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${i === activeTable ? 'bg-violet-600 text-white' : 'bg-secondary border border-border text-muted-foreground hover:text-foreground'}`}
          >
            {t.name}
          </button>
        ))}
        <button
          onClick={addTable}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-muted-foreground border border-dashed border-border hover:border-violet-500/50 hover:text-violet-400 transition-colors"
        >
          <Plus size={12} /> New Table
        </button>
      </div>

      {table && (
        <>
          {/* Roll */}
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div>
                <h3 className="font-semibold text-foreground">{table.name}</h3>
                <p className="text-xs text-muted-foreground">d{table.die} table · {table.entries.length} entries</p>
              </div>
              <button
                onClick={rollTable}
                className="ml-auto flex items-center gap-2 h-9 px-5 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors"
              >
                <Dice5 size={15} /> Roll
              </button>
            </div>

            {lastRoll && (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3">
                <p className="text-xs text-muted-foreground mb-1">Rolled {lastRoll.roll} on d{table.die}</p>
                <p className="text-sm font-medium text-foreground">{lastRoll.result}</p>
              </div>
            )}
          </div>

          {/* Entries */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table Entries</h3>
            <div className="flex flex-col gap-1">
              {table.entries.map(entry => (
                <div key={entry.id} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0 group">
                  <span className="text-xs font-mono text-muted-foreground w-8 shrink-0">{entry.range}</span>
                  <span className="text-sm flex-1">{entry.result}</span>
                  <button
                    onClick={() => removeEntry(entry.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all"
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-1">
              <input
                value={newEntry}
                onChange={e => setNewEntry(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addEntry()}
                placeholder="Add encounter result…"
                className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
              />
              <button
                onClick={addEntry}
                className="flex items-center gap-1 h-9 px-3 rounded-md text-sm bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Spell Slot Tracker ───────────────────────────────────────────────────────

const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const CLASS_SLOTS = {
  'Wizard/Sorcerer/Bard (lvl 20)': [4, 3, 3, 3, 3, 2, 2, 1, 1],
  'Cleric/Druid (lvl 20)':         [4, 3, 3, 3, 3, 2, 2, 1, 1],
  'Paladin/Ranger (lvl 20)':       [4, 3, 3, 3, 2, 0, 0, 0, 0],
  'Fighter (Eldritch Knight lvl 20)': [4, 3, 3, 0, 0, 0, 0, 0, 0],
  'Warlock (lvl 20)':              [0, 0, 0, 4, 0, 0, 0, 0, 0],
  'Custom':                        [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

function SpellSlotTracker() {
  const [characters, setCharacters] = useState([]);
  const [newName, setNewName] = useState('');
  const [newClass, setNewClass] = useState('Custom');

  const addCharacter = () => {
    const name = newName.trim() || 'Character';
    const slots = CLASS_SLOTS[newClass].map((max, i) => ({ level: i + 1, max, used: 0 })).filter(s => s.max > 0);
    setCharacters(prev => [...prev, { id: Date.now(), name, slots }]);
    setNewName('');
  };

  const removeChar = (id) => setCharacters(prev => prev.filter(c => c.id !== id));

  const useSlot = (charId, level) => {
    setCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c;
      return { ...c, slots: c.slots.map(s => s.level === level && s.used < s.max ? { ...s, used: s.used + 1 } : s) };
    }));
  };

  const restoreSlot = (charId, level) => {
    setCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c;
      return { ...c, slots: c.slots.map(s => s.level === level && s.used > 0 ? { ...s, used: s.used - 1 } : s) };
    }));
  };

  const longRest = (charId) => {
    setCharacters(prev => prev.map(c => c.id !== charId ? c : { ...c, slots: c.slots.map(s => ({ ...s, used: 0 })) }));
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Add character */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Add Character</h3>
        <div className="flex gap-2 flex-wrap">
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCharacter()}
            placeholder="Character name"
            className="flex-1 min-w-[140px] bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <select
            value={newClass}
            onChange={e => setNewClass(e.target.value)}
            className="bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          >
            {Object.keys(CLASS_SLOTS).map(c => <option key={c}>{c}</option>)}
          </select>
          <button
            onClick={addCharacter}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={14} /> Add
          </button>
        </div>
      </div>

      {/* Character cards */}
      {characters.map(char => (
        <div key={char.id} className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">{char.name}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => longRest(char.id)}
                className="flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
              >
                <Sparkles size={12} /> Long Rest
              </button>
              <button onClick={() => removeChar(char.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            {char.slots.map(slot => {
              const remaining = slot.max - slot.used;
              return (
                <div key={slot.level} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">Level {slot.level}</span>
                  <div className="flex gap-1.5 flex-1">
                    {Array.from({ length: slot.max }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => i < remaining ? useSlot(char.id, slot.level) : restoreSlot(char.id, slot.level)}
                        className={`w-7 h-7 rounded-md border transition-all ${
                          i < remaining
                            ? 'bg-violet-500/30 border-violet-500/50 hover:bg-red-500/20 hover:border-red-500/40'
                            : 'bg-secondary/50 border-border/50 opacity-40 hover:bg-green-500/20 hover:border-green-500/40 hover:opacity-100'
                        }`}
                        title={i < remaining ? 'Use slot' : 'Restore slot'}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground font-mono w-8 text-right">{remaining}/{slot.max}</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {characters.length === 0 && (
        <div className="text-center py-12 text-muted-foreground text-sm">
          Add a character above to start tracking spell slots.
        </div>
      )}
    </div>
  );
}

// ─── Main DnD Tools page ──────────────────────────────────────────────────────

const TOOL_MAP = {
  '/tools/dice':       { label: 'Dice Roller',        icon: Dice5,    settingKey: 'diceRoller',        component: DiceRoller },
  '/tools/initiative': { label: 'Initiative Tracker',  icon: Swords,   settingKey: 'initiativeTracker', component: InitiativeTracker },
  '/tools/encounters': { label: 'Encounter Tables',    icon: Table2,   settingKey: 'encounterRoller',   component: EncounterRoller },
  '/tools/spells':     { label: 'Spell Slots',         icon: Sparkles, settingKey: 'spellSlots',        component: SpellSlotTracker },
};

export default function DndTools() {
  const dndTools = useAppSettings(s => s.dndTools);
  const { pathname } = useLocation();

  const tool = TOOL_MAP[pathname];

  if (!dndTools.enabled) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <Dice5 size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">DnD Tools are disabled. Enable them in <strong>Settings → General</strong>.</p>
        </div>
      </div>
    );
  }

  if (!tool || !dndTools[tool.settingKey]) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 text-center">
        <div>
          <Dice5 size={40} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">This tool is not enabled. Turn it on in <strong>Settings → General</strong>.</p>
        </div>
      </div>
    );
  }

  const Icon = tool.icon;
  const Component = tool.component;

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center gap-3 px-6 py-5 border-b border-border bg-card">
        <Icon size={18} className="text-violet-400" />
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{tool.label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Tabletop RPG utilities for your sessions.</p>
        </div>
      </header>
      <div className="p-6">
        <Component />
      </div>
    </div>
  );
}
