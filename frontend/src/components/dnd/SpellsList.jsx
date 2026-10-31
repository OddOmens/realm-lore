import TextareaAutosize from 'react-textarea-autosize';
import { useState } from 'react';
import { Plus, X, Wand2, ArrowRight, Search } from 'lucide-react';
import { useWorldStore } from '../../store/useWorldStore';
import { SRD_SPELLS } from '../../lib/dndCompendium';

// We'll borrow the usePersisted pattern
function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(`dndTool_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveState(key, value) {
  try { localStorage.setItem(`dndTool_${key}`, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

const DEFAULT_SPELLS = [
  { id: 's1', name: 'Fireball', level: 3, school: 'Evocation', description: 'A bright streak flashes from your pointing finger to a point you choose within range and then blossoms with a low roar into an explosion of flame. 8d6 fire damage.' },
  { id: 's2', name: 'Magic Missile', level: 1, school: 'Evocation', description: 'You create three glowing darts of magical force. Each dart deals 1d4 + 1 force damage.' },
];

export default function SpellsList() {
  const [spells, setSpells] = useState(() => loadState('spellsList', DEFAULT_SPELLS));
  const [newSpell, setNewSpell] = useState({ name: '', level: 1, school: 'Evocation', description: '' });
  const [searchQuery, setSearchQuery] = useState('');

  const addEntity = useWorldStore(s => s.addEntity);
  const things = useWorldStore(s => s.things) || [];
  const lore = useWorldStore(s => s.lore) || [];

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

  const realmSpells = [
    ...things.filter(t => t.type === 'Spell'),
    ...lore.filter(l => l.type === 'Spell')
  ].map(s => ({
    id: `realm_${s.id}`,
    name: s.name,
    level: s.level || '?',
    school: s.school || 'Unknown',
    description: s.description || 'Realm Lore spell.',
    source: 'realm'
  }));

  const srdSpells = SRD_SPELLS.map(s => ({ ...s, source: 'srd' }));
  const localSpells = spells.map(s => ({ ...s, source: 'local' }));

  const allSpells = [...localSpells, ...realmSpells, ...srdSpells];

  const filteredSpells = allSpells.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="card p-4 flex flex-col gap-3">
        <h3 className="section-title">Add spell</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={newSpell.name}
              onChange={e => setNewSpell({ ...newSpell, name: e.target.value })}
              placeholder="Spell name"
              className="input flex-1"
            />
            <input
              value={newSpell.level}
              type="number"
              onChange={e => setNewSpell({ ...newSpell, level: parseInt(e.target.value) || 0 })}
              placeholder="Level"
              className="input w-20"
            />
            <input
              value={newSpell.school}
              onChange={e => setNewSpell({ ...newSpell, school: e.target.value })}
              placeholder="School"
              className="input w-32"
            />
          </div>
          <TextareaAutosize
            value={newSpell.description}
            onChange={e => setNewSpell({ ...newSpell, description: e.target.value })}
            placeholder="Spell description…"
            minRows={3}
            className="input w-full resize-none"
          />
          <button
            onClick={handleAdd}
            className="btn btn-primary self-start"
          >
            <Plus /> Add spell
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search spells across Local, Realm Lore, and SRD..."
            className="input w-full pl-8"
          />
        </div>

        {filteredSpells.map(spell => (
          <div key={spell.id} className="card p-4 flex flex-col gap-1.5 group">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
                  <Wand2 size={14} className={spell.source === 'srd' ? 'text-amber-400' : spell.source === 'realm' ? 'text-green-400' : 'text-muted-foreground'} /> 
                  {spell.name}
                  <span className="badge capitalize ml-1">
                    {spell.source}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground">Level {spell.level} {spell.school}</p>
              </div>
              <div className="flex gap-2">
                {spell.source === 'local' && (
                  <>
                    <button
                      onClick={() => populateWorld(spell)}
                      className="btn btn-ghost btn-sm"
                      title="Add to world"
                    >
                      <ArrowRight /> To world
                    </button>
                    <button onClick={() => removeSpell(spell.id)} aria-label="Delete" className="btn btn-ghost btn-icon btn-sm hover:text-destructive">
                      <X />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed text-foreground/85 mt-1 whitespace-pre-wrap">{spell.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
