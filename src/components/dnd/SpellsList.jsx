import { useState } from 'react';
import { Plus, X, Wand2, ArrowRight } from 'lucide-react';
import { useWorldStore } from '../../store/useWorldStore';

// We'll borrow the usePersisted pattern
function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(`dndTool_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveState(key, value) {
  try { localStorage.setItem(`dndTool_${key}`, JSON.stringify(value)); } catch {}
}

const DEFAULT_SPELLS = [
  { id: 's1', name: 'Fireball', level: 3, school: 'Evocation', description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. 8d6 fire damage.' },
  { id: 's2', name: 'Magic Missile', level: 1, school: 'Evocation', description: 'You create three glowing darts of magical force. Each dart deals 1d4 + 1 force damage.' },
];

export default function SpellsList() {
  const [spells, setSpells] = useState(() => loadState('spellsList', DEFAULT_SPELLS));
  const [newSpell, setNewSpell] = useState({ name: '', level: 1, school: 'Evocation', description: '' });
  const addEntity = useWorldStore(s => s.addEntity);

  const saveSpells = (newSpells) => {
    setSpells(newSpells);
    saveState('spellsList', newSpells);
  };

  const handleAdd = () => {
    if (!newSpell.name.trim()) return;
    const s = { id: Date.now().toString(), ...newSpell };
    saveSpells([...spells, s]);
    setNewSpell({ name: '', level: 1, school: 'Evocation', description: '' });
  };

  const removeSpell = (id) => {
    saveSpells(spells.filter(s => s.id !== id));
  };

  const populateWorld = async (spell) => {
    await addEntity('things', {
      name: spell.name,
      type: 'Spell',
      description: `Level ${spell.level} ${spell.school}\n\n${spell.description}`,
      isMagic: true
    });
    alert(`Added ${spell.name} to the world as a Thing!`);
  };

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Add Spell</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={newSpell.name}
              onChange={e => setNewSpell({ ...newSpell, name: e.target.value })}
              placeholder="Spell Name"
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              value={newSpell.level}
              type="number"
              onChange={e => setNewSpell({ ...newSpell, level: parseInt(e.target.value) || 0 })}
              placeholder="Level"
              className="w-20 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              value={newSpell.school}
              onChange={e => setNewSpell({ ...newSpell, school: e.target.value })}
              placeholder="School"
              className="w-32 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
          </div>
          <textarea
            value={newSpell.description}
            onChange={e => setNewSpell({ ...newSpell, description: e.target.value })}
            placeholder="Spell Description..."
            className="w-full h-24 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
          />
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={14} /> Add Spell
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {spells.map(spell => (
          <div key={spell.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 group">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Wand2 size={14} className="text-violet-400" /> {spell.name}
                </h4>
                <p className="text-xs text-muted-foreground">Level {spell.level} {spell.school}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => populateWorld(spell)}
                  className="text-xs flex items-center gap-1 text-muted-foreground hover:text-violet-400 transition-colors"
                  title="Add to World"
                >
                  <ArrowRight size={14} /> To World
                </button>
                <button onClick={() => removeSpell(spell.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
            <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{spell.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
