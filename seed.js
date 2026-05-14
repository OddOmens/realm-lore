import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const uuidv4 = () => crypto.randomUUID();

const worldName = 'Sample Data World';
const worldsDir = path.join(process.cwd(), 'Worlds');
const targetWorld = path.join(worldsDir, worldName);

const collections = ['characters','locations','things','lore','factions','creatures','stories','relationships','maps','books','customStamps'];

if (!fs.existsSync(targetWorld)) {
  fs.mkdirSync(targetWorld, { recursive: true });
}

collections.forEach(col => {
  const dir = path.join(targetWorld, col);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function serializeToMd(data, content = '') {
  let frontmatter = '---\n';
  for (const [key, value] of Object.entries(data)) {
    frontmatter += `${key}: ${JSON.stringify(value)}\n`;
  }
  frontmatter += '---\n\n';
  return frontmatter + content;
}

const dataGen = {
  characters: [
    { n: "Elara Moonsinger", d: "A wise elven mage who listens to the stars." },
    { n: "Kaelen Ironheart", d: "A stoic dwarven warrior with a legendary axe." },
    { n: "Thalion the Swift", d: "A rogue who can outrun an arrow." },
    { n: "Lyra Valerius", d: "A noble knight pledged to protect the realm." },
    { n: "Gorian the Red", d: "A fierce barbarian chieftain from the northern wastes." },
    { n: "Seraphina Dawn", d: "A cleric of the sun god with healing hands." },
    { n: "Vaelin Sorvyn", d: "A mysterious ranger who travels alone." },
    { n: "Bram Tumblebelly", d: "A halfling bard with a penchant for trouble." },
    { n: "Aria Nightshade", d: "An assassin with a code of honor." },
    { n: "Darius Thorne", d: "A corrupt noble seeking the throne." },
    { n: "Sylvana Windrunner", d: "An elven general who never lost a battle." },
    { n: "Kor'gar", d: "An orc shaman with visions of the future." },
    { n: "Elias Vance", d: "A merchant who trades in secrets." },
    { n: "Lady Isolde", d: "The exiled queen of a forgotten kingdom." },
    { n: "Fenrir Bloodfang", d: "A werewolf trying to control his curse." },
    { n: "Malakor", d: "A dark sorcerer seeking ancient relics." },
    { n: "Tessa Vane", d: "A young apprentice eager to prove herself." },
    { n: "Balthazar", d: "An eccentric inventor of clockwork contraptions." },
    { n: "Rowan Ashwood", d: "A druid who protects the ancient groves." },
    { n: "Captain Morgana", d: "A pirate queen who rules the inner sea." },
    { n: "Orik Stonebreaker", d: "A dwarven smith who forged the king's sword." },
    { n: "Lilith", d: "A succubus who fell in love with a mortal." },
    { n: "Caelum", d: "An angelic being trapped on the mortal plane." },
    { n: "Grimm", d: "A bounty hunter who never misses his mark." },
    { n: "Anya Frost", d: "An ice mage from the frozen peaks." },
    { n: "Tobias", d: "A humble farmer destined for greatness." },
    { n: "Selene", d: "A moon priestess with prophetic visions." },
    { n: "Draven", d: "A vampire lord who controls the underworld." },
    { n: "Gideon", d: "A paladin who fell from grace." },
    { n: "Mira", d: "A street urchin with a hidden magical talent." }
  ],
  locations: [
    { n: "The Whispering Woods", d: "A dense forest where the trees seem to murmur secrets." },
    { n: "Mount Doom", d: "A towering volcano that spews ash and fire." },
    { n: "The Silver City", d: "The capital of the elven kingdom, built from gleaming stone." },
    { n: "Dragon's Peak", d: "A perilous mountain home to ancient wyrms." },
    { n: "The Sunken Ruins", d: "The remnants of a lost civilization beneath the sea." },
    { n: "Ironhold", d: "An impenetrable dwarven fortress carved into the mountainside." },
    { n: "The Shadow Marches", d: "A swampy region filled with dangerous creatures." },
    { n: "Crystal Cave", d: "A cavern illuminated by glowing crystals." },
    { n: "The Golden Plains", d: "Vast grasslands where nomadic tribes roam." },
    { n: "Blackrock Keep", d: "A forbidding castle ruled by a tyrant." },
    { n: "The Silent Wastes", d: "A barren desert where no life can survive." },
    { n: "Eldoria", d: "A prosperous kingdom known for its magical academies." },
    { n: "The Frozen Tundra", d: "A harsh, icy landscape inhabited by frost giants." },
    { n: "Mistveil Island", d: "An island shrouded in eternal fog." },
    { n: "The Crimson Valley", d: "A valley named for the blood spilled in ancient battles." },
    { n: "Stormwatch Tower", d: "An ancient lighthouse that guides ships through treacherous waters." },
    { n: "The Forgotten City", d: "A ruined city hidden deep in the jungle." },
    { n: "Obsidian Spire", d: "A tower made entirely of black glass." },
    { n: "The Azure Lake", d: "A crystal-clear lake with healing properties." },
    { n: "Grimoire Library", d: "The largest collection of magical texts in the world." },
    { n: "The Hollow Hills", d: "A series of rolling hills covering ancient tombs." },
    { n: "Raven's Roost", d: "A small village perched on the edge of a cliff." },
    { n: "The Weeping Falls", d: "A waterfall that is said to be the tears of a goddess." },
    { n: "Serpent's Pass", d: "A narrow, winding mountain road." },
    { n: "The Emerald Grove", d: "A sacred forest protected by druids." },
    { n: "Cinder City", d: "A city built on the edge of an active volcano." },
    { n: "The Shimmering Sands", d: "A desert where the sand sparkles like gold." },
    { n: "Bone-picker's Canyon", d: "A dangerous gorge filled with scavengers." },
    { n: "The Starfall Crater", d: "The site where a meteorite crashed centuries ago." },
    { n: "Haven", d: "A sanctuary for those fleeing the war." }
  ],
  things: [
    { n: "The Sword of Light", d: "A legendary blade that glows in the presence of evil." },
    { n: "Elven Cloak", d: "A garment that blends seamlessly with its surroundings." },
    { n: "Healing Potion", d: "A crimson liquid that mends wounds instantly." },
    { n: "Staff of the Magi", d: "An ancient staff crackling with arcane power." },
    { n: "Dragon Scale Armor", d: "Impenetrable armor forged from the scales of a red dragon." },
    { n: "The One Ring", d: "A plain gold ring that grants invisibility but corrupts the soul." },
    { n: "Amulet of Yendor", d: "A mythical artifact said to grant ultimate power." },
    { n: "Boots of Speed", d: "Enchanted boots that allow the wearer to run like the wind." },
    { n: "Bag of Holding", d: "A small pouch that can hold an infinite amount of items." },
    { n: "Phoenix Feather", d: "A glowing feather that can resurrect the dead." },
    { n: "Crystal Ball", d: "A sphere used for scrying and predicting the future." },
    { n: "Wand of Fireballs", d: "A simple wooden wand that unleashes explosive magic." },
    { n: "Mithril Shirt", d: "A lightweight shirt of chainmail that is harder than steel." },
    { n: "Potion of Invisibility", d: "A clear liquid that renders the drinker unseen." },
    { n: "Ring of Protection", d: "A magical ring that deflects attacks." },
    { n: "Tome of Knowledge", d: "A book that contains all the secrets of the universe." },
    { n: "Excalibur", d: "The sword in the stone, destined for the true king." },
    { n: "Magic Carpet", d: "An ornate rug that can fly through the air." },
    { n: "Vorpal Sword", d: "A fearsome blade that easily severs heads." },
    { n: "Philosopher's Stone", d: "An alchemical substance that turns lead into gold." },
    { n: "Goggles of Night", d: "Lenses that grant the ability to see in complete darkness." },
    { n: "Decanter of Endless Water", d: "A flask that pours an infinite stream of fresh water." },
    { n: "Chime of Opening", d: "A small bell that unlocks any door or chest." },
    { n: "Horn of Valhalla", d: "A horn that summons spectral warriors to fight for you." },
    { n: "Cape of the Mountebank", d: "A cloak that allows the wearer to teleport in a puff of smoke." },
    { n: "Gauntlets of Ogre Power", d: "Iron gloves that grant immense physical strength." },
    { n: "Helm of Telepathy", d: "A helmet that allows the wearer to read minds." },
    { n: "Robe of the Archmagi", d: "A garment that enhances magical abilities." },
    { n: "Sphere of Annihilation", d: "A hole in the universe that destroys anything it touches." },
    { n: "Slippers of Spider Climbing", d: "Footwear that allows the wearer to walk on walls and ceilings." }
  ],
  lore: [
    { n: "The Great War", d: "A devastating conflict that tore the world apart centuries ago." },
    { n: "The Sundering", d: "The cataclysmic event that split the continents." },
    { n: "The First Age", d: "A mythical time when gods walked the earth." },
    { n: "The Fall of Eldoria", d: "The tragic destruction of the greatest magical kingdom." },
    { n: "The Dragon Wars", d: "A series of battles between humans and dragons for supremacy." },
    { n: "The Prophecy of the Chosen One", d: "A foretelling of a hero who will save the world from darkness." },
    { n: "The Discovery of Magic", d: "The moment when mortals first learned to harness arcane power." },
    { n: "The Founding of Ironhold", d: "The tale of how the dwarves carved their greatest fortress." },
    { n: "The Curse of the Werewolf", d: "The tragic origin of the lycanthrope affliction." },
    { n: "The Rise of the Necromancer", d: "The dark history of a sorcerer who sought immortality." },
    { n: "The Treaty of the Silver City", d: "The fragile peace agreement between elves and men." },
    { n: "The Legend of the Starfall", d: "A myth about a meteor that brought magic to the world." },
    { n: "The Age of Heroes", d: "A time when legendary figures performed impossible deeds." },
    { n: "The Secret of the Whispering Woods", d: "The truth behind the voices heard in the ancient forest." },
    { n: "The Betrayal of the Knights", d: "The story of how a noble order fell to corruption." },
    { n: "The Creation of the World", d: "The creation myth of how the universe came to be." },
    { n: "The Day of the Eclipse", d: "A dark day when the sun was blotted out and evil reigned." },
    { n: "The Journey to the Underworld", d: "A tale of a hero who traveled to the realm of the dead." },
    { n: "The Awakening of the Titans", d: "The return of ancient, powerful beings." },
    { n: "The Lost Fleet", d: "The mystery of an armada that vanished without a trace." },
    { n: "The Plague of Shadows", d: "A magical disease that turned its victims into wraiths." },
    { n: "The Song of the Sirens", d: "A dangerous melody that lures sailors to their doom." },
    { n: "The Enigma of the Sphinx", d: "A riddle that has stumped scholars for centuries." },
    { n: "The Pact of Blood", d: "A dark agreement made between mortals and demons." },
    { n: "The Miracle of the Azure Lake", d: "The story of how the healing waters were blessed." },
    { n: "The Rebellion of the Slaves", d: "The uprising that overthrew a tyrannical empire." },
    { n: "The Voyage of the Explorer", d: "The chronicles of the first person to sail around the world." },
    { n: "The Tale of the Two Brothers", d: "A tragic story of sibling rivalry that ended in war." },
    { n: "The Mystery of the Crystal Cave", d: "The unexplainable phenomena occurring within the glowing caverns." },
    { n: "The Legacy of the Archmage", d: "The powerful artifacts and spells left behind by a master wizard." }
  ],
  factions: [
    { n: "The Knights of the Silver Rose", d: "A noble order dedicated to justice and protecting the innocent." },
    { n: "The Thieves Guild", d: "A secret organization that controls the city's underworld." },
    { n: "The Mage's Circle", d: "An elite group of magic users who regulate the use of arcane power." },
    { n: "The Dark Brotherhood", d: "A cult of assassins who worship the god of death." },
    { n: "The Ironclad Mercenaries", d: "A highly trained company of soldiers for hire." },
    { n: "The Emerald Enclave", d: "A faction of druids and rangers who protect nature." },
    { n: "The Crimson Dawn", d: "A revolutionary group seeking to overthrow the monarchy." },
    { n: "The Merchant's Consortium", d: "A powerful trading guild that controls the economy." },
    { n: "The Order of the Radiant Sun", d: "A religious sect devoted to the sun god." },
    { n: "The Shadow Syndicate", d: "A mysterious network of spies and informants." },
    { n: "The Dwarven clans of Ironhold", d: "A loose alliance of proud and stubborn dwarven families." },
    { n: "The Elven Court of the Silver City", d: "The elegant and often aloof rulers of the elven kingdom." },
    { n: "The Barbarian Tribes of the North", d: "Fierce warriors who value strength and honor." },
    { n: "The Pirate Lords of the Inner Sea", d: "A chaotic coalition of pirate captains." },
    { n: "The Cult of the Dragon", d: "Fanatics who believe dragons should rule the world." },
    { n: "The Seekers of Knowledge", d: "Scholars and explorers dedicated to uncovering ancient secrets." },
    { n: "The Brotherhood of Steel", d: "A technological cult that hoards pre-war artifacts." },
    { n: "The Rebel Alliance", d: "A ragtag group fighting against an evil empire." },
    { n: "The Jedi Order", d: "Peacekeepers who use the Force for good." },
    { n: "The Sith", d: "Dark side users who seek power and control." },
    { n: "The Night's Watch", d: "An order sworn to guard the realm from threats beyond the wall." },
    { n: "The Faceless Men", d: "A guild of assassins capable of changing their appearance." },
    { n: "The Golden Company", d: "A renowned and expensive mercenary company." },
    { n: "The Harpers", d: "A semi-secret organization dedicated to preserving historical lore." },
    { n: "The Zhentarim", d: "A mercenary company with a sinister reputation." },
    { n: "The Lord's Alliance", d: "A coalition of rulers from various cities and towns." },
    { n: "The Order of the Gauntlet", d: "A righteous group dedicated to fighting evil." },
    { n: "The Pathfinders", d: "Explorers who map uncharted territories." },
    { n: "The Inquisitors", d: "A zealous group that hunts down heretics and rogue magic users." },
    { n: "The Silent Sisters", d: "An order of women sworn to silence who tend to the dead." }
  ],
  creatures: [
    { n: "Goblins", d: "Small, malicious humanoids that often attack in swarms." },
    { n: "Dragons", d: "Massive, winged reptiles capable of breathing fire." },
    { n: "Griffons", d: "Majestic beasts with the body of a lion and the head and wings of an eagle." },
    { n: "Dire Wolves", d: "Enormous and fiercely territorial wolves." },
    { n: "Trolls", d: "Large, brutish creatures that regenerate from almost any wound." },
    { n: "Orcs", d: "Savage humanoids known for their prowess in battle." },
    { n: "Unicorns", d: "Magical horses with a single horn, known for their purity." },
    { n: "Manticores", d: "Terrifying monsters with a lion's body, a human face, and a scorpion's tail." },
    { n: "Basilisks", d: "Serpent-like creatures whose gaze can turn victims to stone." },
    { n: "Wyverns", d: "Two-legged dragons with a venomous stinger on their tail." },
    { n: "Gargoyles", d: "Stone statues that come to life to attack intruders." },
    { n: "Vampires", d: "Undead beings who feed on the blood of the living." },
    { n: "Werewolves", d: "Humans cursed to transform into monstrous wolves." },
    { n: "Zombies", d: "Mindless, reanimated corpses." },
    { n: "Skeletons", d: "Animated bones controlled by dark magic." },
    { n: "Ghosts", d: "Restless spirits of the deceased." },
    { n: "Demons", d: "Malevolent entities from the lower planes." },
    { n: "Angels", d: "Divine beings sent to aid mortals." },
    { n: "Elementals", d: "Creatures composed entirely of one of the four elements." },
    { n: "Golems", d: "Constructs made of clay, stone, or iron, animated by magic." },
    { n: "Chimeras", d: "Monstrous hybrids combining parts of a lion, goat, and dragon." },
    { n: "Hydras", d: "Multi-headed serpents that grow two heads for every one severed." },
    { n: "Krakens", d: "Gigantic sea monsters that terrorize sailors." },
    { n: "Phoenixes", d: "Mythical birds that burst into flames and are reborn from their ashes." },
    { n: "Sphinxes", d: "Wise creatures with a lion's body and a human head, known for their riddles." },
    { n: "Minotaurs", d: "Beasts with the head of a bull and the body of a man, often found in labyrinths." },
    { n: "Centaurs", d: "Proud creatures with the upper body of a human and the lower body of a horse." },
    { n: "Mermaids", d: "Aquatic beings with the upper body of a human and the tail of a fish." },
    { n: "Pegasi", d: "Winged horses known for their speed and grace." },
    { n: "Slimes", d: "Amorphous, acidic blobs that dissolve anything they touch." }
  ]
};

for (const [col, items] of Object.entries(dataGen)) {
  for (let i = 0; i < items.length; i++) {
    const id = uuidv4();
    const item = {
      id,
      name: items[i].n,
      shortDescription: items[i].d,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      tags: ['sample', 'fantasy', col],
      status: 'Published'
    };
    const content = `## Background\n\nThis is the detailed lore entry for **${items[i].n}**.\n\n${items[i].d}\n\n*This record was generated to help test the realm builder app.*`;
    
    const mdString = serializeToMd(item, content);
    fs.writeFileSync(path.join(targetWorld, col, `${id}.md`), mdString, 'utf-8');
  }
  console.log(`Finished generating 30 ${col}.`);
}

console.log('Real-looking data generation complete!');
