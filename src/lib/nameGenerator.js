// ── Name generation library ───────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cap  = (s)   => s.charAt(0).toUpperCase() + s.slice(1);

// ── Character names ───────────────────────────────────────────────────────────

const CHAR_STARTS = [
  'Aer','Bel','Cal','Dar','Ela','Fer','Gar','Hal','Ila','Jar',
  'Kel','Lor','Mar','Ner','Ori','Per','Ral','Sel','Tal','Ura',
  'Ver','Wyl','Xen','Yar','Zel','Ald','Bran','Cor','Dav','Ewan',
  'Fin','Ged','Hev','Isa','Jov','Kael','Lan','Mira','Nico','Ona',
  'Pell','Quen','Ren','Sev','Tara','Ulen','Vael','Wyn','Xara','Yov',
  'Zara','Adra','Bess','Cael','Drin','Evel','Fara','Glen','Hana','Ivan',
  'Jera','Kira','Lena','Mael','Nara','Odel','Pira','Rael','Sara','Tira',
];

const CHAR_MIDS = [
  'a','e','i','o','u','ar','el','in','or','an',
  'era','ila','ora','ala','ena','ira','ara','ura','ola','ela',
  'ath','eth','ith','oth','uth','ael','iel','uel','oel',
];

const CHAR_ENDS = [
  'an','en','in','on','yn','ar','er','ir','or','ur',
  'ael','iel','orn','ald','ard','ell','ill','ath','eth','ith',
  'ara','era','ira','ora','ura','ala','ela','ila','ola','ula',
  'wyn','don','ton','fen','den','ren','lin','kin','win','san',
];

const CHAR_EPITHETS = [
  'the Bold','the Quiet','the Wanderer','Farwalker','the Elder',
  'Ironhand','the Swift','Dawnborn','the Pale','Ashwood',
  'the Steadfast','Greymoor','the Younger','of the Vale','Coldwater',
  'the Fair','Stoneback','of the Hills','the Red','Longstride',
];

export function generateCharacterName() {
  const style = Math.floor(Math.random() * 3);
  let first;
  if (style === 0) {
    first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_MIDS) + pick(CHAR_ENDS));
  } else if (style === 1) {
    first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_ENDS));
  } else {
    first = pick(CHAR_STARTS);
  }
  const addEpithet = Math.random() < 0.2;
  return addEpithet ? `${first} ${pick(CHAR_EPITHETS)}` : first;
}

// ── Town / settlement names ───────────────────────────────────────────────────

const TOWN_FIRST = [
  'Ash','Birch','Black','Bram','Bright','Brook','Cald','Cinder','Clay','Cold',
  'Copper','Crag','Cross','Dusk','Elder','Elm','Ember','Fair','Fen','Field',
  'Flint','Ford','Glen','Gold','Grain','Green','Grey','Grim','Hazel','High',
  'Hill','Hollow','Iron','Ivy','Lake','Larch','Leaf','Long','Low','Marsh',
  'Mill','Mist','Moss','Mud','North','Oak','Old','Pine','Reed','River',
  'Rock','Salt','Sand','Silver','Slate','South','Stone','Storm','Swan','Thorn',
  'Timber','West','White','Wind','Winter','Wolf','Wood','Yarn','Yellow',
];

const TOWN_SECOND = [
  'barrow','beach','beck','bend','borough','bridge','brook','burn','bury','cliff',
  'combe','crest','cross','dale','dell','den','dike','down','drift','edge',
  'end','falls','farm','fell','fen','field','ford','fork','gate','glen',
  'grove','hall','ham','haven','heath','hill','hold','hollow','holm','hurst',
  'keep','landing','lea','lock','mead','mere','mill','moor','mouth','nest',
  'pool','reach','rest','ridge','rise','rock','run','seat','shaw','side',
  'slip','spring','stead','stone','strand','thorpe','ton','vale','watch','well',
  'wick','wood','worth','yard',
];

export function generateTownName() {
  return pick(TOWN_FIRST) + pick(TOWN_SECOND);
}

// ── Item names ────────────────────────────────────────────────────────────────

const ITEM_ADJ = [
  'Ancient','Battered','Bent','Blackened','Bone','Brass','Broken','Burnished',
  'Carved','Chipped','Cold','Cracked','Curved','Dark','Dented','Double-edged',
  'Dulled','Etched','Faded','Flint','Forged','Gilded','Hammered','Heavy',
  'Hollow','Hooked','Iron','Jagged','Knotted','Leaden','Long','Notched',
  'Old','Pale','Pitted','Plain','Polished','Runed','Rusted','Salt-worn',
  'Scorched','Serrated','Short','Slim','Smooth','Stained','Steel','Stone',
  'Tarnished','Thick','Thin','Twisted','Unadorned','Warped','Worn','Wrapped',
];

const ITEM_MATERIAL = [
  'ash','birch','bone','brass','bronze','cedar','clay','copper','coral',
  'elm','flint','glass','gold','horn','iron','ivory','jade','leather',
  'linen','oak','obsidian','pewter','pine','quartz','reed','silver','slate',
  'steel','stone','tin','willow','wool','yew',
];

const ITEM_NOUN = [
  'amulet','axe','band','belt','blade','brace','bracer','brooch','buckle',
  'canteen','chain','clasp','cloak','club','coil','collar','compass','crown',
  'cup','dagger','disc','flask','gauntlet','hammer','hatchet','helm','hook',
  'horn','key','knife','lamp','lantern','locket','mace','mantle','mask',
  'medallion','needle','orb','pendant','pin','pouch','quill','ring','rod',
  'rope','satchel','seal','shield','signet','spear','staff','sword','tome',
  'torch','vial','wand','wrap',
];

const ITEM_OF = [
  'the Dawn','the Deep','the Fallen','the Harvest','the Lost','the North',
  'the Old Ways','the Rising Sun','the Sea','the Storm','the Vale','the Watch',
  'Ash and Ember','Bone and Salt','Iron and Oak','Stone and Root',
  'the Blind Eye','the Broken Road','the Last Crossing','the Still Water',
];

export function generateItemName() {
  const style = Math.floor(Math.random() * 4);
  if (style === 0) return `${pick(ITEM_ADJ)} ${cap(pick(ITEM_MATERIAL))} ${cap(pick(ITEM_NOUN))}`;
  if (style === 1) return `The ${pick(ITEM_ADJ)} ${cap(pick(ITEM_NOUN))}`;
  if (style === 2) return `${cap(pick(ITEM_MATERIAL))} ${cap(pick(ITEM_NOUN))} of ${pick(ITEM_OF)}`;
  return `${pick(ITEM_ADJ)} ${cap(pick(ITEM_NOUN))} of ${pick(ITEM_OF)}`;
}

// ── Faction / group names ─────────────────────────────────────────────────────

const FACTION_ADJ = [
  'Ancient','Ashen','Bitter','Black','Blind','Broken','Burned','Cold',
  'Crimson','Dark','Deep','Distant','Fallen','Free','Grey','High',
  'Hollow','Honored','Iron','Last','Lost','Low','Mended','Old',
  'Open','Pale','Patient','Quiet','Red','Salt','Silent','Silver',
  'Slow','Steadfast','Stone','True','Unbroken','Wandering','White','Worn',
];

const FACTION_NOUN = [
  'Accord','Assembly','Band','Brotherhood','Circle','Clan','Compact',
  'Conclave','Council','Court','Covenant','Fellowship','Fold','Guild',
  'Hand','House','Keep','League','Lodge','Order','Pact','Path',
  'Ring','Rite','Road','Root','Sept','Society','Sworn','Threshold',
  'Union','Vigil','Watch','Way',
];

const FACTION_OF = [
  'the Ash Road','the Broken Blade','the Common Field','the Deep Well',
  'the Ember Gate','the Far Shore','the Grey Hills','the High Pass',
  'the Iron Bell','the Last Bridge','the Mending','the North Wind',
  'the Old Flame','the Open Hand','the Pale River','the Quiet Wood',
  'the Salt Flats','the Still Pool','the Stone Keep','the True Path',
];

export function generateFactionName() {
  const style = Math.floor(Math.random() * 3);
  if (style === 0) return `The ${pick(FACTION_ADJ)} ${pick(FACTION_NOUN)}`;
  if (style === 1) return `${pick(FACTION_NOUN)} of ${pick(FACTION_OF)}`;
  return `The ${pick(FACTION_NOUN)} of ${pick(FACTION_OF)}`;
}

// ── Place / location names ────────────────────────────────────────────────────

const PLACE_ADJ = [
  'Ancient','Ashen','Bitter','Black','Broken','Buried','Cold','Crumbling',
  'Dark','Dead','Deep','Distant','Dried','Fallen','Far','Flooded',
  'Forgotten','Frozen','Grey','High','Hollow','Low','Narrow','Old',
  'Overgrown','Pale','Quiet','Ruined','Salt','Shattered','Silent','Sunken',
  'Twisted','Waterlogged','Wide','Wild','Windswept','Worn',
];

const PLACE_NOUN = [
  'Abyss','Basin','Bay','Bluff','Canyon','Cavern','Chasm','Cliff',
  'Crossing','Dell','Depths','Desert','Divide','Dunes','Expanse','Falls',
  'Fen','Fields','Flats','Gap','Gorge','Grove','Heights','Hollow',
  'Isle','Labyrinth','Maw','Meadow','Moor','Narrows','Pass','Peak',
  'Peninsula','Plain','Plateau','Reaches','Ridge','Rift','Ruin','Shelf',
  'Shore','Slope','Sprawl','Steppe','Swamp','Tangle','Tomb','Valley',
  'Waste','Weald','Wood',
];

export function generatePlaceName() {
  if (Math.random() < 0.4) return generateTownName();
  const style = Math.floor(Math.random() * 2);
  if (style === 0) return `The ${pick(PLACE_ADJ)} ${pick(PLACE_NOUN)}`;
  return `${pick(PLACE_ADJ)} ${pick(PLACE_NOUN)}`;
}

// ── Creature names ────────────────────────────────────────────────────────────

const CREATURE_STARTS = [
  'Alder','Bark','Barrow','Bog','Bone','Bram','Briar','Burrow',
  'Cinder','Clay','Crag','Dark','Deep','Dusk','Dust','Ember',
  'Fen','Field','Flint','Frost','Gale','Glen','Gloom','Gnaw',
  'Grim','Grove','Hollow','Iron','Mire','Mist','Moat','Moss',
  'Mud','Night','Rain','Reed','River','Rock','Root','Rush',
  'Salt','Shade','Silt','Slate','Smoke','Snag','Stone','Storm',
  'Thorn','Timber','Vale','Vine','Wallow','Web','Wind','Wood',
];

const CREATURE_ENDS = [
  'back','beak','belly','bite','brow','claw','coat','crawl',
  'creep','fang','fin','foot','gill','grub','hide','hook',
  'horn','hound','jaw','mane','maw','moth','muzzle','neck',
  'paw','scale','shell','skin','snout','spine','stalk','tail',
  'thorn','tooth','track','tread','tusk','veil','worm','wrap',
];

export function generateCreatureName() {
  return pick(CREATURE_STARTS) + pick(CREATURE_ENDS);
}

// ── Lore / concept names ──────────────────────────────────────────────────────

const LORE_ADJ = [
  'Ancient','Ashen','Binding','Bitter','Black','Blind','Broken','Buried',
  'Cold','Common','Dark','Dead','Deep','Distant','Fallen','Fading',
  'Final','First','Forgotten','Grey','Hidden','High','Hollow','Last',
  'Lost','Low','Old','Pale','Patient','Quiet','Red','Salt',
  'Second','Silent','Slow','Sunken','True','Unspoken','Wandering','Worn',
];

const LORE_NOUN = [
  'Accord','Age','Annals','Axiom','Binding','Canon','Chronicle','Compact',
  'Covenant','Crossing','Creed','Cycle','Dawn','Decree','Doctrine','Dusk',
  'Edict','End','Era','Fall','Flame','Flood','Founding','Herald',
  'Law','Lament','Legacy','Oath','Omen','Order','Passage','Proclamation',
  'Promise','Prophecy','Rite','Reckoning','Return','Revelation','Rise','Rule',
  'Schism','Seal','Silence','Sundering','Testament','Tide','Trial','Truth',
  'Turning','Vigil','Vow','Warning','Way','Word','Wound',
];

export function generateLoreName() {
  const style = Math.floor(Math.random() * 3);
  if (style === 0) return `The ${pick(LORE_ADJ)} ${pick(LORE_NOUN)}`;
  if (style === 1) return `${pick(LORE_ADJ)} ${pick(LORE_NOUN)}`;
  return `The ${pick(LORE_NOUN)} of ${pick(LORE_ADJ).toLowerCase()} ${pick(LORE_NOUN).toLowerCase()}`;
}

// ── Dispatch ──────────────────────────────────────────────────────────────────

export const GENERATOR_TYPES = [
  { key: 'character', label: 'Character',     fn: generateCharacterName },
  { key: 'town',      label: 'Town',          fn: generateTownName      },
  { key: 'item',      label: 'Item',          fn: generateItemName      },
  { key: 'faction',   label: 'Faction',       fn: generateFactionName   },
  { key: 'place',     label: 'Place',         fn: generatePlaceName     },
  { key: 'creature',  label: 'Creature',      fn: generateCreatureName  },
  { key: 'lore',      label: 'Lore / Concept',fn: generateLoreName      },
];

export function generateName(type) {
  const gen = GENERATOR_TYPES.find(g => g.key === type);
  return gen ? gen.fn() : '';
}
