// showIf: { key, values } — section only shown when field `key` matches one of `values`

export const TEMPLATES = {
  characters: {
    label: 'Character', color: 'blue', icon: 'Users',
    sections: [
      { title: 'Identity', fields: [
        { key: 'name',   label: 'Full Name',     type: 'text',   placeholder: 'e.g. Aldric the Grey', required: true },
        { key: 'alias',  label: 'Alias / Title', type: 'text',   placeholder: 'e.g. The Ashen Knight' },
        { key: 'role',   label: 'Role',          type: 'select', options: ['Hero','Villain','Antihero','Mentor','Ally','Neutral','Unknown'] },
        { key: 'status', label: 'Status',        type: 'select', options: ['Alive','Dead','Unknown','Undead','Imprisoned'] },
        { key: 'advRank',   label: 'Adventurer Rank', type: 'faction-rank-select', factionHint: 'adventurer' },
        { key: 'merchRank', label: 'Merchant Rank',   type: 'faction-rank-select', factionHint: 'merchant' },
      ]},
      { title: 'Appearance', fields: [
        { key: 'age',        label: 'Age',                  type: 'text',     placeholder: 'e.g. 34, Ancient, Ageless' },
        { key: 'gender',     label: 'Gender',               type: 'text',     placeholder: 'e.g. Male, Female, Non-binary' },
        { key: 'race',       label: 'Race / Species',       type: 'race-select', placeholder: 'e.g. Human, Elf, Half-demon' },
        { key: 'appearance', label: 'Physical Description', type: 'textarea', placeholder: 'Describe their look, build, distinguishing features…', rows: 3 },
      ]},
      { title: 'Personality & Background', fields: [
        { key: 'personality', label: 'Personality',      type: 'textarea', placeholder: 'Key traits, mannerisms, fears, desires…', rows: 3 },
        { key: 'background',  label: 'Background',       type: 'textarea', placeholder: 'History, origin, key life events…', rows: 4 },
        { key: 'motivation',  label: 'Goal / Motivation',type: 'textarea', placeholder: 'What drives them? What do they want?', rows: 2 },
      ]},
      { title: 'Skills & Abilities', fields: [
        { key: 'abilities',  label: 'Abilities / Powers', type: 'textarea', placeholder: 'Magic, combat skills, special gifts…', rows: 3 },
        { key: 'weaknesses', label: 'Weaknesses',         type: 'textarea', placeholder: 'Vulnerabilities, flaws, fears…', rows: 2 },
      ]},
      { title: 'Notes', fields: [
        { key: 'image', label: 'Portrait / Image URL', type: 'text',     placeholder: 'https://…' },
        { key: 'notes', label: 'Notes',                type: 'textarea', placeholder: 'Anything else worth tracking…', rows: 3 },
      ]},
    ],
  },

  locations: {
    label: 'Location', color: 'green', icon: 'Map',
    sections: [
      { title: 'Overview', fields: [
        { key: 'name',   label: 'Name',            type: 'text',   placeholder: 'e.g. The Sunken City', required: true },
        { key: 'type',   label: 'Type',            type: 'select', options: ['City','Town','Village','Castle','Tavern','Dungeon','Cave','Forest','Mountain','Ocean','Desert','Ruin','Shrine','Plane','Other'] },
        { key: 'region', label: 'Region / World',  type: 'text',   placeholder: 'e.g. Northern Wilds, The Underdark' },
        { key: 'status', label: 'Status',          type: 'select', options: ['Thriving','Abandoned','Ruins','Hidden','Contested','Destroyed'] },
      ]},
      { title: 'Description', fields: [
        { key: 'description', label: 'Overview',   type: 'textarea', placeholder: 'A vivid picture of this place…', rows: 4 },
        { key: 'atmosphere',  label: 'Atmosphere', type: 'textarea', placeholder: 'Mood, weather, feeling when you arrive…', rows: 2 },
      ]},

      // ── Settlement fields (City / Town / Village / Castle)
      { title: 'Settlement Details', showIf: { key: 'type', values: ['City','Town','Village','Castle'] }, fields: [
        { key: 'population',  label: 'Population',   type: 'text',     placeholder: 'e.g. ~50,000, Small hamlet' },
        { key: 'government',  label: 'Government',   type: 'select',   options: ['Monarchy','Republic','Council','Theocracy','Oligarchy','Anarchic','Tribal','Empire','Unknown'] },
        { key: 'economy',     label: 'Economy',      type: 'textarea', placeholder: 'Main trade, Marks, wealth level…', rows: 2 },
        { key: 'districts',   label: 'Districts / Quarters', type: 'textarea', placeholder: 'Notable areas, markets, slums, noble quarter…', rows: 2 },
        { key: 'notablePOI',  label: 'Notable Places',       type: 'textarea', placeholder: 'Taverns, temples, landmarks inside the settlement…', rows: 2 },
        { key: 'history',     label: 'History',              type: 'textarea', placeholder: 'How was it founded? Key events…', rows: 3 },
        { key: 'secrets',     label: 'Secrets',              type: 'textarea', placeholder: 'Hidden truths, underground networks, rumors…', rows: 2 },
      ]},

      // ── Dungeon / Cave
      { title: 'Dungeon Details', showIf: { key: 'type', values: ['Dungeon','Cave'] }, fields: [
        { key: 'dungeonType', label: 'Dungeon Type', type: 'select', options: ['Natural Cave','Tomb','Fortress','Sewers','Ruins','Underdark','Magical','Prison','Other'] },
        { key: 'levels',      label: 'Levels / Floors', type: 'text', placeholder: 'e.g. 5 floors, 3 tiers' },
        { key: 'inhabitants', label: 'Inhabitants',     type: 'textarea', placeholder: 'Who or what lives here? Boss monster, minions…', rows: 2 },
        { key: 'hazards',     label: 'Hazards & Traps', type: 'textarea', placeholder: 'Environmental dangers, traps, curses…', rows: 2 },
        { key: 'loot',        label: 'Notable Loot',    type: 'textarea', placeholder: 'Treasures, artifacts, rewards…', rows: 2 },
        { key: 'history',     label: 'History / Origin',type: 'textarea', placeholder: 'What happened here? Who built it?', rows: 3 },
        { key: 'secrets',     label: 'Secrets',         type: 'textarea', placeholder: 'Hidden rooms, buried truths, lore…', rows: 2 },
      ]},

      // ── Wilderness (Forest / Mountain / Ocean / Desert)
      { title: 'Wilderness Details', showIf: { key: 'type', values: ['Forest','Mountain','Ocean','Desert'] }, fields: [
        { key: 'terrain',     label: 'Terrain',          type: 'textarea', placeholder: 'Landscape, terrain features, scale…', rows: 2 },
        { key: 'inhabitants', label: 'Inhabitants',      type: 'textarea', placeholder: 'Creatures, tribes, spirits that dwell here…', rows: 2 },
        { key: 'resources',   label: 'Resources',        type: 'textarea', placeholder: 'Herbs, minerals, magical materials found here…', rows: 2 },
        { key: 'hazards',     label: 'Hazards',          type: 'textarea', placeholder: 'Environmental dangers, weather, magical anomalies…', rows: 2 },
        { key: 'history',     label: 'History / Lore',   type: 'textarea', placeholder: 'Ancient events, legends tied to this place…', rows: 3 },
        { key: 'secrets',     label: 'Secrets',          type: 'textarea', placeholder: 'Hidden places, forgotten ruins within…', rows: 2 },
      ]},

      // ── Ruins / Shrine / Plane / Other
      { title: 'Site Details', showIf: { key: 'type', values: ['Ruin','Shrine','Plane','Tavern','Other'] }, fields: [
        { key: 'purpose',     label: 'Original Purpose', type: 'textarea', placeholder: 'What was this built for? What does it serve now?', rows: 2 },
        { key: 'inhabitants', label: 'Current Inhabitants', type: 'textarea', placeholder: 'Who or what occupies this place?', rows: 2 },
        { key: 'history',     label: 'History',           type: 'textarea', placeholder: 'How did this place come to be?', rows: 3 },
        { key: 'secrets',     label: 'Secrets',           type: 'textarea', placeholder: 'Hidden truths, buried lore…', rows: 2 },
      ]},

      { title: 'Notes', fields: [
        { key: 'image', label: 'Image URL', type: 'text',     placeholder: 'https://…' },
        { key: 'notes', label: 'Notes',     type: 'textarea', placeholder: 'Anything else worth tracking…', rows: 3 },
      ]},
    ],
  },

  things: {
    label: 'Thing', color: 'amber', icon: 'Box',
    sections: [
      { title: 'Overview', fields: [
        { key: 'name',   label: 'Name',         type: 'text',   placeholder: 'e.g. Shadowblade', required: true },
        { key: 'type',   label: 'Type',         type: 'select', options: ['Item','Artifact','Weapon','Armor','Spell','Potion','Blessing','Curse','License','Magic System','Class','Tradition','Other'] },
        { key: 'rarity', label: 'Rarity / Tier',type: 'select', options: ['Common','Uncommon','Rare','Legendary','Unique','N/A'] },
        { key: 'status', label: 'Status',       type: 'select', options: ['Active','Dormant','Destroyed','Lost','Unknown'] },
      ]},
      { title: 'Description', fields: [
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What is it? What does it look like?', rows: 4 },
        { key: 'origin',      label: 'Origin',      type: 'textarea', placeholder: 'Where did it come from? Who made it?', rows: 2 },
      ]},

      // ── Item / Weapon / Armor / Artifact / Potion / Spell / Blessing / Curse
      { title: 'Item Properties', showIf: { key: 'type', values: ['Item','Weapon','Armor','Artifact','Potion','Spell','Blessing','Curse'] }, fields: [
        { key: 'abilities',  label: 'Abilities / Properties', type: 'textarea', placeholder: 'What can it do? Enchantments, effects…', rows: 3 },
        { key: 'weaknesses', label: 'Limits / Drawbacks',     type: 'textarea', placeholder: 'What counters it? Costs, curses, requirements…', rows: 2 },
        { key: 'location',   label: 'Current Location',       type: 'text',     placeholder: 'Where is it now?' },
        { key: 'owner',      label: 'Owner / Wielder',        type: 'text',     placeholder: 'Who possesses it?' },
      ]},

      // ── License Details
      { title: 'License Details', showIf: { key: 'type', values: ['License'] }, fields: [
        { key: 'licenseType', label: 'License Type', type: 'select', options: ['Adventurer', 'Merchant', 'Other'] },
        { key: 'advRank',   label: 'Adventurer Rank', type: 'faction-rank-select', factionHint: 'adventurer' },
        { key: 'merchRank', label: 'Merchant Rank',   type: 'faction-rank-select', factionHint: 'merchant' },
        { key: 'issuedBy', label: 'Issued By', type: 'text', placeholder: 'e.g. The Iron Brotherhood' },
        { key: 'expiry', label: 'Expiry / Renewal', type: 'text', placeholder: 'e.g. Year 1205, Seasonal' },
      ]},



      { title: 'Notes', fields: [
        { key: 'image', label: 'Image URL', type: 'text',     placeholder: 'https://…' },
        { key: 'notes', label: 'Notes',     type: 'textarea', placeholder: 'Anything else worth tracking…', rows: 3 },
      ]},
    ],
  },

  factions: {
    label: 'Faction', color: 'indigo', icon: 'Flag',
    sections: [
      { title: 'Overview', fields: [
        { key: 'name',         label: 'Name',        type: 'text',   placeholder: 'e.g. The Iron Brotherhood', required: true },
        { key: 'factionType',  label: 'Type',        type: 'select', options: ['Guild','Kingdom','Empire','Cult','Order','Tribe','Syndicate','Alliance','Organization','Religion','Sect','Other'] },
        { key: 'alignment',    label: 'Alignment',   type: 'select', options: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil', 'Unknown'] },
        { key: 'status',       label: 'Status',      type: 'select', options: ['Active','Disbanded','Destroyed','Secret','Emerging','Unknown'] },
      ]},
      { title: 'Description', fields: [
        { key: 'description', label: 'Overview',     type: 'textarea', placeholder: 'What is this faction? What do they do?', rows: 4 },
        { key: 'history',     label: 'History',      type: 'textarea', placeholder: 'How were they founded?', rows: 3 },
      ]},
      { title: 'Organisation', fields: [
        { key: 'leader',       label: 'Leader',      type: 'text',     placeholder: 'Current leader or ruling body' },
        { key: 'headquarters', label: 'Headquarters',type: 'text',     placeholder: 'Base of operations' },
        { key: 'location',     label: 'Territory',   type: 'text',     placeholder: 'Regions or cities they control' },
        { key: 'goals',        label: 'Goals',       type: 'textarea', placeholder: 'What does this faction want?', rows: 2 },
        { key: 'membership',   label: 'Membership Levels', type: 'membership-levels' },
      ]},
      { title: 'Notable Members', sidebar: true, fields: [
        { key: 'notableMembers', label: 'Notable Members', type: 'character-select' },
      ]},
    ],
  },

  races: {
    label: 'Race', color: 'green', icon: 'Users',
    sections: [
      { title: 'Overview', fields: [
        { key: 'name',       label: 'Name',         type: 'text',   placeholder: 'e.g. Human, Elf, Dwarf', required: true },
        { key: 'status',     label: 'Status',       type: 'select', options: ['Common','Rare','Endangered','Extinct','Mythical','Unknown'] },
        { key: 'maxAge',     label: 'Max Lifespan', type: 'text',   placeholder: 'e.g. 110, 800, Ageless' },
      ]},
      { title: 'Biology', fields: [
        { key: 'physiology', label: 'Physical Traits',   type: 'textarea', placeholder: 'Height, build, lifespan, distinguishing features…', rows: 3 },
        { key: 'abilities',  label: 'Innate Abilities',  type: 'textarea', placeholder: 'Natural gifts, magic, resistances…', rows: 2 },
        { key: 'weaknesses', label: 'Weaknesses',        type: 'textarea', placeholder: 'Vulnerabilities, limitations…', rows: 2 },
      ]},
      { title: 'Culture & Society', fields: [
        { key: 'homeland',   label: 'Homeland / Regions',   type: 'textarea', placeholder: 'Where do they live?', rows: 2 },
        { key: 'culture',    label: 'Culture & Society',    type: 'textarea', placeholder: 'Traditions, values, social structure…', rows: 3 },
        { key: 'history',    label: 'History & Origin',     type: 'textarea', placeholder: 'How did this race come to be? Key historical events…', rows: 3 },
        { key: 'relations',  label: 'Relations with Others',type: 'textarea', placeholder: 'Allies, rivals, ancient grudges with other races…', rows: 2 },
      ]},
      { title: 'Notes', fields: [
        { key: 'image', label: 'Image URL', type: 'text',     placeholder: 'https://…' },
        { key: 'notes', label: 'Notes',     type: 'textarea', placeholder: 'Anything else worth tracking…', rows: 3 },
      ]},
    ],
  },

  creatures: {
    label: 'Creature', color: 'orange', icon: 'PawPrint',
    sections: [
      { title: 'Overview', fields: [
        { key: 'name',     label: 'Name',       type: 'text',   placeholder: 'e.g. Dire Wolf', required: true },
        { key: 'type',     label: 'Type',       type: 'select', options: ['Animal','Monster','Beast','Dragon','Undead','Construct','Elemental','Fey','Fiend','Monstrosity','Plant','Other'] },
        { key: 'danger',   label: 'Danger Level',type: 'select', options: ['Harmless','Low','Medium','High','Deadly','Catastrophic','Unknown'] },
        { key: 'status',   label: 'Status',     type: 'select', options: ['Abundant','Common','Rare','Endangered','Extinct','Mythical','Unknown'] },
      ]},
      { title: 'Description', fields: [
        { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What does it look like? Size, features…', rows: 4 },
      ]},
      { title: 'Ecology', fields: [
        { key: 'habitat',     label: 'Habitat',     type: 'text',     placeholder: 'e.g. Deep forests, The Underdark' },
        { key: 'diet',        label: 'Diet',        type: 'text',     placeholder: 'Carnivore, Herbivore, Omnivore, etc.' },
        { key: 'behavior',    label: 'Behavior',    type: 'textarea', placeholder: 'How does it hunt? Is it aggressive? Social structure…', rows: 3 },
        { key: 'location',    label: 'Known Locations', type: 'text', placeholder: 'Where has it been sighted?' },
      ]},
      { title: 'Capabilities', fields: [
        { key: 'abilities',   label: 'Abilities',   type: 'textarea', placeholder: 'Special attacks, powers, resistances…', rows: 3 },
        { key: 'weaknesses',  label: 'Weaknesses',  type: 'textarea', placeholder: 'What can kill or repel it?', rows: 2 },
      ]},
      { title: 'Notes', fields: [
        { key: 'image', label: 'Image URL', type: 'text',     placeholder: 'https://…' },
        { key: 'notes', label: 'Notes',     type: 'textarea', placeholder: 'Myths, rumors, tamability…', rows: 3 },
      ]},
    ],
  },

  lore: {
    label: 'Lore', color: 'purple', icon: 'BookMarked',
    sections: [
      { title: 'Overview', fields: [
        { key: 'name',    label: 'Name',     type: 'text',   placeholder: 'e.g. Ancient Mythology', required: true },
        { key: 'subtype', label: 'Category', type: 'select', options: ['System','Mythology','Religion','Class','Magic System','Other'] },
        { key: 'status',  label: 'Status',   type: 'select', options: ['Active','Extinct','Dormant','Legendary','Emerging','Unknown'] },
      ]},
      { title: 'Description', fields: [
        { key: 'description', label: 'Overview',         type: 'textarea', placeholder: 'A broad description…', rows: 4 },
        { key: 'origin',      label: 'Origin / History', type: 'textarea', placeholder: 'How did they come to be?', rows: 3 },
      ]},

      { title: 'Race — Biology & Culture', showIf: { key: 'subtype', values: ['Race'] }, fields: [
        { key: 'homeland',      label: 'Homeland / Regions',       type: 'textarea', placeholder: 'Where do they live?', rows: 2 },
        { key: 'physiology',    label: 'Physical Traits',          type: 'textarea', placeholder: 'Height, build, lifespan, features…', rows: 2 },
        { key: 'culture',       label: 'Culture & Society',        type: 'textarea', placeholder: 'Traditions, values, social structure…', rows: 3 },
        { key: 'raceRelations', label: 'Relations with Other Races',type: 'textarea', placeholder: 'Allies, rivals, ancient grudges…', rows: 2 },
      ]},

      { title: 'Faction — Organisation', showIf: { key: 'subtype', values: ['Faction'] }, fields: [
        { key: 'factionType',  label: 'Type',        type: 'select',   options: ['Guild','Kingdom','Empire','Cult','Order','Tribe','Syndicate','Alliance','Other'] },
        { key: 'alignment',    label: 'Alignment',   type: 'select',   options: ['Lawful Good','Neutral Good','Chaotic Good','Lawful Neutral','True Neutral','Chaotic Neutral','Lawful Evil','Neutral Evil','Chaotic Evil'] },
        { key: 'leader',       label: 'Leader',      type: 'text',     placeholder: 'Current leader or ruling body' },
        { key: 'headquarters', label: 'Headquarters',type: 'text',     placeholder: 'Base of operations' },
        { key: 'goals',        label: 'Goals',       type: 'textarea', placeholder: 'What does this faction want?', rows: 2 },
        { key: 'membership',   label: 'Membership',  type: 'textarea', placeholder: 'Who can join? Ranks, initiation…', rows: 2 },
        { key: 'resources',    label: 'Resources',   type: 'textarea', placeholder: 'Wealth, armies, influence…', rows: 2 },
        { key: 'allies',       label: 'Allies',      type: 'text',     placeholder: 'Friendly factions or individuals' },
        { key: 'enemies',      label: 'Enemies',     type: 'text',     placeholder: 'Rivals or sworn foes' },
      ]},

      { title: 'Class — Mechanics & Role', showIf: { key: 'subtype', values: ['Class'] }, fields: [
        { key: 'role',         label: 'Role',               type: 'select',   options: ['Warrior','Mage','Rogue','Healer','Support','Summoner','Ranger','Scholar','Other'] },
        { key: 'requirements', label: 'Requirements',       type: 'textarea', placeholder: 'Prerequisites, training required…', rows: 2 },
        { key: 'abilities',    label: 'Abilities & Skills', type: 'textarea', placeholder: 'Signature powers, spells, techniques…', rows: 3 },
        { key: 'progression',  label: 'Progression',        type: 'textarea', placeholder: 'How do members grow? Tiers, milestones…', rows: 2 },
      ]},

      { title: 'Religion & Magic — Doctrine', showIf: { key: 'subtype', values: ['Religion','Magic System'] }, fields: [
        { key: 'deity',    label: 'Deity / Source',    type: 'text',     placeholder: 'Patron god, cosmic force, or power source' },
        { key: 'doctrine', label: 'Doctrine / Laws',   type: 'textarea', placeholder: 'Core tenets, commandments, forbidden acts…', rows: 3 },
        { key: 'rituals',  label: 'Rituals / Practices',type: 'textarea', placeholder: 'Ceremonies, spells, sacred traditions…', rows: 2 },
        { key: 'weakness', label: 'Weakness / Counter', type: 'textarea', placeholder: 'What opposes or limits this power?', rows: 2 },
      ]},

      { title: 'Notable Members', fields: [
        { key: 'notableMembers', label: 'Notable Members / Figures', type: 'textarea', placeholder: 'Famous heroes, infamous villains…', rows: 3 },
      ]},

      { title: 'Notes', fields: [
        { key: 'image', label: 'Image URL', type: 'text',     placeholder: 'https://…' },
        { key: 'notes', label: 'Notes',     type: 'textarea', placeholder: 'Anything else worth tracking…', rows: 3 },
      ]},
    ],
  },
};

export function getTemplate(entityType) {
  return TEMPLATES[entityType] || null;
}

// Returns all unique field keys (for determining what to save to db)
export function getAllFieldKeys(entityType) {
  const tmpl = TEMPLATES[entityType];
  if (!tmpl) return [];
  const seen = new Set();
  const keys = [];
  for (const s of tmpl.sections) {
    for (const f of s.fields) {
      if (!seen.has(f.key)) { seen.add(f.key); keys.push(f.key); }
    }
  }
  return keys;
}

// Filter sections that should be visible for a given set of current values
export function getVisibleSections(entityType, values = {}) {
  const tmpl = TEMPLATES[entityType];
  if (!tmpl) return [];
  return tmpl.sections.filter(s => {
    if (!s.showIf) return true;
    const val = values[s.showIf.key];
    return s.showIf.values.includes(val);
  });
}
