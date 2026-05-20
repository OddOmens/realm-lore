import { useState, useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Dice5, Swords, Table2, Sparkles, Plus, Trash2, RotateCcw, Play,
  X, BookOpen, Gem, User, ChevronDown, ChevronUp, Shield, Heart,
  Zap, AlertTriangle, Pause, SkipForward, Wand2, Box
} from 'lucide-react';
import DiceBox from '@3d-dice/dice-box';
import SpellsList from '../components/dnd/SpellsList';
import ItemsList from '../components/dnd/ItemsList';
import { useAppSettings } from '../store/useAppSettings';

// ─── Persistence helpers ──────────────────────────────────────────────────────

function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(`dndTool_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveState(key, value) {
  try { localStorage.setItem(`dndTool_${key}`, JSON.stringify(value)); } catch {}
}

function usePersisted(key, fallback) {
  const [state, setState] = useState(() => loadState(key, fallback));
  const set = useCallback((valOrFn) => {
    setState(prev => {
      const next = typeof valOrFn === 'function' ? valOrFn(prev) : valOrFn;
      saveState(key, next);
      return next;
    });
  }, [key]);
  return [state, set];
}

// ─── Dice Roller ─────────────────────────────────────────────────────────────

const DICE = [
  { sides: 4,   label: 'd4',   color: 'bg-red-500/20 border-red-500/40 text-red-300 hover:bg-red-500/30' },
  { sides: 6,   label: 'd6',   color: 'bg-orange-500/20 border-orange-500/40 text-orange-300 hover:bg-orange-500/30' },
  { sides: 8,   label: 'd8',   color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/30' },
  { sides: 10,  label: 'd10',  color: 'bg-green-500/20 border-green-500/40 text-green-300 hover:bg-green-500/30' },
  { sides: 12,  label: 'd12',  color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/30' },
  { sides: 20,  label: 'd20',  color: 'bg-violet-500/20 border-violet-500/40 text-violet-300 hover:bg-violet-500/30' },
  { sides: 100, label: 'd%',   color: 'bg-pink-500/20 border-pink-500/40 text-pink-300 hover:bg-pink-500/30' },
];

function rollDie(sides) {
  return Math.floor(Math.random() * sides) + 1;
}

function DiceRoller() {
  const [pool, setPool]         = usePersisted('dice_pool', []);
  const [modifier, setModifier] = usePersisted('dice_modifier', 0);
  const [history, setHistory]   = usePersisted('dice_history', []);
  const [results, setResults]   = useState(null);
  const [rolling, setRolling]   = useState(false);
  const [advantage, setAdvantage] = useState(null); // null | 'adv' | 'dis'

  const diceBoxRef = useRef(null);
  const boxInstance = useRef(null);

  useEffect(() => {
    let active = true;
    const initBox = async () => {
      const box = new DiceBox(diceBoxRef.current, {
        assetPath: '/dice-box/',
        theme: 'default',
        scale: 6,
        mass: 1,
        gravity: 1,
        friction: 0.8,
        restitution: 0.5,
      });
      await box.init();
      if (active) boxInstance.current = box;
    };
    initBox();
    return () => {
      active = false;
      if (boxInstance.current) boxInstance.current.clear();
    };
  }, []);

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

  const trigger3DRoll = async (sides, isPool = false) => {
    setRolling(true);
    let label = '';
    let rollStr = '';

    if (!isPool) {
      if (sides === 20 && advantage) {
        rollStr = advantage === 'adv' ? `2d20kh1` : `2d20kl1`;
      } else {
        rollStr = `1d${sides}`;
      }
      label = `1d${sides}`;
    } else {
      label = pool.map(d => `${d.count}d${d.sides}`).join(' + ');
      rollStr = label;
    }

    if (modifier !== 0) {
      rollStr += modifier > 0 ? `+${modifier}` : modifier;
    }

    if (boxInstance.current) {
      boxInstance.current.clear();
      try {
        const boxResults = await boxInstance.current.roll(rollStr);
        let total = 0;
        let flatRolls = [];
        boxResults.forEach(g => {
          if (g.value) total += g.value;
          if (g.dice) {
            g.dice.forEach(d => {
              flatRolls.push({ sides: d.sides || sides, value: d.value, kept: d.type !== 'dropped' && d.type !== 'ignored' });
            });
          }
        });
        const entry = { rolls: flatRolls, modifier, total, label, ts: Date.now(), advantage: !isPool && sides === 20 ? advantage : null };
        setResults(entry);
        setHistory(h => [entry, ...h].slice(0, 20));
      } catch (err) {
        console.error(err);
      }
    } else {
      // Fallback
      setTimeout(() => {
        let rolls = [];
        let total = 0;
        if (!isPool) {
          if (sides === 20 && advantage) {
            const r1 = rollDie(20), r2 = rollDie(20);
            const chosen = advantage === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
            rolls = [
              { sides: 20, value: r1, kept: r1 === chosen },
              { sides: 20, value: r2, kept: r2 === chosen },
            ];
            total = chosen + modifier;
          } else {
            rolls = [{ sides, value: rollDie(sides), kept: true }];
            total = rolls[0].value + modifier;
          }
        } else {
          rolls = pool.flatMap(({ sides: s, count }) =>
            Array.from({ length: count }, () => ({ sides: s, value: rollDie(s), kept: true }))
          );
          total = rolls.reduce((sum, r) => sum + r.value, 0) + modifier;
        }
        const entry = { rolls, modifier, total, label, ts: Date.now(), advantage: !isPool && sides === 20 ? advantage : null };
        setResults(entry);
        setHistory(h => [entry, ...h].slice(0, 20));
      }, 300);
    }
    setRolling(false);
  };

  const quickRoll = (sides) => trigger3DRoll(sides, false);
  const roll = useCallback(() => trigger3DRoll(null, true), [pool, modifier, advantage]);

  const clear = () => { setPool([]); setResults(null); setAdvantage(null); };

  const poolLabel = pool.length
    ? pool.map(d => `${d.count}d${d.sides}`).join(' + ') + (modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '')
    : 'No dice selected';

  const isD20Only = pool.length === 1 && pool[0].sides === 20 && pool[0].count === 1;

  return (
    <>
      <div ref={diceBoxRef} className="fixed inset-0 pointer-events-none z-[100]" />
      <div className="flex flex-col gap-5 max-w-2xl">
      {/* Quick-roll row */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Quick Roll</h3>
          <span className="text-[10px] text-muted-foreground/50">Click to roll once · Right-click to add to pool</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {DICE.map(d => {
            const inPool = pool.find(p => p.sides === d.sides);
            return (
              <button
                key={d.sides}
                onClick={() => quickRoll(d.sides)}
                onContextMenu={e => { e.preventDefault(); addDie(d.sides); }}
                className={`relative flex flex-col items-center justify-center h-14 rounded-lg border-2 font-bold text-base transition-all hover:scale-105 active:scale-95 select-none ${d.color}`}
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
      </div>

      {/* Pool builder */}
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Dice Pool</h3>

        <div className="grid grid-cols-7 gap-1.5">
          {DICE.map(d => (
            <button
              key={d.sides}
              onClick={() => addDie(d.sides)}
              className="flex items-center justify-center h-8 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              +{d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-0 text-sm text-muted-foreground font-mono bg-secondary/60 rounded-md px-3 py-2 truncate">
            {poolLabel}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-xs text-muted-foreground mr-1">Mod</span>
            <button onClick={() => setModifier(m => m - 1)} className="w-7 h-7 rounded bg-secondary border border-border text-sm hover:bg-secondary/80 transition-colors">−</button>
            <span className="w-10 text-center text-sm font-mono">{modifier >= 0 ? `+${modifier}` : modifier}</span>
            <button onClick={() => setModifier(m => m + 1)} className="w-7 h-7 rounded bg-secondary border border-border text-sm hover:bg-secondary/80 transition-colors">+</button>
          </div>
          {pool.length > 0 && (
            <button onClick={clear} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <RotateCcw size={12} /> Clear
            </button>
          )}
        </div>

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

        {/* Advantage / Disadvantage — only for d20 pools */}
        {isD20Only && (
          <div className="flex gap-1.5">
            <button
              onClick={() => setAdvantage(a => a === 'adv' ? null : 'adv')}
              className={`flex-1 h-8 rounded-md text-xs font-semibold border transition-colors ${advantage === 'adv' ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              Advantage
            </button>
            <button
              onClick={() => setAdvantage(a => a === 'dis' ? null : 'dis')}
              className={`flex-1 h-8 rounded-md text-xs font-semibold border transition-colors ${advantage === 'dis' ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              Disadvantage
            </button>
          </div>
        )}

        <button
          onClick={roll}
          disabled={!pool.length || rolling}
          className="flex items-center justify-center gap-2 h-10 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Dice5 size={15} className={rolling ? 'animate-spin' : ''} />
          {rolling ? 'Rolling…' : `Roll ${poolLabel}`}
        </button>
      </div>

      {/* Result */}
      {results && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 flex flex-col gap-3">
          <div className="text-center">
            <p className="text-6xl font-black text-violet-300 tabular-nums leading-none">{results.total}</p>
            <p className="text-xs text-muted-foreground mt-2">
              {results.label}
              {results.modifier !== 0 ? ` ${results.modifier > 0 ? '+' : ''}${results.modifier}` : ''}
              {results.advantage ? ` (${results.advantage === 'adv' ? 'advantage' : 'disadvantage'})` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {results.rolls.map((r, i) => {
              const isCrit   = r.value === r.sides && r.kept;
              const isFumble = r.value === 1 && r.kept;
              const dropped  = !r.kept;
              return (
                <span
                  key={i}
                  className={`inline-flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold border transition-all ${
                    dropped   ? 'bg-secondary/30 border-border/40 text-muted-foreground/40 line-through' :
                    isCrit    ? 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300 ring-1 ring-yellow-500/50' :
                    isFumble  ? 'bg-red-500/20 border-red-500/50 text-red-400 ring-1 ring-red-500/50' :
                    'bg-secondary border-border text-foreground'
                  }`}
                  title={`d${r.sides}${dropped ? ' (dropped)' : ''}`}
                >
                  {r.value}
                </span>
              );
            })}
            {results.modifier !== 0 && (
              <span className="inline-flex items-center justify-center px-2.5 h-10 rounded-lg text-sm font-bold border bg-secondary border-border text-muted-foreground">
                {results.modifier > 0 ? '+' : ''}{results.modifier}
              </span>
            )}
          </div>
          {results.rolls.some(r => r.value === r.sides && r.kept) && (
            <p className="text-center text-xs font-semibold text-yellow-400 uppercase tracking-wider">Critical Hit!</p>
          )}
          {results.rolls.some(r => r.value === 1 && r.kept) && !results.rolls.some(r => r.value === r.sides && r.kept) && (
            <p className="text-center text-xs font-semibold text-red-400 uppercase tracking-wider">Fumble</p>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Roll History</h3>
            <button onClick={() => setHistory([])} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Clear</button>
          </div>
          <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
            {history.map((h, i) => (
              <div key={h.ts} className={`flex items-center justify-between text-sm py-1.5 px-1 rounded transition-colors ${i === 0 ? 'bg-violet-500/5' : 'hover:bg-secondary/50'}`}>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-muted-foreground font-mono text-xs shrink-0">{h.label}</span>
                  {h.advantage && <span className="text-[10px] text-muted-foreground/60">{h.advantage === 'adv' ? 'adv' : 'dis'}</span>}
                  {h.modifier !== 0 && <span className="text-[10px] text-muted-foreground/60">{h.modifier > 0 ? '+' : ''}{h.modifier}</span>}
                </div>
                <span className={`font-bold tabular-nums ml-2 ${i === 0 ? 'text-violet-300' : 'text-foreground'}`}>{h.total}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </>
  );
}

// ─── Initiative Tracker ───────────────────────────────────────────────────────

const CONDITIONS = [
  { name: 'Blinded',        color: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
  { name: 'Charmed',        color: 'bg-pink-500/20 border-pink-500/40 text-pink-300' },
  { name: 'Deafened',       color: 'bg-slate-500/20 border-slate-500/40 text-slate-300' },
  { name: 'Exhaustion',     color: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { name: 'Frightened',     color: 'bg-yellow-500/20 border-yellow-500/40 text-yellow-300' },
  { name: 'Grappled',       color: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  { name: 'Incapacitated',  color: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { name: 'Invisible',      color: 'bg-violet-500/20 border-violet-500/40 text-violet-300' },
  { name: 'Paralyzed',      color: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { name: 'Petrified',      color: 'bg-stone-500/20 border-stone-500/40 text-stone-300' },
  { name: 'Poisoned',       color: 'bg-green-500/20 border-green-500/40 text-green-300' },
  { name: 'Prone',          color: 'bg-amber-500/20 border-amber-500/40 text-amber-300' },
  { name: 'Restrained',     color: 'bg-orange-500/20 border-orange-500/40 text-orange-300' },
  { name: 'Stunned',        color: 'bg-red-500/20 border-red-500/40 text-red-300' },
  { name: 'Unconscious',    color: 'bg-gray-500/20 border-gray-500/40 text-gray-400' },
  { name: 'Concentration',  color: 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' },
];

function InitiativeTracker() {
  const [combatants, setCombatants] = usePersisted('initiative_combatants', []);
  const [currentTurn, setCurrentTurn] = usePersisted('initiative_turn', 0);
  const [round, setRound]             = usePersisted('initiative_round', 1);
  const [started, setStarted]         = usePersisted('initiative_started', false);

  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newHp, setNewHp]     = useState('');
  const [newAc, setNewAc]     = useState('');
  const [dmgInputs, setDmgInputs] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative || a.name.localeCompare(b.name));

  const add = () => {
    const name = newName.trim() || 'Combatant';
    const init = parseInt(newInit) || Math.floor(Math.random() * 20) + 1;
    const hp   = Math.max(1, parseInt(newHp) || 10);
    const ac   = parseInt(newAc) || null;
    setCombatants(prev => [...prev, {
      id: Date.now(),
      name, initiative: init, maxHp: hp, currentHp: hp, ac,
      conditions: [], deathSaves: { success: 0, fail: 0 }, isPlayer: false,
    }]);
    setNewName(''); setNewInit(''); setNewHp(''); setNewAc('');
  };

  const update = (id, patch) => setCombatants(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c));
  const remove = (id) => {
    setCombatants(prev => {
      const newList = prev.filter(c => c.id !== id);
      return newList;
    });
  };

  const nextTurn = () => {
    const next = (currentTurn + 1) % sorted.length;
    if (next === 0) setRound(r => r + 1);
    setCurrentTurn(next);
  };

  const prevTurn = () => {
    const prev = (currentTurn - 1 + sorted.length) % sorted.length;
    if (currentTurn === 0 && round > 1) setRound(r => r - 1);
    setCurrentTurn(prev);
  };

  const applyDamage = (id, amount, heal = false) => {
    update(id, (c => {
      const delta = heal ? amount : -amount;
      const newHp = Math.min(c.maxHp, Math.max(0, c.currentHp + delta));
      return { currentHp: newHp };
    })(combatants.find(c => c.id === id)));
    setDmgInputs(prev => ({ ...prev, [id]: '' }));
  };

  const toggleCondition = (id, cond) => {
    setCombatants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const has = c.conditions.includes(cond);
      return { ...c, conditions: has ? c.conditions.filter(x => x !== cond) : [...c.conditions, cond] };
    }));
  };

  const toggleDeathSave = (id, type) => {
    setCombatants(prev => prev.map(c => {
      if (c.id !== id) return c;
      const saves = { ...c.deathSaves };
      saves[type] = saves[type] >= 3 ? 0 : saves[type] + 1;
      return { ...c, deathSaves: saves };
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
            className="w-16 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={newHp}
            onChange={e => setNewHp(e.target.value)}
            placeholder="HP"
            type="number"
            className="w-16 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
          <input
            value={newAc}
            onChange={e => setNewAc(e.target.value)}
            placeholder="AC"
            type="number"
            className="w-16 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
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
        <div className="flex items-center gap-2 flex-wrap">
          {!started ? (
            <button
              onClick={() => { setStarted(true); setCurrentTurn(0); setRound(1); }}
              className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-green-600 text-white hover:bg-green-500 transition-colors"
            >
              <Play size={14} /> Start Combat
            </button>
          ) : (
            <>
              <div className="flex items-center gap-1.5 bg-secondary border border-border rounded-md px-3 h-9">
                <span className="text-xs text-muted-foreground">Round</span>
                <span className="text-sm font-bold text-foreground">{round}</span>
              </div>
              <div className="text-xs text-muted-foreground bg-secondary border border-border rounded-md px-3 h-9 flex items-center">
                {sorted[currentTurn]?.name ?? '—'}&apos;s turn
              </div>
              <button
                onClick={prevTurn}
                className="flex items-center gap-1.5 h-9 px-3 rounded-md text-sm font-medium bg-secondary border border-border text-muted-foreground hover:text-foreground transition-colors"
                title="Previous turn"
              >
                ←
              </button>
              <button
                onClick={nextTurn}
                className="flex items-center gap-2 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
              >
                Next Turn <SkipForward size={13} />
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
          const hpColor = hpPct > 50 ? 'bg-green-500' : hpPct > 25 ? 'bg-yellow-500' : hpPct > 0 ? 'bg-red-500' : 'bg-gray-600';
          const isDead  = c.currentHp === 0;
          const expanded = expandedId === c.id;
          const dmgVal = dmgInputs[c.id] || '';

          return (
            <div
              key={c.id}
              className={`rounded-xl border flex flex-col transition-colors ${
                isActive ? 'border-violet-500/60 bg-violet-500/5' : isDead ? 'border-red-900/40 bg-red-950/20 opacity-70' : 'border-border bg-card'
              }`}
            >
              {/* Main row */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  isActive ? 'bg-violet-600 text-white' : 'bg-secondary text-muted-foreground'
                }`}>
                  {c.initiative}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold text-sm truncate ${isDead ? 'line-through text-muted-foreground' : ''}`}>{c.name}</span>
                    {c.ac && (
                      <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60 shrink-0">
                        <Shield size={9} /> {c.ac}
                      </span>
                    )}
                    {isActive && <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider shrink-0">Active</span>}
                  </div>
                  {c.conditions.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {c.conditions.map(cond => {
                        const meta = CONDITIONS.find(x => x.name === cond);
                        return (
                          <span key={cond} className={`text-[9px] px-1.5 py-0.5 rounded-full border ${meta?.color ?? 'border-border text-muted-foreground'}`}>
                            {cond}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* HP display + quick controls */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => update(c.id, { currentHp: Math.max(0, c.currentHp - 1) })}
                    className="w-6 h-6 rounded bg-secondary border border-border text-xs hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
                  >−</button>
                  <span className="text-sm font-mono w-16 text-center tabular-nums">{c.currentHp}/{c.maxHp}</span>
                  <button
                    onClick={() => update(c.id, { currentHp: Math.min(c.maxHp, c.currentHp + 1) })}
                    className="w-6 h-6 rounded bg-secondary border border-border text-xs hover:bg-green-500/20 hover:border-green-500/40 transition-colors"
                  >+</button>
                </div>

                <button
                  onClick={() => setExpandedId(expanded ? null : c.id)}
                  className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                <button onClick={() => remove(c.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0">
                  <X size={14} />
                </button>
              </div>

              {/* HP bar */}
              <div className="mx-4 mb-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-300 ${hpColor}`} style={{ width: `${hpPct}%` }} />
              </div>

              {/* Expanded section */}
              {expanded && (
                <div className="px-4 pb-4 flex flex-col gap-3 border-t border-border/40 pt-3">
                  {/* Damage / Heal input */}
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="0"
                      value={dmgVal}
                      onChange={e => setDmgInputs(prev => ({ ...prev, [c.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && dmgVal) applyDamage(c.id, parseInt(dmgVal)); }}
                      placeholder="Amount"
                      className="w-24 bg-secondary border border-border rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
                    />
                    <button
                      onClick={() => dmgVal && applyDamage(c.id, parseInt(dmgVal))}
                      className="flex-1 h-8 rounded-md text-xs font-semibold bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 transition-colors"
                    >
                      <Heart size={11} className="inline mr-1" /> Damage
                    </button>
                    <button
                      onClick={() => dmgVal && applyDamage(c.id, parseInt(dmgVal), true)}
                      className="flex-1 h-8 rounded-md text-xs font-semibold bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 transition-colors"
                    >
                      <Zap size={11} className="inline mr-1" /> Heal
                    </button>
                    <button
                      onClick={() => update(c.id, { currentHp: c.maxHp })}
                      className="h-8 px-2 rounded-md text-xs text-muted-foreground border border-border hover:text-foreground transition-colors"
                      title="Full heal"
                    >
                      Full
                    </button>
                  </div>

                  {/* Death saves (shown when at 0 HP) */}
                  {isDead && (
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-muted-foreground w-20 shrink-0">Death Saves</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-green-400 mr-1">Success</span>
                        {[0, 1, 2].map(i => (
                          <button
                            key={i}
                            onClick={() => toggleDeathSave(c.id, 'success')}
                            className={`w-5 h-5 rounded-full border transition-colors ${i < c.deathSaves.success ? 'bg-green-500 border-green-500' : 'border-border'}`}
                          />
                        ))}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-red-400 mr-1">Fail</span>
                        {[0, 1, 2].map(i => (
                          <button
                            key={i}
                            onClick={() => toggleDeathSave(c.id, 'fail')}
                            className={`w-5 h-5 rounded-full border transition-colors ${i < c.deathSaves.fail ? 'bg-red-500 border-red-500' : 'border-border'}`}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Conditions */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1.5">Conditions</p>
                    <div className="flex flex-wrap gap-1">
                      {CONDITIONS.map(({ name, color }) => {
                        const active = c.conditions.includes(name);
                        return (
                          <button
                            key={name}
                            onClick={() => toggleCondition(c.id, name)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              active ? color : 'border-border text-muted-foreground/50 hover:text-muted-foreground hover:border-border/80'
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {combatants.length === 0 && (
          <div className="text-center py-10 text-muted-foreground/50 text-sm border border-dashed border-border rounded-xl">
            Add combatants above to begin tracking.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Encounter Table Roller ───────────────────────────────────────────────────

const DEFAULT_TABLES = [
  {
    id: 'default-1',
    name: 'Forest Encounters',
    die: 8,
    entries: [
      { id: 'e1', range: '1', result: 'A pack of wolves (2d4)' },
      { id: 'e2', range: '2', result: 'Goblin scouts (1d6+2)' },
      { id: 'e3', range: '3', result: 'Abandoned campsite with supplies' },
      { id: 'e4', range: '4', result: 'A friendly ranger who offers directions' },
      { id: 'e5', range: '5', result: 'Giant spider ambush (1d4)' },
      { id: 'e6', range: '6', result: 'A wounded deer — investigate?' },
      { id: 'e7', range: '7', result: 'Bandit ambush (1d8+4)' },
      { id: 'e8', range: '8', result: 'Ancient stone ruins, possibly inhabited' },
    ],
  },
  {
    id: 'default-2',
    name: 'City Streets',
    die: 6,
    entries: [
      { id: 'c1', range: '1', result: 'Pickpocket attempts on the party' },
      { id: 'c2', range: '2', result: 'Town crier announces a bounty' },
      { id: 'c3', range: '3', result: "Street brawl spills into the party's path" },
      { id: 'c4', range: '4', result: 'Merchant offers rare goods at a premium' },
      { id: 'c5', range: '5', result: "City guards question the party's business" },
      { id: 'c6', range: '6', result: 'Festival or market creates a crowd' },
    ],
  },
];

const DIE_OPTIONS = [4, 6, 8, 10, 12, 20, 100];

function EncounterRoller() {
  const [tables, setTables]         = usePersisted('encounter_tables', DEFAULT_TABLES);
  const [activeTable, setActiveTable] = usePersisted('encounter_active', 0);
  const [lastRoll, setLastRoll]     = useState(null);
  const [newEntry, setNewEntry]     = useState('');
  const [editingName, setEditingName] = useState(false);
  const nameRef = useRef(null);

  const table = tables[activeTable] ?? tables[0];

  useEffect(() => {
    if (editingName && nameRef.current) nameRef.current.focus();
  }, [editingName]);

  const rollTable = () => {
    if (!table?.entries.length) return;
    const roll = Math.floor(Math.random() * table.die) + 1;
    const entry = table.entries.find(e => {
      const parts = e.range.split('-').map(Number);
      if (parts.length === 2) return roll >= parts[0] && roll <= parts[1];
      return Number(e.range) === roll;
    }) ?? table.entries[Math.floor(Math.random() * table.entries.length)];
    setLastRoll({ roll, result: entry?.result ?? 'Nothing found.' });
  };

  const addEntry = () => {
    if (!newEntry.trim()) return;
    setTables(prev => prev.map((t, i) => {
      if (i !== activeTable) return t;
      const nextRange = String(t.entries.length + 1);
      return { ...t, entries: [...t.entries, { id: String(Date.now()), range: nextRange, result: newEntry.trim() }] };
    }));
    setNewEntry('');
  };

  const removeEntry = (entryId) => {
    setTables(prev => prev.map((t, i) => i !== activeTable ? t : { ...t, entries: t.entries.filter(e => e.id !== entryId) }));
    setLastRoll(null);
  };

  const updateTableName = (name) => {
    setTables(prev => prev.map((t, i) => i === activeTable ? { ...t, name } : t));
  };

  const updateTableDie = (die) => {
    setTables(prev => prev.map((t, i) => i === activeTable ? { ...t, die: Number(die) } : t));
    setLastRoll(null);
  };

  const addTable = () => {
    const t = { id: String(Date.now()), name: `Table ${tables.length + 1}`, die: 6, entries: [] };
    setTables(prev => [...prev, t]);
    setActiveTable(tables.length);
    setLastRoll(null);
  };

  const deleteTable = () => {
    if (tables.length <= 1) return;
    setTables(prev => prev.filter((_, i) => i !== activeTable));
    setActiveTable(Math.max(0, activeTable - 1));
    setLastRoll(null);
  };

  const updateEntryRange = (entryId, range) => {
    setTables(prev => prev.map((t, i) => i !== activeTable ? t : {
      ...t,
      entries: t.entries.map(e => e.id === entryId ? { ...e, range } : e),
    }));
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      {/* Table tabs */}
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
          {/* Table header + roll */}
          <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {editingName ? (
                  <input
                    ref={nameRef}
                    value={table.name}
                    onChange={e => updateTableName(e.target.value)}
                    onBlur={() => setEditingName(false)}
                    onKeyDown={e => e.key === 'Enter' && setEditingName(false)}
                    className="text-base font-semibold bg-transparent text-foreground focus:outline-none border-b border-violet-500 w-full"
                  />
                ) : (
                  <button
                    onClick={() => setEditingName(true)}
                    className="text-base font-semibold text-foreground hover:text-violet-400 transition-colors text-left"
                  >
                    {table.name}
                  </button>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-xs text-muted-foreground">{table.entries.length} entries</p>
                  <span className="text-muted-foreground/30">·</span>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Roll</span>
                    <select
                      value={table.die}
                      onChange={e => updateTableDie(e.target.value)}
                      className="bg-secondary border border-border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                    >
                      {DIE_OPTIONS.map(d => <option key={d} value={d}>d{d}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {tables.length > 1 && (
                  <button onClick={deleteTable} className="text-muted-foreground/50 hover:text-red-400 transition-colors" title="Delete table">
                    <Trash2 size={14} />
                  </button>
                )}
                <button
                  onClick={rollTable}
                  disabled={!table.entries.length}
                  className="flex items-center gap-2 h-9 px-5 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors disabled:opacity-40"
                >
                  <Dice5 size={15} /> Roll d{table.die}
                </button>
              </div>
            </div>

            {lastRoll && (
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-4 py-3 flex items-start gap-3">
                <span className="text-2xl font-black text-violet-300 tabular-nums shrink-0 leading-tight">{lastRoll.roll}</span>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">d{table.die} result</p>
                  <p className="text-sm font-medium text-foreground">{lastRoll.result}</p>
                </div>
              </div>
            )}
          </div>

          {/* Entries */}
          <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Table Entries</h3>
            {table.entries.length === 0 ? (
              <p className="text-sm text-muted-foreground/40 italic text-center py-4">No entries yet — add some below.</p>
            ) : (
              <div className="flex flex-col gap-0.5">
                {table.entries.map(entry => (
                  <div key={entry.id} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0 group">
                    <input
                      value={entry.range}
                      onChange={e => updateEntryRange(entry.id, e.target.value)}
                      className="text-xs font-mono text-muted-foreground w-10 shrink-0 bg-transparent focus:outline-none focus:text-foreground border-b border-transparent focus:border-violet-500"
                    />
                    <span className="text-sm flex-1">{entry.result}</span>
                    <button
                      onClick={() => removeEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all shrink-0"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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

const CLASS_PRESETS = {
  'Wizard / Sorcerer / Bard':  [4, 3, 3, 3, 3, 2, 2, 1, 1],
  'Cleric / Druid':            [4, 3, 3, 3, 3, 2, 2, 1, 1],
  'Paladin / Ranger':          [4, 3, 3, 3, 2, 0, 0, 0, 0],
  'Fighter (Eldritch Knight)': [4, 3, 3, 0, 0, 0, 0, 0, 0],
  'Warlock (Pact Magic)':      [0, 0, 0, 4, 0, 0, 0, 0, 0],
  'Custom':                    [0, 0, 0, 0, 0, 0, 0, 0, 0],
};

const WARLOCK_LEVELS = {
  1: [1, 0, 0, 0, 0, 0, 0, 0, 0],
  2: [2, 0, 0, 0, 0, 0, 0, 0, 0],
  3: [0, 2, 0, 0, 0, 0, 0, 0, 0],
  4: [0, 2, 0, 0, 0, 0, 0, 0, 0],
  5: [0, 0, 2, 0, 0, 0, 0, 0, 0],
  6: [0, 0, 2, 0, 0, 0, 0, 0, 0],
  7: [0, 0, 0, 2, 0, 0, 0, 0, 0],
  8: [0, 0, 0, 2, 0, 0, 0, 0, 0],
  9: [0, 0, 0, 0, 2, 0, 0, 0, 0],
  10: [0, 0, 0, 0, 2, 0, 0, 0, 0],
  11: [0, 0, 0, 0, 3, 0, 0, 0, 0],
  20: [0, 0, 0, 4, 0, 0, 0, 0, 0],
};

function buildSlots(preset) {
  return preset.map((max, i) => ({ level: i + 1, max, used: 0 })).filter(s => s.max > 0);
}

function SpellSlotTracker() {
  const [characters, setCharacters] = usePersisted('spells_characters', []);
  const [newName, setNewName]       = useState('');
  const [newClass, setNewClass]     = useState('Wizard / Sorcerer / Bard');
  const [editingSlots, setEditingSlots] = useState(null); // charId

  const addCharacter = () => {
    const name = newName.trim() || 'Character';
    const slots = buildSlots(CLASS_PRESETS[newClass] || CLASS_PRESETS['Custom']);
    setCharacters(prev => [...prev, { id: Date.now(), name, class: newClass, slots }]);
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

  const updateSlotMax = (charId, level, newMax) => {
    setCharacters(prev => prev.map(c => {
      if (c.id !== charId) return c;
      const max = Math.max(0, newMax);
      let slots = c.slots.map(s => s.level === level ? { ...s, max, used: Math.min(s.used, max) } : s);
      if (max > 0 && !slots.find(s => s.level === level)) {
        slots = [...slots, { level, max, used: 0 }].sort((a, b) => a.level - b.level);
      } else if (max === 0) {
        slots = slots.filter(s => s.level !== level);
      }
      return { ...c, slots };
    }));
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
            {Object.keys(CLASS_PRESETS).map(c => <option key={c}>{c}</option>)}
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
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-semibold text-foreground">{char.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{char.class}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => setEditingSlots(editingSlots === char.id ? null : char.id)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium border transition-colors ${
                  editingSlots === char.id ? 'bg-violet-500/15 border-violet-500/40 text-violet-400' : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                Edit Slots
              </button>
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

          {char.slots.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 italic">No spell slots — use Edit Slots to add some.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {char.slots.map(slot => {
                const remaining = slot.max - slot.used;
                const pct = slot.max ? remaining / slot.max : 0;
                return (
                  <div key={slot.level} className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-14 shrink-0">Level {slot.level}</span>
                    <div className="flex gap-1.5 flex-1 flex-wrap">
                      {Array.from({ length: slot.max }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => i < remaining ? useSlot(char.id, slot.level) : restoreSlot(char.id, slot.level)}
                          className={`w-7 h-7 rounded-md border transition-all ${
                            i < remaining
                              ? 'bg-violet-500/30 border-violet-500/50 hover:bg-red-500/20 hover:border-red-500/40'
                              : 'bg-secondary/30 border-border/40 opacity-40 hover:bg-green-500/20 hover:border-green-500/40 hover:opacity-80'
                          }`}
                          title={i < remaining ? `Use level ${slot.level} slot` : `Restore level ${slot.level} slot`}
                        />
                      ))}
                    </div>
                    <span className={`text-xs font-mono w-10 text-right tabular-nums ${pct === 0 ? 'text-muted-foreground/40' : pct < 0.34 ? 'text-red-400' : 'text-muted-foreground'}`}>
                      {remaining}/{slot.max}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Edit slots panel */}
          {editingSlots === char.id && (
            <div className="rounded-lg border border-border bg-secondary/20 p-3 flex flex-col gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-1">Max Slots per Level</p>
              <div className="grid grid-cols-3 gap-2">
                {[1,2,3,4,5,6,7,8,9].map(lvl => {
                  const existing = char.slots.find(s => s.level === lvl);
                  return (
                    <div key={lvl} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-12 shrink-0">Lvl {lvl}</span>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={existing?.max ?? 0}
                        onChange={e => updateSlotMax(char.id, lvl, parseInt(e.target.value) || 0)}
                        className="w-full bg-secondary border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-violet-500"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}

      {characters.length === 0 && (
        <div className="text-center py-12 text-muted-foreground/50 text-sm border border-dashed border-border rounded-xl">
          Add a character above to start tracking spell slots.
        </div>
      )}
    </div>
  );
}

// ─── Condition Reference ──────────────────────────────────────────────────────

const CONDITION_REFERENCE = [
  {
    name: 'Blinded',
    color: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    effects: [
      'A blinded creature can\'t see and automatically fails any ability check that requires sight.',
      'Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
    ],
  },
  {
    name: 'Charmed',
    color: 'border-pink-500/40 bg-pink-500/10 text-pink-300',
    effects: [
      'A charmed creature can\'t attack the charmer or target the charmer with harmful abilities or magical effects.',
      'The charmer has advantage on any ability check to interact socially with the creature.',
    ],
  },
  {
    name: 'Deafened',
    color: 'border-slate-500/40 bg-slate-500/10 text-slate-300',
    effects: [
      'A deafened creature can\'t hear and automatically fails any ability check that requires hearing.',
    ],
  },
  {
    name: 'Exhaustion',
    color: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    effects: [
      'Level 1: Disadvantage on ability checks.',
      'Level 2: Speed halved.',
      'Level 3: Disadvantage on attack rolls and saving throws.',
      'Level 4: Hit point maximum halved.',
      'Level 5: Speed reduced to 0.',
      'Level 6: Death.',
    ],
    note: 'Finishing a long rest reduces exhaustion level by 1.',
  },
  {
    name: 'Frightened',
    color: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300',
    effects: [
      'A frightened creature has disadvantage on ability checks and attack rolls while the source of its fear is within line of sight.',
      'The creature can\'t willingly move closer to the source of its fear.',
    ],
  },
  {
    name: 'Grappled',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    effects: [
      'A grappled creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed.',
      'The condition ends if the grappler is incapacitated.',
      'The condition also ends if an effect removes the grappled creature from the reach of the grappler or grappling effect.',
    ],
  },
  {
    name: 'Incapacitated',
    color: 'border-red-500/40 bg-red-500/10 text-red-300',
    effects: [
      'An incapacitated creature can\'t take actions or reactions.',
    ],
  },
  {
    name: 'Invisible',
    color: 'border-violet-500/40 bg-violet-500/10 text-violet-300',
    effects: [
      'An invisible creature is impossible to see without the aid of magic or a special sense.',
      'The creature\'s location can be detected by any noise it makes or any tracks it leaves.',
      'Attack rolls against the creature have disadvantage, and the creature\'s attack rolls have advantage.',
    ],
  },
  {
    name: 'Paralyzed',
    color: 'border-red-500/40 bg-red-500/10 text-red-300',
    effects: [
      'A paralyzed creature is incapacitated and can\'t move or speak.',
      'The creature automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against the creature have advantage.',
      'Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.',
    ],
  },
  {
    name: 'Petrified',
    color: 'border-stone-500/40 bg-stone-500/10 text-stone-300',
    effects: [
      'A petrified creature is transformed, along with any nonmagical object it is wearing or carrying, into a solid inanimate substance (usually stone).',
      'Its weight increases by a factor of ten, and it ceases aging.',
      'The creature is incapacitated, can\'t move or speak, and is unaware of its surroundings.',
      'Attack rolls against the creature have advantage.',
      'The creature automatically fails Strength and Dexterity saving throws.',
      'The creature has resistance to all damage.',
      'The creature is immune to poison and disease, although a poison or disease already in its system is suspended, not neutralized.',
    ],
  },
  {
    name: 'Poisoned',
    color: 'border-green-500/40 bg-green-500/10 text-green-300',
    effects: [
      'A poisoned creature has disadvantage on attack rolls and ability checks.',
    ],
  },
  {
    name: 'Prone',
    color: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
    effects: [
      'A prone creature\'s only movement option is to crawl, unless it stands up (costing half movement speed).',
      'The creature has disadvantage on attack rolls.',
      'An attack roll against the creature has advantage if the attacker is within 5 feet of the creature. Otherwise, the attack roll has disadvantage.',
    ],
  },
  {
    name: 'Restrained',
    color: 'border-orange-500/40 bg-orange-500/10 text-orange-300',
    effects: [
      'A restrained creature\'s speed becomes 0, and it can\'t benefit from any bonus to its speed.',
      'Attack rolls against the creature have advantage, and the creature\'s attack rolls have disadvantage.',
      'The creature has disadvantage on Dexterity saving throws.',
    ],
  },
  {
    name: 'Stunned',
    color: 'border-red-500/40 bg-red-500/10 text-red-300',
    effects: [
      'A stunned creature is incapacitated, can\'t move, and can speak only falteringly.',
      'The creature automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against the creature have advantage.',
    ],
  },
  {
    name: 'Unconscious',
    color: 'border-gray-500/40 bg-gray-500/10 text-gray-400',
    effects: [
      'An unconscious creature is incapacitated, can\'t move or speak, and is unaware of its surroundings.',
      'The creature drops whatever it\'s holding and falls prone.',
      'The creature automatically fails Strength and Dexterity saving throws.',
      'Attack rolls against the creature have advantage.',
      'Any attack that hits the creature is a critical hit if the attacker is within 5 feet of the creature.',
    ],
  },
];

function ConditionReference() {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  const filtered = CONDITION_REFERENCE.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search conditions…"
        className="w-full bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
      />

      <div className="flex flex-col gap-2">
        {filtered.map(cond => (
          <div key={cond.name} className={`rounded-xl border overflow-hidden ${cond.color}`}>
            <button
              onClick={() => setExpanded(e => e === cond.name ? null : cond.name)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <span className="font-semibold text-sm">{cond.name}</span>
              {expanded === cond.name ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {expanded === cond.name && (
              <div className="px-4 pb-4 border-t border-current/20 pt-3 flex flex-col gap-1.5">
                {cond.effects.map((e, i) => (
                  <p key={i} className="text-xs leading-relaxed opacity-90">• {e}</p>
                ))}
                {cond.note && (
                  <p className="text-xs italic opacity-70 mt-1">{cond.note}</p>
                )}
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted-foreground/50 py-8">No conditions match "{search}"</p>
        )}
      </div>
    </div>
  );
}

// ─── Loot Generator ───────────────────────────────────────────────────────────

const CURRENCY_BY_CR = [
  { cr: '0–4',   cp: [1,6], sp: [0,3], gp: [0,2], pp: 0 },
  { cr: '5–10',  cp: [0,0], sp: [2,8], gp: [2,8], pp: [0,1] },
  { cr: '11–16', cp: [0,0], sp: [0,0], gp: [4,16],pp: [1,4] },
  { cr: '17+',   cp: [0,0], sp: [0,0], gp: [8,32],pp: [3,12] },
];

const ITEM_TABLES = {
  mundane: [
    'Rope (50 ft)', 'Torches (10)', 'Rations (5 days)', 'Tinderbox', 'Lantern',
    'Flask of oil', 'Healer\'s kit', 'Crowbar', 'Grappling hook', 'Manacles',
  ],
  minor: [
    'Potion of Healing', 'Potion of Climbing', 'Scroll of Detect Magic',
    'Scroll of Identify', '+1 Ammunition (10)', 'Potion of Water Breathing',
    'Scroll of Silence', 'Bag of Holding', 'Sending Stones (pair)', 'Immovable Rod',
  ],
  major: [
    '+1 Weapon', '+1 Shield', 'Cloak of Protection', 'Boots of Elvenkind',
    'Gauntlets of Ogre Power', 'Ring of Protection', 'Necklace of Fireballs',
    '+2 Weapon', 'Staff of the Adder', 'Winged Boots',
  ],
  rare: [
    '+3 Weapon', 'Robe of the Archmagi', 'Ring of Regeneration',
    'Cloak of Invisibility', 'Manual of Bodily Health', 'Deck of Many Things',
    'Staff of Power', 'Vorpal Sword', 'Sphere of Annihilation', 'Cubic Gate',
  ],
};

const GEMSTONE_TABLE = [
  { name: 'Obsidian', value: 10 }, { name: 'Azurite', value: 10 }, { name: 'Malachite', value: 10 },
  { name: 'Quartz', value: 50 }, { name: 'Carnelian', value: 50 }, { name: 'Bloodstone', value: 50 },
  { name: 'Amber', value: 100 }, { name: 'Jade', value: 100 }, { name: 'Coral', value: 100 },
  { name: 'Garnet', value: 500 }, { name: 'Spinel', value: 500 }, { name: 'Tourmaline', value: 500 },
  { name: 'Aquamarine', value: 1000 }, { name: 'Pearl', value: 1000 }, { name: 'Topaz', value: 1000 },
  { name: 'Emerald', value: 5000 }, { name: 'Sapphire', value: 5000 }, { name: 'Diamond', value: 5000 },
  { name: 'Jacinth', value: 5000 }, { name: 'Ruby', value: 5000 },
];

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateLoot(cr, includeItems, gemCount) {
  const currRow = cr <= 4 ? CURRENCY_BY_CR[0] : cr <= 10 ? CURRENCY_BY_CR[1] : cr <= 16 ? CURRENCY_BY_CR[2] : CURRENCY_BY_CR[3];
  const currency = {};
  if (currRow.cp[1] > 0) currency.cp = rand(...currRow.cp) * 100;
  if (currRow.sp[1] > 0) currency.sp = rand(...currRow.sp) * 100;
  if (currRow.gp[1] > 0) currency.gp = rand(...currRow.gp) * (cr > 10 ? 10 : 1);
  if (currRow.pp && currRow.pp[1] > 0) currency.pp = rand(...currRow.pp) * 10;

  const gems = gemCount > 0
    ? Array.from({ length: gemCount }, () => pickRandom(GEMSTONE_TABLE))
    : [];

  const items = [];
  if (includeItems) {
    const itemCount = cr <= 4 ? 1 : cr <= 10 ? 2 : cr <= 16 ? 3 : 4;
    for (let i = 0; i < itemCount; i++) {
      const roll = rand(1, 100);
      const table = roll <= 50 ? 'mundane' : roll <= 75 ? 'minor' : roll <= 90 ? 'major' : 'rare';
      items.push({ name: pickRandom(ITEM_TABLES[table]), rarity: table });
    }
  }

  return { currency, gems, items, cr, ts: Date.now() };
}

const RARITY_COLORS = {
  mundane: 'text-muted-foreground',
  minor:   'text-green-400',
  major:   'text-blue-400',
  rare:    'text-purple-400',
};

function LootGenerator() {
  const [cr, setCr]                   = usePersisted('loot_cr', 5);
  const [includeItems, setIncludeItems] = usePersisted('loot_items', true);
  const [gemCount, setGemCount]       = usePersisted('loot_gems', 1);
  const [result, setResult]           = useState(null);
  const [history, setHistory]         = usePersisted('loot_history', []);

  const generate = () => {
    const loot = generateLoot(cr, includeItems, gemCount);
    setResult(loot);
    setHistory(h => [loot, ...h].slice(0, 10));
  };

  const currencyLabels = { pp: 'Platinum', gp: 'Gold', sp: 'Silver', cp: 'Copper' };
  const currencyColors = { pp: 'text-slate-300', gp: 'text-yellow-400', sp: 'text-gray-300', cp: 'text-orange-400' };

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Config */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Generator Settings</h3>

        <div className="flex gap-4 flex-wrap items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Challenge Rating</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="30"
                value={cr}
                onChange={e => setCr(Number(e.target.value))}
                className="w-32 accent-violet-500"
              />
              <span className="text-sm font-bold text-foreground w-6 text-center">{cr}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Gemstones</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setGemCount(g => Math.max(0, g - 1))} className="w-7 h-7 rounded bg-secondary border border-border text-sm hover:bg-secondary/80">−</button>
              <span className="w-8 text-center text-sm font-mono">{gemCount}</span>
              <button onClick={() => setGemCount(g => Math.min(10, g + 1))} className="w-7 h-7 rounded bg-secondary border border-border text-sm hover:bg-secondary/80">+</button>
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeItems}
              onChange={e => setIncludeItems(e.target.checked)}
              className="accent-violet-500 w-4 h-4"
            />
            <span className="text-sm text-muted-foreground">Include magic items</span>
          </label>
        </div>

        <button
          onClick={generate}
          className="flex items-center justify-center gap-2 h-10 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors"
        >
          <Gem size={15} /> Generate Loot
        </button>
      </div>

      {/* Result */}
      {result && (
        <div className="rounded-xl border border-violet-500/30 bg-violet-500/5 p-5 flex flex-col gap-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">CR {result.cr} Hoard</p>

          {/* Currency */}
          {Object.keys(result.currency).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Currency</p>
              <div className="flex flex-wrap gap-3">
                {['pp','gp','sp','cp'].filter(k => result.currency[k] > 0).map(k => (
                  <div key={k} className="flex flex-col items-center gap-0.5">
                    <span className={`text-xl font-black tabular-nums ${currencyColors[k]}`}>{result.currency[k].toLocaleString()}</span>
                    <span className="text-[10px] text-muted-foreground/60">{currencyLabels[k]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Gemstones */}
          {result.gems.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Gemstones</p>
              <div className="flex flex-wrap gap-2">
                {result.gems.map((gem, i) => (
                  <span key={i} className="flex items-center gap-1.5 text-xs bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 px-2.5 py-1 rounded-full">
                    <Gem size={10} /> {gem.name} ({gem.value.toLocaleString()} gp)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Items */}
          {result.items.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2">Magic Items</p>
              <div className="flex flex-col gap-1.5">
                {result.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className={`text-[9px] uppercase tracking-wider font-semibold w-12 shrink-0 ${RARITY_COLORS[item.rarity]}`}>{item.rarity}</span>
                    <span className="text-sm text-foreground">{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History */}
      {history.length > 1 && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Hoards</h3>
            <button onClick={() => setHistory([])} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Clear</button>
          </div>
          <div className="flex flex-col gap-1">
            {history.slice(1).map((h, i) => (
              <div key={h.ts} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                <span className="text-muted-foreground">CR {h.cr}</span>
                <span className="text-foreground font-mono">
                  {['pp','gp','sp','cp'].filter(k => h.currency[k]).map(k => `${h.currency[k]}${k}`).join(' ')}
                  {h.gems.length > 0 ? ` · ${h.gems.length} gem${h.gems.length > 1 ? 's' : ''}` : ''}
                  {h.items.length > 0 ? ` · ${h.items.length} item${h.items.length > 1 ? 's' : ''}` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Name Generator ───────────────────────────────────────────────────────────

const NAME_TABLES = {
  Human: {
    male:   ['Aldric', 'Bram', 'Caius', 'Dorian', 'Edric', 'Faris', 'Gareth', 'Hadwin', 'Isidor', 'Jorel', 'Kael', 'Leoric', 'Merric', 'Nolan', 'Oswin', 'Percival', 'Quinn', 'Roth', 'Soren', 'Theron', 'Ulric', 'Vander', 'Weston', 'Xander', 'Yorath', 'Zane'],
    female: ['Aelith', 'Brynn', 'Caris', 'Dara', 'Elara', 'Faye', 'Gwen', 'Hilde', 'Isara', 'Jora', 'Kira', 'Lysa', 'Maren', 'Nessa', 'Orla', 'Perin', 'Quinn', 'Reva', 'Sera', 'Tyla', 'Ursa', 'Vela', 'Wren', 'Xena', 'Yara', 'Zara'],
    surname: ['Ashford', 'Blackwell', 'Coldwater', 'Duskmore', 'Emberly', 'Farrow', 'Greaves', 'Hartwick', 'Irondawn', 'Jericho', 'Keldane', 'Lorne', 'Mercer', 'Northgate', 'Orwyn', 'Pendray', 'Quickwood', 'Redfield', 'Stormgate', 'Thorn', 'Underhill', 'Varrow', 'Whitfield', 'Yarwick', 'Zeal'],
  },
  Elf: {
    male:   ['Aerin', 'Caelath', 'Daeris', 'Elarion', 'Faelen', 'Galos', 'Haeriel', 'Ilvaris', 'Jaeloth', 'Kaelis', 'Laerien', 'Maelon', 'Naeriel', 'Orindal', 'Paelon', 'Qaelin', 'Raelon', 'Saelar', 'Taelis', 'Ulaer', 'Vaelis', 'Waelin', 'Xaelos', 'Yaelis', 'Zaelos'],
    female: ['Aelith', 'Caelara', 'Daerin', 'Elaera', 'Faelara', 'Gaelith', 'Haelara', 'Ileara', 'Jaelith', 'Kaelara', 'Laelith', 'Maelara', 'Naelith', 'Oaelara', 'Paelith', 'Qaelara', 'Raelith', 'Saelara', 'Taelith', 'Uaelara', 'Vaelith', 'Waelara', 'Xaelith', 'Yaelara', 'Zaelith'],
    surname: ['Amakiir', 'Brightleaf', 'Caskur', 'Dawndancer', 'Eveningstar', 'Frostwhisper', 'Galanodel', 'Holimion', 'Ilphelkiir', 'Liadon', 'Meliamne', 'Naïlo', 'Nightbreeze', 'Siannodel', 'Silverhand', 'Starweaver', 'Sylvari', 'Thinveil', 'Xiloscent', 'Yeresunlea'],
  },
  Dwarf: {
    male:   ['Adrik', 'Baern', 'Brottor', 'Dain', 'Darrak', 'Delg', 'Eberk', 'Fargrim', 'Flint', 'Gardain', 'Harbek', 'Kildrak', 'Morgran', 'Orsik', 'Oskar', 'Rangrim', 'Rurik', 'Taklinn', 'Thoradin', 'Thorin', 'Tordek', 'Traubon', 'Travok', 'Ulfgar', 'Veit', 'Vondal'],
    female: ['Amber', 'Artin', 'Audhild', 'Bardryn', 'Dagnal', 'Diesa', 'Eldeth', 'Falkrunn', 'Finellen', 'Gunnloda', 'Gurdis', 'Helja', 'Hlin', 'Kathra', 'Kristryd', 'Ilde', 'Liftrasa', 'Mardred', 'Riswynn', 'Sannl', 'Torbera', 'Torgga', 'Vistra'],
    surname: ['Balderk', 'Battlehammer', 'Boulderfoot', 'Cragfire', 'Coalmantle', 'Copperkettle', 'Deepdelve', 'Fireforge', 'Frostbeard', 'Gorunn', 'Holderhek', 'Ironfist', 'Loderr', 'Lutgehr', 'Rumnaheim', 'Rumpadump', 'Stoneback', 'Strakeln', 'Thorbardin', 'Torunn'],
  },
  Halfling: {
    male:   ['Alton', 'Ander', 'Bernie', 'Bobbin', 'Cade', 'Callus', 'Corwin', 'Eldon', 'Errich', 'Finnan', 'Garret', 'Lyle', 'Merric', 'Milo', 'Osborn', 'Perrin', 'Reed', 'Roscoe', 'Wellby'],
    female: ['Andry', 'Bree', 'Callie', 'Cora', 'Euphemia', 'Jillian', 'Kithri', 'Lavinia', 'Lidda', 'Merla', 'Nedda', 'Paela', 'Portia', 'Seraphina', 'Shaena', 'Trym', 'Vani', 'Verna'],
    surname: ['Brushgather', 'Goodbarrel', 'Greenbottle', 'Highhill', 'Hilltopple', 'Leagallow', 'Millstone', 'Osterman', 'Proudfoot', 'Quickstep', 'Sandybanks', 'Stoutpot', 'Tealeaf', 'Thistlethatch', 'Underbough'],
  },
  Tiefling: {
    male:   ['Akmenos', 'Amnon', 'Barakas', 'Damakos', 'Ekemon', 'Iados', 'Kairon', 'Leucis', 'Melech', 'Mordai', 'Morthos', 'Pelaios', 'Skamos', 'Therai'],
    female: ['Akta', 'Anakis', 'Bryseis', 'Criella', 'Damaia', 'Ea', 'Kallista', 'Lerissa', 'Makaria', 'Nemeia', 'Orianna', 'Phelaia', 'Rieta'],
    virtue: ['Art', 'Carrion', 'Chant', 'Creed', 'Despair', 'Excellence', 'Fear', 'Glory', 'Hope', 'Ideal', 'Music', 'Nowhere', 'Open', 'Poetry', 'Quest', 'Random', 'Reverence', 'Sorrow', 'Temerity', 'Torment', 'Weary', 'Wisdom'],
  },
  Orc: {
    male:   ['Argh', 'Bograk', 'Crusk', 'Drogash', 'Ekroz', 'Frurk', 'Glurg', 'Hroth', 'Igrok', 'Jarog', 'Krom', 'Lurk', 'Morg', 'Narok', 'Orgash', 'Prask', 'Quorg', 'Rorg', 'Snorg', 'Tharg', 'Urg', 'Vroth', 'Wurgh', 'Xrog', 'Yorg', 'Zurg'],
    female: ['Arha', 'Borgath', 'Crisha', 'Draga', 'Ekra', 'Fruga', 'Golga', 'Hrutha', 'Igra', 'Jara', 'Krorga', 'Lurga', 'Morga', 'Narka', 'Orgasha', 'Praska', 'Rurka', 'Shurga', 'Thurga', 'Urga', 'Vratha', 'Wurga'],
    clan:   ['Bloodaxe', 'Bonecrusher', 'Darkstone', 'Deathbrand', 'Fireclash', 'Grimtusk', 'Ironhide', 'Jaws', 'Maulgrip', 'Nightclaw', 'Redtooth', 'Scarhand', 'Skullsplitter', 'Stonefist', 'Thunderstep', 'Warhorn'],
  },
  Dragonborn: {
    male:   ['Arjhan', 'Balasar', 'Bharash', 'Donaar', 'Ghesh', 'Heskan', 'Kriv', 'Medrash', 'Mehen', 'Nadarr', 'Pandjed', 'Patrin', 'Rhogar', 'Shamash', 'Shedinn', 'Tarhun', 'Torinn'],
    female: ['Akra', 'Biri', 'Daar', 'Farideh', 'Harann', 'Havilar', 'Jheri', 'Kava', 'Korinn', 'Mishann', 'Nala', 'Perra', 'Raiann', 'Sora', 'Surina', 'Thava', 'Uadjit'],
    clan:   ['Clethtinthiallor', 'Daardendrian', 'Delmirev', 'Drachedandion', 'Fenkenkabradon', 'Kepeshkmolik', 'Kerrhylon', 'Kimbatuul', 'Linxakasendalor', 'Myastan', 'Nemmonis', 'Norixius', 'Ophinshtalajiir', 'Prexijandilin', 'Shestendeliath', 'Turnuroth', 'Verthisathurgiesh', 'Yarjerit'],
  },
  Gnome: {
    male:   ['Alston', 'Alvyn', 'Brocc', 'Burgell', 'Dimble', 'Eldon', 'Erky', 'Fonkin', 'Frug', 'Gerbo', 'Gimble', 'Glim', 'Jebeddo', 'Kellen', 'Namfoodle', 'Orryn', 'Roondar', 'Seebo', 'Sindri', 'Warryn', 'Wrenn', 'Zook'],
    female: ['Bimpnottin', 'Breena', 'Caramip', 'Carlin', 'Donella', 'Duvamil', 'Ella', 'Ellyjobell', 'Ellywick', 'Lilli', 'Loopmottin', 'Lorilla', 'Mardnab', 'Nissa', 'Nyx', 'Oda', 'Orla', 'Roywyn', 'Shamil', 'Tana', 'Waywocket', 'Zanna'],
    clan:   ['Beren', 'Daergel', 'Folkor', 'Garrick', 'Nackle', 'Murnig', 'Ningel', 'Raulnor', 'Scheppen', 'Timbers', 'Turen'],
  },
};

function NameGenerator() {
  const [race, setRace]       = usePersisted('namegen_race', 'Human');
  const [gender, setGender]   = usePersisted('namegen_gender', 'male');
  const [count, setCount]     = usePersisted('namegen_count', 5);
  const [generated, setGenerated] = useState([]);
  const [pinned, setPinned]   = usePersisted('namegen_pinned', []);

  const races = Object.keys(NAME_TABLES);
  const table = NAME_TABLES[race];
  const firstNames = table[gender] || table.male;
  const surnameKey = table.virtue ? 'virtue' : table.clan ? 'clan' : 'surname';
  const surnames = table[surnameKey] || [];

  const generate = () => {
    const names = Array.from({ length: count }, () => {
      const first = pickRandom(firstNames);
      const last  = surnames.length ? pickRandom(surnames) : '';
      return last ? `${first} ${last}` : first;
    });
    setGenerated(names);
  };

  const pin = (name) => {
    if (!pinned.includes(name)) setPinned(prev => [...prev, name]);
  };

  const unpin = (name) => setPinned(prev => prev.filter(n => n !== name));

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      {/* Config */}
      <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Generator Settings</h3>

        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Race</label>
            <select
              value={race}
              onChange={e => setRace(e.target.value)}
              className="bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              {races.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Gender</label>
            <div className="flex rounded-md overflow-hidden border border-border">
              {['male','female'].map(g => (
                <button
                  key={g}
                  onClick={() => setGender(g)}
                  className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${gender === g ? 'bg-violet-600 text-white' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-muted-foreground">Count</label>
            <div className="flex items-center gap-1">
              <button onClick={() => setCount(c => Math.max(1, c - 1))} className="w-7 h-9 rounded-l bg-secondary border border-border text-sm hover:bg-secondary/80">−</button>
              <span className="w-8 h-9 flex items-center justify-center text-sm font-mono border-t border-b border-border bg-secondary">{count}</span>
              <button onClick={() => setCount(c => Math.min(20, c + 1))} className="w-7 h-9 rounded-r bg-secondary border border-border text-sm hover:bg-secondary/80">+</button>
            </div>
          </div>
        </div>

        <button
          onClick={generate}
          className="flex items-center justify-center gap-2 h-10 rounded-lg bg-violet-600 text-white font-semibold text-sm hover:bg-violet-500 transition-colors"
        >
          <User size={15} /> Generate Names
        </button>
      </div>

      {/* Results */}
      {generated.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{race} Names</h3>
            <button onClick={generate} className="text-xs text-muted-foreground/50 hover:text-violet-400 flex items-center gap-1 transition-colors">
              <RotateCcw size={11} /> Regenerate
            </button>
          </div>
          <div className="flex flex-col gap-1">
            {generated.map((name, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-secondary/50 group transition-colors">
                <span className="font-medium text-sm text-foreground">{name}</span>
                <button
                  onClick={() => pin(name)}
                  disabled={pinned.includes(name)}
                  className="text-xs text-muted-foreground/40 group-hover:text-muted-foreground hover:text-violet-400 disabled:text-violet-400 disabled:cursor-default transition-colors"
                  title="Save name"
                >
                  {pinned.includes(name) ? '★' : '☆'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Saved names */}
      {pinned.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Saved Names</h3>
            <button onClick={() => setPinned([])} className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">Clear all</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {pinned.map((name, i) => (
              <span key={i} className="flex items-center gap-1.5 text-sm bg-violet-500/10 border border-violet-500/30 text-violet-300 px-3 py-1 rounded-full">
                {name}
                <button onClick={() => unpin(name)} className="text-violet-400/60 hover:text-violet-400 transition-colors">
                  <X size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main DnD Tools page ──────────────────────────────────────────────────────

const TOOL_MAP = {
  '/tools/dice':       { label: 'Dice Roller',         icon: Dice5,    settingKey: 'diceRoller',        component: DiceRoller,        desc: 'Roll any dice combination with advantage/disadvantage.' },
  '/tools/initiative': { label: 'Initiative Tracker',   icon: Swords,   settingKey: 'initiativeTracker', component: InitiativeTracker,  desc: 'Track turn order, HP, conditions, and death saves.' },
  '/tools/encounters': { label: 'Encounter Tables',     icon: Table2,   settingKey: 'encounterRoller',   component: EncounterRoller,    desc: 'Build and roll on custom random encounter tables.' },
  '/tools/spells':     { label: 'Spell Slots',          icon: Sparkles, settingKey: 'spellSlots',        component: SpellSlotTracker,   desc: 'Track spell slots for multiple characters.' },
  '/tools/conditions': { label: 'Condition Reference',  icon: BookOpen, settingKey: 'conditionRef',      component: ConditionReference, desc: 'Quick rules reference for all D&D 5e conditions.' },
  '/tools/loot':       { label: 'Loot Generator',       icon: Gem,      settingKey: 'lootGenerator',     component: LootGenerator,      desc: 'Generate CR-appropriate treasure hoards.' },
  '/tools/names':      { label: 'Name Generator',       icon: User,     settingKey: 'nameGenerator',     component: NameGenerator,      desc: 'Random NPC names by race and gender.' },
  '/tools/spells-list':{ label: 'Spells List',          icon: Wand2,    settingKey: 'spellsList',        component: SpellsList,         desc: 'Manage and populate spells.' },
  '/tools/items-list': { label: 'Items List',           icon: Box,      settingKey: 'itemsList',         component: ItemsList,          desc: 'Manage and populate items.' },
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
    <div className="flex-1 overflow-y-auto" style={{ WebkitAppRegion: 'no-drag' }}>
      <header className="flex items-center gap-3 px-6 py-4 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/30 shrink-0">
          <Icon size={16} className="text-violet-400" />
        </div>
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground">{tool.label}</h2>
          <p className="text-xs text-muted-foreground">{tool.desc}</p>
        </div>
      </header>
      <div className="p-6">
        <Component />
      </div>
    </div>
  );
}
