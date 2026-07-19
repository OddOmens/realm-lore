import TextareaAutosize from 'react-textarea-autosize';
import { useState } from 'react';
import { Plus, X, Box, ArrowRight, Search } from 'lucide-react';
import { useWorldStore } from '../../store/useWorldStore';
import { SRD_ITEMS } from '../../lib/dndCompendium';

// Borrow the usePersisted pattern
function loadState(key, fallback) {
  try {
    const raw = localStorage.getItem(`dndTool_${key}`);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveState(key, value) {
  try { localStorage.setItem(`dndTool_${key}`, JSON.stringify(value)); } catch {}
}

const DEFAULT_ITEMS = [
  { id: 'i1', name: 'Potion of Healing', rarity: 'common', type: 'Potion', description: 'You regain 2d4+2 hit points when you drink this potion. The potion\'s red liquid glimmers when agitated.' },
  { id: 'i2', name: 'Bag of Holding', rarity: 'uncommon', type: 'Wondrous Item', description: 'This bag has an interior space considerably larger than its outside dimensions, roughly 2 feet in diameter at the mouth and 4 feet deep. The bag can hold up to 500 pounds, not exceeding a volume of 64 cubic feet.' },
];

export default function ItemsList() {
  const [items, setItems] = useState(() => loadState('itemsList', DEFAULT_ITEMS));
  const [newItem, setNewItem] = useState({ name: '', rarity: 'common', type: 'Item', description: '' });
  const [searchQuery, setSearchQuery] = useState('');
  
  const addEntity = useWorldStore(s => s.addEntity);
  const things = useWorldStore(s => s.things) || [];

  const saveItems = (newItems) => {
    setItems(newItems);
    saveState('itemsList', newItems);
  };

  const handleAdd = () => {
    if (!newItem.name.trim()) return;
    const item = { id: Date.now().toString(), ...newItem };
    saveItems([...items, item]);
    setNewItem({ name: '', rarity: 'common', type: 'Item', description: '' });
  };

  const removeItem = (id) => {
    saveItems(items.filter(i => i.id !== id));
  };

  const populateWorld = async (item) => {
    await addEntity('things', {
      name: item.name,
      type: 'Item',
      description: `*Rarity: ${item.rarity} | Type: ${item.type}*\n\n${item.description}`,
      isMagic: item.rarity !== 'common' && item.rarity !== 'mundane'
    });
    alert(`Added ${item.name} to the world as a Thing!`);
  };

  const realmItems = things.map(t => ({
    id: `realm_${t.id}`,
    name: t.name,
    rarity: t.status || 'unknown',
    type: t.type || 'Item',
    description: t.description || 'Realm Lore item.',
    source: 'realm'
  }));

  const srdItems = SRD_ITEMS.map(i => ({ ...i, source: 'srd' }));
  const localItems = items.map(i => ({ ...i, source: 'local' }));

  const allItems = [...localItems, ...realmItems, ...srdItems];

  const filteredItems = allItems.filter(i => 
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (i.description && i.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col gap-4 max-w-2xl">
      <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
        <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Add Item</h3>
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Item Name"
              className="flex-1 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <input
              value={newItem.type}
              onChange={e => setNewItem({ ...newItem, type: e.target.value })}
              placeholder="Type (e.g. Weapon)"
              className="w-32 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            />
            <select
              value={newItem.rarity}
              onChange={e => setNewItem({ ...newItem, rarity: e.target.value })}
              className="w-32 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
            >
              <option value="mundane">Mundane</option>
              <option value="common">Common</option>
              <option value="uncommon">Uncommon</option>
              <option value="rare">Rare</option>
              <option value="very rare">Very Rare</option>
              <option value="legendary">Legendary</option>
            </select>
          </div>
          <TextareaAutosize
            value={newItem.description}
            onChange={e => setNewItem({ ...newItem, description: e.target.value })}
            placeholder="Item Description..."
            className="w-full h-24 bg-secondary border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
          />
          <button
            onClick={handleAdd}
            className="flex items-center justify-center gap-1.5 h-9 px-4 rounded-md text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
          >
            <Plus size={14} /> Add Item
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search items across Local, Realm Lore, and SRD..."
            className="w-full bg-card border border-border rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500"
          />
        </div>

        {filteredItems.map(item => (
          <div key={item.id} className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 group">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-foreground flex items-center gap-2">
                  <Box size={14} className={item.source === 'srd' ? 'text-amber-400' : item.source === 'realm' ? 'text-green-400' : 'text-violet-400'} /> 
                  {item.name}
                  <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground ml-2">
                    {item.source}
                  </span>
                </h4>
                <p className="text-xs text-muted-foreground capitalize">{item.rarity} • {item.type}</p>
              </div>
              <div className="flex gap-2">
                {item.source === 'local' && (
                  <>
                    <button
                      onClick={() => populateWorld(item)}
                      className="text-xs flex items-center gap-1 text-muted-foreground hover:text-violet-400 transition-colors"
                      title="Add to World"
                    >
                      <ArrowRight size={14} /> To World
                    </button>
                    <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
            <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{item.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
