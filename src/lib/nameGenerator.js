// ── Name generation library ───────────────────────────────────────────────────

import { ADJECTIVES, NOUNS, TOWN_PREFIXES, TOWN_SUFFIXES, TAVERN_NOUNS, SHIP_ADJECTIVES, SHIP_NOUNS, DEITY_DOMAINS } from './names/worldData';
import * as CHAR_DATA from './names/characterData';


const pick  = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cap   = (s)   => s.charAt(0).toUpperCase() + s.slice(1);
const maybe = (p)   => Math.random() < p;

// ─────────────────────────────────────────────────────────────────────────────
// CHARACTER NAMES — Race-Specific
// ─────────────────────────────────────────────────────────────────────────────

// ── Human (Fantasy) ──────────────────────────────────────────────────────────
// Diverse cultural mix: medieval European, Slavic, Celtic, Mediterranean

const HUMAN_FIRST_MALE = [
  // English/Germanic
  'Aldric','Edmund','Gareth','Hadwin','Leofric','Oswin','Roderick','Wulfric',
  'Baldwin','Conrad','Dietmar','Gerhard','Hartmann','Ingolf','Klaus','Ludwig',
  'Markus','Norbert','Otmar','Raimund','Siegfried','Theodor','Ulrich','Volker',
  // Celtic/Gaelic
  'Brennan','Callum','Declan','Eoghan','Fergus','Gillan','Hamish','Iain',
  'Keiran','Lorcan','Murdoch','Niall','Oisin','Padraig','Rourke','Seamus',
  'Tiegan','Urien','Vasco','Wyn',
  // Slavic
  'Bogdan','Dragomir','Goran','Kazimir','Ladislav','Miroslav','Radovan','Slavko',
  'Tomasz','Vladek','Zbigniew','Zoran',
  // Mediterranean / Southern
  'Adriano','Benedikt','Cesare','Dario','Emilio','Fabrizio','Giacomo','Iacopo',
  'Luca','Marco','Nicolo','Orlando','Pietro','Renato','Silvio','Tomas',
  // Simple/timeless
  'Aaron','Bram','Cole','Drake','Ethan','Felix','Grant','Hugo',
  'Ivan','Jasper','Kade','Leon','Miles','Nash','Owen','Pierce',
  'Quinn','Reid','Seth','Trent','Uri','Vance','Wade','Xander',
];

const HUMAN_FIRST_FEMALE = [
  // English/Germanic
  'Alditha','Beatrix','Cecily','Edwina','Frieda','Greta','Hedwig','Ingrid',
  'Johanna','Katerina','Liselotte','Mathilde','Norberta','Ottilie','Roswitha',
  'Sigrid','Thea','Ulrika','Veronika','Walburga',
  // Celtic/Gaelic
  'Aoife','Brigid','Caoimhe','Deirdre','Eithne','Fionnuala','Grainne',
  'Iseult','Keely','Maeve','Niamh','Orla','Roisin','Saoirse','Siobhan','Una',
  // Slavic
  'Bozena','Dagmara','Halina','Jadwiga','Kasia','Ludmila','Milena',
  'Natasha','Petra','Ruzena','Svetlana','Tatiana','Zuzanna',
  // Mediterranean / Southern
  'Alessia','Bianca','Camilla','Daria','Elena','Fiora','Ginevra',
  'Isabella','Leonora','Mirela','Natalia','Oriana','Portia','Rossana','Sofia',
  // Simple/timeless
  'Ada','Brea','Cara','Delia','Eva','Faye','Grace','Hanna',
  'Iris','Jana','Kara','Lyra','Mara','Nova','Opal','Petra',
  'Quinn','Rosa','Sera','Tara','Uma','Vera','Wren','Zara',
];

const HUMAN_SURNAMES = [
  // Nature compound
  'Ashwood','Blackmoor','Brentfield','Coldbrook','Darkwater','Dawnfield',
  'Eastmere','Edgewood','Emberford','Fairstone','Ferndale','Flintwood',
  'Glenmore','Goldmere','Greystone','Grimholt','Halfmoor','Harrowgate',
  'Highfield','Hillcrest','Ironvale','Ivywood','Kestrel','Lakewood',
  'Longmere','Marshford','Millhaven','Mistwood','Moorfield','Nighthollow',
  'Oakdale','Oldshore','Pinecrest','Quarry','Ravenscroft','Redmoor',
  'Riverstone','Saltmarsh','Sandhollow','Shadowmere','Silverbrook',
  'Slateholm','Stonewall','Swanmere','Thorndale','Tinwood','Vanecroft',
  'Waterford','Whitestone','Windhollow','Wolfcrest','Woodhaven','Yarrowdale',
  // Occupational / descriptive
  'Archer','Baker','Chandler','Cooper','Fletcher','Fisher','Forger','Harper',
  'Hunter','Mason','Miller','Piper','Potter','Sawyer','Smith','Tanner',
  'Thatcher','Turner','Weaver','Wheeler',
  // Single-word strong
  'Bastian','Crane','Drake','Falke','Holt','Krane','Marsh','Rowe',
  'Stone','Thorne','Vane','Ward','Wolfe','Yates',
];

function generateHumanName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(HUMAN_FIRST_MALE) : pick(HUMAN_FIRST_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(HUMAN_SURNAMES)}`;
  
  const useSurname = maybe(0.6);
  return useSurname ? `${first} ${pick(HUMAN_SURNAMES)}` : first;
}

// ── Elf ───────────────────────────────────────────────────────────────────────
// Flowing, melodic, elvish feel — long vowel chains, soft consonants

const ELF_STARTS = [
  'Ael','Aer','Aev','Aiel','Ain','Air','Aith',
  'Cal','Cael','Caer','Cair','Cel','Cir',
  'Dal','Del','Dil','Dor','Drin','Dwyn',
  'Eil','Ela','Eli','Ell','Elw','Elv','Elyv',
  'Fael','Fal','Far','Fer','Fil','Fir','Flyn',
  'Gal','Gael','Gar','Gel','Gil','Glen','Gor','Gwen',
  'Hal','Han','Hav','Hel','Hen','Her',
  'Ial','Iel','Iil','Ilan','Ile','Ili','Ilu','Ilw',
  'Kal','Kael','Kaer','Kel','Ker','Kil','Kir',
  'Lael','Lal','Lar','Lav','Lel','Len','Lir','Lor','Lyr',
  'Mael','Mal','Mar','Mel','Mir','Mor','Myr',
  'Nael','Nal','Nar','Nel','Ner','Nil','Nir','Nor',
  'Oril','Oryn','Osel',
  'Phal','Pir','Pren',
  'Rael','Ral','Ran','Rel','Ren','Riel','Rin','Ryn',
  'Sael','Sal','Sel','Ser','Sev','Sil','Sir','Sol','Syr',
  'Tael','Tal','Tel','Ter','Tiel','Til','Tir','Tor','Tyr',
  'Vael','Val','Vel','Vil','Vor','Vyr',
  'Wael','Wen','Wil','Wyn',
  'Xael','Xar','Xel','Xen',
  'Yael','Yel','Yin','Yor',
  'Zael','Zel','Zen','Zil',
];

const ELF_MIDS = [
  'a','e','i','o','ae','ai','ei','ie','ia',
  'ara','ela','ira','ora','ura',
  'ael','iel','uel','oel',
  'ath','eth','ith',
  'avel','orel','iren','irel',
  'and','end','ind','ond',
  'alin','elin','ilin','olin',
  'ander','andre','endra',
  'avar','ever','ivar','ovar',
];

const ELF_ENDS = [
  // Soft/feminine
  'a','e','ia','ea','iel','ael','ara','era','ira','ora',
  'avel','orel','awyn','ewyn','iwyn',
  'alin','elin','ilin','olin','ulin',
  'ani','ini','ori','uri',
  // Neutral
  'an','en','in','on','yn',
  'ar','er','ir','or','ur',
  'ath','eth','ith','oth',
  'ael','iel','uel',
  // Strong/masculine
  'orn','ald','ard','ell','ill',
  'ander','indar','ondel',
  'aryn','eryn','iryn','oryn',
  'amir','emir','imir',
  'dor','nor','thar','thel','niel','riel',
];

const ELF_SURNAMES = [
  // Nature + elvish suffixes
  'Aelindra','Aldrathal','Arenthis','Brightleaf','Caladwen','Crystalmere',
  'Dawnwhisper','Duskveil','Eldrinthal','Elenmir','Emberbough','Evensong',
  'Faladrin','Featherwind','Galindrel','Galadwen','Goldenbough','Haliryn',
  'Iladren','Ivymantle','Kaelithar','Leafsong','Lirindel','Longroot',
  'Moralind','Moonwhisper','Narithal','Nightveil','Orindel','Raladwen',
  'Riverchant','Seladrin','Shadowleaf','Silverwind','Silverthorn',
  'Starweave','Stormveil','Sunwhisper','Thalindel','Thornweave',
  'Tirelindel','Vaelithar','Vinesong','Whisperwind','Woodsong',
];

const ELF_EPITHETS = [
  'of the Silver Wood','of the Dawn Court','of the Ancient Grove',
  'Starweaver','Moonwalker','Dawnborn','Silverleaf','Goldenbrow',
  'the Eldest','the Ageless','the Dreaming','the Far-Sighted',
  'Swiftarrow','Trueshot','Windstep','the Silent',
];

function generateElfName(options = {}) {
  const style = Math.floor(Math.random() * 4);
  let first;
  if (style === 0) first = cap(pick(ELF_STARTS).toLowerCase() + pick(ELF_MIDS) + pick(ELF_ENDS));
  else if (style === 1) first = cap(pick(ELF_STARTS).toLowerCase() + pick(ELF_ENDS));
  else if (style === 2) first = pick(ELF_STARTS) + pick(ELF_MIDS);
  else first = cap(pick(ELF_STARTS).toLowerCase() + pick(ELF_MIDS) + pick(ELF_MIDS) + pick(ELF_ENDS));

  if (maybe(0.08) && first.length > 5) {
    const mid = Math.floor(first.length / 2);
    first = first.slice(0, mid) + "'" + first.slice(mid);
  }

  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(ELF_SURNAMES)}`;

  if (maybe(0.45)) return `${first} ${pick(ELF_SURNAMES)}`;
  if (maybe(0.1))  return `${first} ${pick(ELF_EPITHETS)}`;
  return first;
}

// ── Dwarf ─────────────────────────────────────────────────────────────────────
// Short, punchy, hard consonants, clan names

const DWARF_FIRST_MALE = [
  'Aldur','Balin','Bofur','Bombur','Bram','Brokkr','Brom',
  'Dagnar','Dolgrin','Dorin','Dorn','Draven','Drok','Drugar','Durgin','Durgin',
  'Farin','Fjord','Flint','Fori','Fundin',
  'Garin','Gauss','Gimli','Gloin','Gorlin','Groin','Grum',
  'Haldor','Hammar','Hanar','Hann','Harin','Hjor','Holm','Hrolf','Hrunda',
  'Ingvar','Ivar',
  'Jorn','Jorin',
  'Kain','Kalin','Kargrim','Kili','Korin','Krag','Krauss',
  'Lodin','Lofar','Lorin',
  'Magnar','Morin','Morn',
  'Nain','Nori',
  'Odvar','Ofin','Onar','Ori',
  'Ragnar','Ragnur','Rok','Rorik','Runar',
  'Sigmar','Sindri','Skardin','Skor','Snaer','Snorri','Stonn',
  'Thordan','Thordak','Thordin','Thork','Thorin','Thorkell','Thornin','Thurdin',
  'Ulvar','Ulfar',
  'Valgur','Vardin','Varin','Volur',
];

const DWARF_FIRST_FEMALE = [
  'Aldis','Astrid','Bergit','Bryn','Dagna','Dis','Dura',
  'Edda','Embla','Erna',
  'Fina','Frida','Frigga','Fulla',
  'Gerd','Ginna','Gro','Gudrid','Gunna',
  'Hilda','Hilde','Holda','Hulda',
  'Ingrid','Idunn',
  'Kira','Kolga','Kruna',
  'Lina','Lofn',
  'Magna','Marta','Milda','Minna','Moira',
  'Nora','Norna',
  'Oda','Otta',
  'Ragna','Runa','Rundi',
  'Sigrid','Signy','Sigrun','Sigryn','Skadi','Skuld',
  'Thora','Thoris','Thyra',
  'Ulfhild','Urd','Unn',
  'Vardis','Vigdis',
];

const DWARF_CLAN_NAMES = [
  // Metal/stone
  'Anvilborn','Axebeard','Blackstone','Boulderback','Brasshammer',
  'Bronzeback','Coppermantle','Darkstone','Deepstone','Diamondpick',
  'Duskrock','Flinthammer','Gemcutter','Goldbeard','Graniteback',
  'Graystone','Grimstone','Ironback','Ironbeard','Ironborn',
  'Ironforge','Ironhand','Ironmantle','Ironpick','Ironshield',
  'Marbletoe','Metalborn','Orebrow','Rockback','Roughstone',
  'Rubyborn','Shaleborn','Silveraxe','Silverbeard','Slateborn',
  'Steelmantle','Stoneback','Stoneborn','Stonefist','Stonefoot',
  'Tinborn','Topazback',
  // Weapon-themed
  'Axebreaker','Battleborn','Bladeback','Bonebreaker','Greataxe',
  'Hammerfall','Hammerfist','Hammerhand','Shieldborn','Warborn',
  // Underground
  'Cavedigger','Deepdelver','Deepearth','Deepmine','Deeprock',
  'Goldvein','Mineshaft','Oreborn','Tunnelborn','Veinborn',
];

function generateDwarfName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(DWARF_FIRST_MALE) : pick(DWARF_FIRST_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(DWARF_CLAN_NAMES)}`;

  if (maybe(0.75)) return `${first} ${pick(DWARF_CLAN_NAMES)}`;
  const parent = gender === 'male' ? pick(DWARF_FIRST_MALE) : pick(DWARF_FIRST_FEMALE);
  if (maybe(0.3)) return `${first} ${parent}${maybe(0.5) ? 'son' : 'dottir'}`;
  return first;
}

// ── Gnome ─────────────────────────────────────────────────────────────────────
// Whimsical, playful, often with compound flair or alliterative feel

const GNOME_FIRST_MALE = [
  'Alston','Baren','Bent','Bilbur','Bink','Bizzle','Bobbin','Boffo',
  'Bogle','Braxle','Bumble','Burlen',
  'Calculus','Capper','Chiswick','Clank','Clatter','Clicket',
  'Dabble','Dazzle','Dimble','Dingle','Dinkle','Dodger',
  'Fangle','Farble','Fiddle','Figwit','Fingle','Fizz','Fizzwick',
  'Flax','Flicker','Flint','Flop','Flubber','Fuddle','Fumble',
  'Gadget','Gallix','Garble','Gibble','Gimble','Gizmo','Glibber',
  'Gobbet','Gockel','Goggle','Gorble','Gremble','Gribble',
  'Haggle','Hamble','Hinkle','Hobble','Hoopla','Hopple',
  'Iggle','Inkle',
  'Jangle','Jiggle','Jimble','Jingle','Jitter','Jumble',
  'Kettle','Kibble','Kinkle','Knobble',
  'Lemble','Lickle','Liggle','Lingle',
  'Muddle','Mumble','Mundle',
  'Nibble','Ninkle','Noodle',
  'Ogle','Oggle','Oinkle',
  'Pebble','Pickle','Pimble','Pingle','Pip','Pipple','Pixle',
  'Puddle','Pumble','Putter',
  'Quibble','Quirk','Quizzle',
  'Ramble','Rankle','Rattle','Remble','Riddle','Rinkle',
  'Scrabble','Scriffle','Scuttle','Shimmer','Shinkle','Sizzle',
  'Skitter','Skribble','Sniggle','Sprocket','Squibble','Squiggle',
  'Tangle','Tickle','Timbrel','Tinkle','Toggle','Topple','Trickle',
  'Twinkle','Twitch',
  'Waggle','Wiggle','Wibble','Wimble','Winkle',
  'Yimble','Yinkle',
  'Zibble','Ziffle','Zingle','Zipple','Zizzle',
];

const GNOME_FIRST_FEMALE = [
  'Bella','Bibble','Bickle','Bimble','Bingle','Bippie',
  'Callie','Caper','Chibble','Chime','Chimble','Chirp','Cibble',
  'Dabble','Daffy','Dazzle','Dibble','Dimple','Dindle','Doodle',
  'Fable','Fancy','Fidget','Fimble','Fingle','Fizzie',
  'Gable','Giggle','Gimble','Glimmer','Gobble',
  'Hibble','Higgles','Hobble',
  'Imble','Ingle',
  'Jabble','Jibble','Jiggle','Jingle',
  'Kibble','Kinkle','Kittle',
  'Lickle','Liggle','Limbic','Lingle','Lottie',
  'Mibble','Mingle','Mizzle','Mopple',
  'Nibble','Nifty','Nimble','Ninkle','Nipple',
  'Pebble','Perky','Pickle','Pimble','Pippa','Pixie',
  'Quibble','Quirky',
  'Rimble','Ringle','Ripple',
  'Scribble','Shimmer','Shingle','Sizzle','Skiffle',
  'Spangle','Sparkle','Spiggle','Spinkle','Sprinkle',
  'Tangle','Tickle','Tiffany','Timble','Tingle','Tinkle',
  'Twinkle','Twizzle',
  'Wibble','Wiggle','Wimple','Winkle',
  'Yibble','Yingle',
  'Zibble','Ziffle','Zingle','Zinnia','Zipple',
];

const GNOME_SURNAMES = [
  // Compound whimsy
  'Bafflewick','Binglehop','Bobbinwick','Bottlewick','Bumblewick',
  'Clankettle','Clickspring','Cogsworth','Copperkettle','Coppernose',
  'Dingleberry','Dinklewick','Doodlewick',
  'Fiddleback','Finglewick','Fizzlepop','Fizzlewick','Flapjack',
  'Gearwick','Giddlewick','Gizmowick','Gogglewick',
  'Hammerwick','Hinklewick','Hobblewick',
  'Jinglewick','Jumblewick',
  'Kettlewick','Kinglewick',
  'Noodlewick','Nimblewick',
  'Picklewick','Piddlewick','Pimblewick','Pipwick',
  'Rattlewick','Ringlewick',
  'Scrabblewick','Screwloose','Shimmerwick','Sizzlewick',
  'Sprocketwick','Squibblewick','Squigglewick',
  'Thistlewick','Tiddlewick','Tinglewick','Tinklewick',
  'Twiddlewick','Twinklewick',
  'Widdlewick','Wigglewick','Winklewick',
  'Zinglewick','Zipplewick',
];

function generateGnomeName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(GNOME_FIRST_MALE) : pick(GNOME_FIRST_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(GNOME_SURNAMES)}`;

  if (maybe(0.65)) return `${first} ${pick(GNOME_SURNAMES)}`;
  return first;
}

// ── Orc ───────────────────────────────────────────────────────────────────────
// Harsh, guttural, aggressive — war-tribe energy

const ORC_FIRST_MALE = [
  'Agor','Agrax','Aruk',
  'Bagor','Balgur','Barz','Bog','Bolar','Bolg','Bork','Brak','Brol','Bron','Brug','Brul','Brum',
  'Dakka','Darg','Darruk','Drak','Drakh','Drox','Drul','Drum','Durg',
  'Gag','Gar','Garg','Gark','Garm','Garruk','Gash','Gazh','Gnak','Gol','Golar','Gork','Gorlak','Goruk','Grak','Gram','Grank','Grash','Grax','Grek','Grim','Grok','Grom','Gronk','Groth','Grox','Gruk','Grul','Grum',
  'Hakk','Harg','Hark','Harm','Hruk',
  'Jork',
  'Kagar','Karg','Karm','Karruk','Kash','Kaz','Kazh','Knag','Knak','Kol','Kolar','Kork','Korlak','Kor','Koruk','Krak','Kram','Krank','Krash','Krax','Krek','Krim','Krok','Krom','Kronk','Kroth','Krok','Krug',
  'Larg','Lork','Luk',
  'Mak','Marg','Mark','Marm','Mazh','Mor','Morg','Mork','Morlak','Mrak','Mrom','Mrum',
  'Nag','Nak','Narg','Narm','Naz','Nor','Norg','Nork','Noruk',
  'Rag','Rarg','Rark','Rash','Rax','Rek','Rok','Rom','Ronk','Roth','Rox','Rug',
  'Skar','Skarg','Skarm','Skrag','Skrak','Skram','Skrax','Skrek','Skrog','Skrom','Skronk',
  'Targ','Tark','Tarm','Taz','Tor','Tork','Torlak','Toruk','Trak','Tram','Trank','Trash','Trax','Trek','Trok','Trom','Tronk',
  'Urgok','Urk','Urka','Urko','Urlar','Urmak','Urnak','Urog','Ursh','Uruk',
  'Varg','Vark','Varm','Vaz','Vor','Vorg','Vork','Vorlak','Voruk',
  'Zag','Zarg','Zark','Zarm','Zaz','Zog','Zolar','Zork','Zorlak','Zoruk','Zrak','Zram','Zrank','Zrash','Zrax','Zrek','Zrog','Zrom','Zronk',
];

const ORC_FIRST_FEMALE = [
  'Agra','Agrax',
  'Bakka','Balgra','Barka','Borra','Brakka','Brasha','Brexa','Broga','Brona','Bruka',
  'Dakka','Darga','Darkha','Draga','Drasha','Droxa','Druga','Druma','Durga',
  'Gaga','Gara','Garka','Garma','Garruka','Gasha','Gazha','Gnaka','Gola','Golara','Gorka','Gorlaka','Goruka','Graka','Grama','Grasha','Grexa','Grima','Groka','Groma','Gronka','Gruxa',
  'Hakka','Harga','Harka','Harma','Hruka',
  'Kaga','Karka','Karma','Karruka','Kasha','Kaza','Kazha','Kola','Kolara','Korka','Korlaka','Koruka','Kraka','Krama','Krasha','Krexa','Krima','Kroka','Kroma','Kronka',
  'Larga','Lorka','Luka',
  'Maka','Marga','Marka','Marma','Mazha','Mora','Morga','Morka','Morlaka','Mraka','Mroma',
  'Naga','Naka','Narga','Narma','Naza','Nora','Norga','Norka','Noruka',
  'Raga','Rarga','Rarka','Rasha','Rexa','Roka','Roma','Ronka','Ruxa',
  'Skara','Skarga','Skarma','Skraga','Skraka','Skrama','Skrexa','Skroga','Skroma',
  'Targa','Tarka','Tarma','Taza','Tora','Torka','Torlaka','Toruka','Traka','Trama','Trasha',
  'Urgoka','Urka','Urko','Urlara','Urmaka','Urnaka','Uroga','Ursha','Uruka',
  'Varga','Varka','Varma','Vaza','Vora','Vorga','Vorka','Vorlaka','Voruka',
  'Zaga','Zarga','Zarka','Zarma','Zaza','Zoga','Zolara','Zorka','Zorlaka','Zoruka',
];

const ORC_TITLES = [
  'Bloodfang','Bonebreaker','Bonecrusher','Darkblade','Deathbringer',
  'Deathmaw','Earthshaker','Facesmasher','Fierceblood','Flameclaw',
  'Gorehand','Gravemaker','Grimtusk','Headtaker','Ironjaw','Ironmaw',
  'Killclaw','Maneater','Meatgrinder','Mudclaw','Ragefist',
  'Redaxe','Ribtaker','Ripperclaw','Rockjaw','Scarface',
  'Shadowbane','Skullbreaker','Skullcleaver','Skulltaker','Slagtusk',
  'Skullmaw','Soulrend','Stonecrusher','Stoneskin','Stormfist',
  'Throatcutter','Thunderfist','Toecrusher','Tombmaker','Tuskborn',
  'Warborn','Warchief','Warmaw','Warsong','Wartooth',
];

const ORC_CLANS = [
  'of the Ashfang Clan','of the Bloodtusk Horde','of the Boneclaw Tribe',
  'of the Darkstone Warband','of the Emberfang Pack','of the Flintjaw Clan',
  'of the Gorehand Horde','of the Grimtusk Tribe','of the Ironfang Warband',
  'of the Mudclaw Clan','of the Ragespine Pack','of the Redfang Horde',
  'of the Scarback Tribe','of the Shadowtusk Warband','of the Skullcleave Clan',
  'of the Stoneback Horde','of the Stormtusk Tribe','of the Thornspine Pack',
  'of the Wartusk Warband','of the Wolfmaw Clan',
];

function generateOrcName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(ORC_FIRST_MALE) : pick(ORC_FIRST_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(ORC_CLANS)}`;

  const roll = Math.random();
  if (roll < 0.35) return `${first} ${pick(ORC_TITLES)}`;
  if (roll < 0.55) return `${first} ${pick(ORC_CLANS)}`;
  return first;
}

// ── Halfling ──────────────────────────────────────────────────────────────────
// Warm, cozy, English countryside — Tolkien-esque

const HALFLING_FIRST_MALE = [
  'Alton','Ander','Andry','Auggie','Barnaby',
  'Bells','Benny','Bibo','Bilbo','Bingo','Binky','Bobwise',
  'Cade','Callum','Cam','Carlo','Cob','Cork',
  'Danby','Danwise','Denny','Dewey',
  'Erbo','Ernie',
  'Fatty','Filo','Finn','Flimby','Florin','Frodo',
  'Garby','Gerry','Gilbo','Gobbo','Gordy',
  'Hamble','Hammy','Hamwise','Harrold','Harvey','Hobble',
  'Iggy',
  'Jasper','Jeb','Jelly','Jibb',
  'Larbo','Lenny','Lindy','Lob','Lofty',
  'Marbo','Merry','Milbo','Monty',
  'Napper','Ned','Nibs','Nobby','Nob',
  'Odo','Olbo','Olo','Otho',
  'Pell','Perbo','Peregrin','Perry','Pipbo','Pippin','Polly',
  'Robbo','Rory','Rosco','Rudy',
  'Samwise','Sandy','Sebo','Sigmund','Simbo',
  'Ted','Tobias','Toby','Tom','Tommy',
  'Ubo',
  'Wally','Will','Willo','Wim','Wise',
];

const HALFLING_FIRST_FEMALE = [
  'Amaranth','Andry','Angie',
  'Babs','Bella','Berry','Birdie','Blossom','Bonny',
  'Callie','Cammy','Cora','Corazon',
  'Daisy','Delly','Dolly','Dory',
  'Esme','Essie',
  'Fanny','Fern','Flo','Flora','Flossie',
  'Goldie','Gracie',
  'Hanna','Heather','Holly',
  'Isla',
  'Jasmine','Jeany','Jilly',
  'Lavender','Lily','Lottie','Louella','Lumpy',
  'Maisie','Maple','Marigold','Mary','Matilda','Meadow','Merry','Millie','Molly',
  'Nora','Nelly',
  'Opal',
  'Pansy','Pattie','Pearl','Peony','Petal','Pippa','Plum','Poppy','Primrose',
  'Rosey','Rosie','Ruby','Rue',
  'Sally','Sandy','Sara','Sarafina','Susie',
  'Tilly','Topsy',
  'Vivi','Violet',
  'Wendy','Willow','Winnie',
];

const HALFLING_SURNAMES = [
  // Cozy nature
  'Applebottom','Barleymoor','Berrywick','Birchbottom','Bramblewood',
  'Brightwater','Brownlock','Cherrybank','Cloverdale','Cornfield',
  'Dandelion','Duskmere','Elderberry','Everglade','Fairfox',
  'Fernholm','Fieldwick','Furrowbrook',
  'Goodbarrel','Goodfellow','Goodfoot','Goodhill','Goodmorrow',
  'Greenbriar','Greenfield','Greenholm','Greentoe',
  'Haystack','Hearthwick','Hillfoot','Honeywood',
  'Kettlewick','Kindlewick',
  'Leafmore','Longbottom','Longwick',
  'Maplebottom','Meadowbrook','Millbrook','Milltop','Mosshaven',
  'Mudfoot','Mugwort',
  'Nettlebrook','Nettlewick',
  'Oakhaven','Oakholm',
  'Pebblebottom','Pebbleton','Plumfield','Puddifoot',
  'Ravensworth','Riverwick','Rosebottom','Rosemere',
  'Sandybanks','Saplewood','Shortwick','Sunnyside',
  'Sweetbrook','Sweetholm','Sweethome',
  'Teaberry','Thornwick','Thistledown','Toadstool',
  'Underhill','Underwick',
  'Warmhearth','Wheatfield','Willowwick','Windmill',
];

function generateHalflingName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(HALFLING_FIRST_MALE) : pick(HALFLING_FIRST_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(HALFLING_SURNAMES)}`;

  if (maybe(0.7)) return `${first} ${pick(HALFLING_SURNAMES)}`;
  return first;
}

// ── Tiefling ──────────────────────────────────────────────────────────────────
// Virtue names, infernal-sounding, dramatic

const TIEFLING_VIRTUE_NAMES = [
  // Virtues & vices
  'Ambition','Anguish','Art','Ash','Awe',
  'Bliss','Blood','Boon',
  'Calm','Chaos','Craft','Crime',
  'Damnation','Dark','Dawn','Death','Decay','Deed','Defiance','Desire',
  'Despair','Doom','Dread','Dusk',
  'Enigma','Envy','Error',
  'Fable','Fade','Fallen','Fate','Fault','Fear','Fire','Flaw','Flame','Fury',
  'Glory','Grace','Greed','Grief','Guilt',
  'Havoc','Hope','Horror','Hunger','Hate',
  'Ire',
  'Justice',
  'Lament','Law','Lie','Lore','Loss','Lust',
  'Malice','Mercy','Might','Mirth','Muse',
  'Night','Nightmare',
  'Oath','Oblivion','Omen',
  'Pain','Passion','Penance','Peril','Power','Pride','Punishment',
  'Rage','Ruin','Rune',
  'Scorn','Shame','Silence','Sin','Sorrow','Spite','Storm','Strife',
  'Terror','Torment','Tragedy','Truth',
  'Valor','Vengeance','Vice','Void',
  'War','Woe','Wrath',
  'Zeal',
];

const TIEFLING_INFERNAL_MALE = [
  'Akmenos','Amnon','Barakas','Damakos','Ekemon','Iados','Kairon','Leucis',
  'Melech','Mordai','Morthos','Pelaios','Pyrrhus','Skamos','Therai',
  'Adraxas','Balthazar','Caiphon','Daevos','Exilion','Falthor','Garaxes',
  'Haxan','Ikaris','Jareth','Kaxon','Laertes','Maximus','Nerivar',
  'Oraxis','Phaenos','Raxus','Sevryn','Torkas','Ulcris','Vexor','Xaraxis',
];

const TIEFLING_INFERNAL_FEMALE = [
  'Akta','Bryseis','Criella','Damaia','Ea','Kallista','Lerissa','Makaria',
  'Nemeia','Orianna','Phelaia','Rieta','Skaetha','Tanis','Ulvinia',
  'Vaela','Waeve','Xenara','Yevra','Zeala',
  'Adraxia','Belladra','Cressida','Daevara','Exilia','Falthera','Garaxia',
  'Haxana','Ikara','Jareth','Kaxona','Laertha','Nerivia','Oraxia',
  'Phaenara','Sevryna','Torkasa','Ulcria','Vexoria','Xaraxia',
];

const TIEFLING_SURNAMES = [
  'Ashborn','Ashmantle','Brimstone','Cinderborn','Doomborn','Duskborn',
  'Emberveil','Firescorn','Flameborn','Grimoire','Hellborn','Hellfire',
  'Infernus','Ironshade','Nightborn','Obsidian','Ruinborn','Shadowborn',
  'Soulscorch','Soulveil','Starscorn','Veilborn','Voidborn','Voidcall',
  'Wraithborn','Wrathfire',
];

function generateTieflingName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';

  const style = Math.floor(Math.random() * 3);
  if (style === 0) {
    const virtue = pick(TIEFLING_VIRTUE_NAMES);
    if (options.format === 'first') return virtue;
    if (options.format === 'full') return `${virtue} ${pick(TIEFLING_SURNAMES)}`;
    if (maybe(0.4)) return `${virtue} ${pick(TIEFLING_SURNAMES)}`;
    return virtue;
  }
  const first = gender === 'male' ? pick(TIEFLING_INFERNAL_MALE) : pick(TIEFLING_INFERNAL_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(TIEFLING_SURNAMES)}`;

  if (style === 1 && maybe(0.5)) return `${first} ${pick(TIEFLING_SURNAMES)}`;
  return first;
}

// ── Dragonborn ───────────────────────────────────────────────────────────────
// Draconic-sounding, clan-based, honour-driven

const DRAGONBORN_FIRST_MALE = [
  'Arjhan','Balasar','Bharash','Donaar','Ghesh','Heskan','Kriv',
  'Medrash','Mehen','Nadarr','Pandjed','Patrin','Rhogar','Shamash',
  'Shedinn','Tarhun','Torinn',
  'Adrex','Balakar','Blax','Cravex','Daximus','Draxus','Errux',
  'Faxon','Graxon','Hraxus','Ixar','Jaxon','Kraxon','Laxar',
  'Maxon','Naxar','Oraxon','Praxon','Rraxus','Sraxon','Traxon',
  'Urzax','Vaxon','Wraxon','Xaraxon','Yraxon','Zraxon',
  'Aurak','Bravak','Cravak','Dravak','Eravak','Gravak','Hravak',
  'Iravak','Kravak','Lravak','Mravak','Nravak','Pravak','Rravak',
  'Sravak','Travak','Uravak','Vravak','Xravak','Yravak','Zravak',
];

const DRAGONBORN_FIRST_FEMALE = [
  'Akra','Biri','Daar','Farideh','Harann','Havilar','Jheri',
  'Kava','Korinn','Mishann','Nala','Perra','Raiann','Sora',
  'Surina','Thava','Uadjit',
  'Arxara','Braxara','Craxara','Draxara','Eraxara','Graxara',
  'Hraxara','Iraxara','Kraxara','Lraxara','Mraxara','Nraxara',
  'Praxara','Rraxara','Sraxara','Traxara','Uraxara','Vraxara',
];

const DRAGONBORN_CLANS = [
  'Clethtinthiallor','Daardendrian','Delmirev','Drachedandion',
  'Fenkenkabradon','Kepeshkmolik','Kerrhylon','Kimbatuul',
  'Linxakasendalor','Myastan','Nemmonis','Norixius',
  'Ophinshtalajiir','Prexijandilin','Shestendeliath',
  'Turnuroth','Umbyrphrax','Verthisathurgiesh',
  'Yarjerit',
  // Simpler alternatives
  'Ashscale','Blazewing','Coldbreath','Darkscale','Emberwing',
  'Frostbreath','Goldscale','Grimscale','Ironscale','Jadewing',
  'Obsidianscale','Rubybreath','Shadowscale','Silverbreath',
  'Stonescale','Stormwing','Sunscale','Thunderwing',
];

function generateDragonbornName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(DRAGONBORN_FIRST_MALE) : pick(DRAGONBORN_FIRST_FEMALE);
  
  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(DRAGONBORN_CLANS)}`;

  if (maybe(0.7)) return `${first} ${pick(DRAGONBORN_CLANS)}`;
  return first;
}

// ── Half-Orc ──────────────────────────────────────────────────────────────────
// Mix of human and orc styling

function generateHalfOrcName(options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';

  const style = Math.floor(Math.random() * 3);
  if (style === 0) {
    const first = gender === 'male' ? pick(ORC_FIRST_MALE) : pick(ORC_FIRST_FEMALE);
    if (options.format === 'first') return first;
    return `${first} ${pick(HUMAN_SURNAMES)}`;
  }
  if (style === 1) {
    const first = gender === 'male' ? pick(HUMAN_FIRST_MALE) : pick(HUMAN_FIRST_FEMALE);
    if (options.format === 'first') return first;
    if (options.format === 'full') return `${first} ${pick(HUMAN_SURNAMES)}`;
    return `${first} ${pick(ORC_TITLES)}`;
  }
  return generateOrcName(options);
}

// ── Any (Generic fantasy — the original generator) ────────────────────────────

const CHAR_STARTS = [
  'Aer','Ael','Aev','Ara','Ari','Ash','Ayl','Aza',
  'Bel','Bren','Bri','Byr','Cal','Caer','Cel','Cor','Cyn',
  'Dar','Del','Din','Dor','Drav','Dwyn',
  'Ela','Eld','Eli','Ell','Era','Eri','Eryn',
  'Fal','Far','Fer','Fin','Fir','For','Fyn',
  'Gar','Ged','Gil','Glen','Gor','Gwen',
  'Hal','Han','Har','Hav','Hel','Her',
  'Ila','Ili','Ira','Iri','Isa','Ith',
  'Jar','Jov','Kael','Kal','Kan','Kar','Kel','Ker','Kil','Kir','Kor','Kyr',
  'Lan','Lar','Lav','Len','Lor','Lyr',
  'Mael','Mal','Mar','Mel','Mir','Mor','Myr',
  'Nar','Nel','Ner','Nil','Nor','Nyr',
  'Ori','Orm','Osel',
  'Pell','Per','Pir','Pren',
  'Ral','Ran','Rel','Ren','Riel','Rin','Ror','Ryn',
  'Sel','Ser','Sev','Sil','Sol','Sor','Syr',
  'Tal','Tar','Tel','Ter','Tir','Tor','Tren','Tyr',
  'Ula','Ura','Uri',
  'Vael','Val','Var','Vel','Ver','Vin','Vol','Vor','Vyr',
  'Wen','Wil','Wyn',
  'Xan','Xar','Xen','Xyr',
  'Yar','Yov',
  'Zael','Zan','Zel','Zen','Zil','Zol',
  'Brak','Brod','Bryn','Dag','Dak','Dal','Dran','Drek',
  'Grak','Grel','Grim','Gron',
  'Krag','Kral','Kran','Krek','Kron',
  'Rak','Rok','Roth',
  'Thal','Than','Thar','Thel','Thor','Thyr',
];

const CHAR_MIDS = [
  'a','e','i','o','u','ar','el','en','il','in','or','an','on','un',
  'era','ila','ora','ala','ena','ira','ara','ura','ola','ela',
  'ath','eth','ith','oth','ael','iel','uel','oel',
  'aven','aran','elan','ilor','orin','uvel',
  'ander','endre','orian','illan','arren','orren',
];

const CHAR_ENDS = [
  'a','e','i','o','ia','ea',
  'an','en','in','on','yn','ar','er','ir','or','ur',
  'ara','era','ira','ora','ura','ala','ela','ila','ola','ula',
  'wyn','lin','kin','win','san','ren','den','fen','ton','don',
  'ael','iel','orn','ald','ard','ell','ill','ath','eth','ith',
  'avel','orel','iren','elan','awyn',
  'ax','ix','ox','ak','ek','ik','ok',
  'am','em','im','om','um',
  'ark','erk','irk','ork','ash','esh','ish','osh',
  'ant','ent','int','ont','and','end','ind','ond',
  'ang','eng','ing','ong',
  'ander','indar','ondel','under',
  'aryn','eryn','iryn','oryn',
  'avin','evin','ivin','ovin',
];

const CHAR_EPITHETS = [
  'the Bold','the Quiet','the Wanderer','the Elder','the Younger',
  'the Swift','the Pale','the Fair','the Red','the Black',
  'the Strong','the Wise','the Brave','the Fierce','the Gentle',
  'the Cunning','the Sly','the Pious','the Reckless','the Patient',
  'of the Vale','of the Wood','of the Hills','of the Shore','of the Moors',
  'of the River','of the Mountain','of the Plains','of the Deep','of the North',
  'Farwalker','Ironhand','Dawnborn','Ashwood','Greymoor','Coldwater',
  'Longstride','Stoneback','Darkbrow','Swiftfoot','Brightblade','Grimshaw',
  'Saltmane','Dustborn','Windborn','Starborn','Nightborn','Thornwood',
  'Bladebreaker','Oathkeeper','Heartstone','Bonecaller','Stormcrow',
  'Silvertongue','Blackmantle','Ironjaw','Steeleye','Emberheart',
  'Who Walks Alone','Without a Name','the Last of Their Line',
  'Who Remembers','the Unbroken','the Twice-Born','the Forgotten',
];

const CHAR_SURNAMES = [
  'Ashvale','Blackwood','Briarstone','Coldbrook','Darkholm','Dawnfield',
  'Dustmere','Elderfen','Emberton','Ferndale','Frostholm','Goldmere',
  'Greystone','Grimholt','Halfmoor','Harrowgate','Ironvale','Ivywood',
  'Leafcroft','Longmere','Marshford','Millhaven','Mistwood','Moonvale',
  'Mosscroft','Nighthollow','Oakdale','Oldshore','Pinecrest','Ravenscroft',
  'Redmoor','Riverstone','Saltmarsh','Sandhollow','Shadowmere',
  'Silverbrook','Slateholm','Stormcroft','Swanmere','Thorndale','Timberhollow',
  'Vanecroft','Waterford','Whitestone','Windhollow','Wolfcrest','Woodhaven',
  'Bonebreaker','Cragmore','Darkbane','Edgeworth','Grimthorn','Hardrock',
  'Ironborn','Knifewood','Lowmoor','Mudmere','Nightfall','Oldbone',
  'Razorfen','Scarstone','Sharpthorn',
  'Aerindel','Caladrin','Darathal','Elenmir','Faladrin','Galadwen',
  'Haliryn','Iladren','Kaelithar','Lirindel','Moralind','Narithal',
];

function generateAnyCharacterName(options = {}) {
  const style = Math.floor(Math.random() * 5);
  let first;
  if (style === 0) first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_MIDS) + pick(CHAR_ENDS));
  else if (style === 1) first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_ENDS));
  else if (style === 2) first = pick(CHAR_STARTS);
  else if (style === 3) first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_MIDS));
  else first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_ENDS));

  if (options.format === 'first') return first;
  if (options.format === 'full') return `${first} ${pick(CHAR_SURNAMES)}`;

  if (maybe(0.25)) return `${first} ${pick(CHAR_SURNAMES)}`;
  if (maybe(0.15)) return `${first} ${pick(CHAR_EPITHETS)}`;
  return first;
}

// ── Character name dispatcher ─────────────────────────────────────────────────

import fng from 'fantasy-name-generator';

export const CHARACTER_RACES = [
  { key: 'any',        label: 'Any',          emoji: '✨' },
  { key: 'human',      label: 'Human',        emoji: '🧑' },
  { key: 'elf',        label: 'Elf',          emoji: '🧝' },
  { key: 'half-elf',   label: 'Half-Elf',     emoji: '🧝‍♂️' },
  { key: 'highelf',    label: 'High Elf',     emoji: '🪄' },
  { key: 'drow',       label: 'Drow',         emoji: '🕷️' },
  { key: 'dwarf',      label: 'Dwarf',        emoji: '⛏️' },
  { key: 'gnome',      label: 'Gnome',        emoji: '🍄' },
  { key: 'halfling',   label: 'Halfling',     emoji: '🌿' },
  { key: 'orc',        label: 'Orc',          emoji: '🪓' },
  { key: 'half-orc',   label: 'Half-Orc',     emoji: '⚔️' },
  { key: 'tiefling',   label: 'Tiefling',     emoji: '😈' },
  { key: 'dragonborn', label: 'Dragonborn',   emoji: '🐉' },
  { key: 'aasimar',    label: 'Aasimar',      emoji: '👼' },
  { key: 'tabaxi',     label: 'Tabaxi',       emoji: '🐆' },
  { key: 'goliath',    label: 'Goliath',      emoji: '🏔️' },
  { key: 'lizardfolk', label: 'Lizardfolk',   emoji: '🦎' },
  { key: 'kobold',     label: 'Kobold',       emoji: '🐲' },
  { key: 'kenku',      label: 'Kenku',        emoji: '🐦‍⬛' },
  { key: 'firbolg',    label: 'Firbolg',      emoji: '🌲' },
  { key: 'goblin',     label: 'Goblin',       emoji: '👺' },
  { key: 'hobgoblin',  label: 'Hobgoblin',    emoji: '👹' },
  { key: 'bugbear',    label: 'Bugbear',      emoji: '🐻' },
  { key: 'ogre',       label: 'Ogre',         emoji: '🧟' },
  { key: 'fairy',      label: 'Fairy',        emoji: '🧚' },
  { key: 'triton',     label: 'Triton',       emoji: '🧜' },
];

const TABAXI_NATURE = ['Cloud','Storm','Star','River','Shadow','Wind','Rain','Thunder','Sun','Moon','Mountain','Leaf','Tree','Path','Snow','Ice','Fire','Smoke','Ash','Dust'];
const TABAXI_NOUNS = ['Mountain','Peak','Valley','Forest','Stream','Canyon','Claw','Tail','Eye','Tooth','Breath','Whisper','Roar','Song','Feather'];

const KENKU_SOUNDS = ['Smasher','Clanger','Whistler','Squeaker','Hammer','Ringer','Tinker','Chirp','Crack','Snap','Rustle','Clack','Gong','Chime'];
const GOLIATH_TITLES = ['Bearbreaker','Dawncaller','Fearless','Flintfinder','Horncarver','Keeneye','Lonehunter','Longleaper','Rootsmasher','Skywatcher','Steadyhand','Threadtwister','Twice-Orphaned','Twistedlimb','Wordpainter'];

export function generateCharacterName(race = 'any', options = {}) {
  let gender = options.gender;
  if (!gender || gender === 'any') gender = maybe(0.5) ? 'male' : 'female';

  // Handle fully custom specialized races (Tabaxi, Kenku, Goliath, Half-Elf)
  if (race === 'tabaxi') {
    const first = cap(pick(TABAXI_NATURE)) + ' on the ' + cap(pick(TABAXI_NOUNS));
    if (options.format === 'first') return first;
    return first + (options.format === 'full' || maybe(0.6) ? ` (Clan ${pick(TOWN_SECOND)})` : '');
  }
  if (race === 'kenku') {
    return options.format === 'full' ? `${pick(KENKU_SOUNDS)} of the ${pick(TOWN_FIRST)}` : pick(KENKU_SOUNDS);
  }
  if (race === 'goliath') {
    const first = cap(fng.nameByRace('human', { gender }));
    if (options.format === 'first') return first;
    return `${first} "${pick(GOLIATH_TITLES)}" ${pick(DWARF_CLAN_NAMES)}`;
  }
  if (race === 'half-elf') {
    const first = cap(fng.nameByRace(maybe(0.5) ? 'human' : 'elf', { gender }));
    if (options.format === 'first') return first;
    return `${first} ${pick(maybe(0.5) ? HUMAN_SURNAMES : ELF_SURNAMES)}`;
  }

  // Randomly use the original hand-crafted generators for classic races 30% of the time
  if (Math.random() < 0.3) {
    switch (race) {
      case 'human':      return generateHumanName(options);
      case 'elf':        return generateElfName(options);
      case 'dwarf':      return generateDwarfName(options);
      case 'gnome':      return generateGnomeName(options);
      case 'halfling':   return generateHalflingName(options);
      case 'orc':        return generateOrcName(options);
      case 'half-orc':   return generateHalfOrcName(options);
      case 'tiefling':   return generateTieflingName(options);
      case 'dragonborn': return generateDragonbornName(options);
    }
  }

  // Map to FNG
  const fngMap = {
    'human': 'human',
    'elf': 'elf',
    'highelf': 'highelf',
    'drow': 'drow',
    'dwarf': 'dwarf',
    'gnome': 'gnome',
    'halfling': 'halfling',
    'orc': 'orc',
    'half-orc': 'orc',
    'goblin': 'goblin',
    'hobgoblin': 'goblin',
    'bugbear': 'orc',
    'ogre': 'ogre',
    'tiefling': 'demon',
    'aasimar': 'angel',
    'angel': 'angel',
    'dragonborn': 'dragon',
    'lizardfolk': 'dragon',
    'kobold': 'goblin', 
    'fairy': 'fairy',
    'firbolg': 'elf',
    'triton': 'highelf',
  };

  let fngRace = fngMap[race];
  if (!fngRace || race === 'any') {
    const keys = Object.values(fngMap);
    fngRace = pick(keys);
  }

  let first = cap(fng.nameByRace(fngRace, { gender }) || 'Brak');
  // For kobolds, keep it short
  if (race === 'kobold' && first.length > 5) first = first.slice(0, 5);

  if (options.format === 'first') return first;

  // Handle surnames
  const surnameMap = {
    'human': HUMAN_SURNAMES,
    'elf': ELF_SURNAMES,
    'highelf': ELF_SURNAMES,
    'drow': ELF_SURNAMES,
    'dwarf': DWARF_CLAN_NAMES,
    'gnome': GNOME_SURNAMES,
    'halfling': HALFLING_SURNAMES,
    'orc': ORC_CLANS,
    'half-orc': ORC_CLANS,
    'goblin': CHAR_SURNAMES,
    'hobgoblin': CHAR_SURNAMES,
    'bugbear': ORC_TITLES,
    'ogre': ORC_TITLES,
    'tiefling': TIEFLING_SURNAMES,
    'aasimar': TIEFLING_VIRTUE_NAMES,
    'dragonborn': DRAGONBORN_CLANS,
    'lizardfolk': DRAGONBORN_CLANS,
    'fairy': ELF_SURNAMES,
    'firbolg': ELF_SURNAMES,
    'triton': ELF_SURNAMES,
  };

  const surList = surnameMap[race] || CHAR_SURNAMES;
  
  if (options.format === 'full') {
    // some races use epithets/titles instead of clan surnames
    if (race === 'bugbear' || race === 'ogre') return `${first} ${pick(ORC_TITLES)}`;
    return `${first} ${pick(surList)}`;
  }

  const prob = race === 'human' ? 0.6 : 0.4;
  return maybe(prob) ? `${first} ${pick(surList)}` : first;
}

// ─────────────────────────────────────────────────────────────────────────────
// WORLD GENERATORS (TOWNS, ITEMS, FACTIONS, PLACES, CREATURES, LORE, RACES)
// ─────────────────────────────────────────────────────────────────────────────



export function generateTownName() {
  const style = Math.floor(Math.random() * 6);
  const prefix = maybe(0.15) ? pick(TOWN_PREFIXES) : '';
  const base = pick(NOUNS);
  
  if (style === 0) return `${prefix}${pick(ADJECTIVES)} ${pick(TOWN_SUFFIXES)}`;
  if (style === 1) return `${prefix}${base}${pick(TOWN_SUFFIXES)}`;
  if (style === 2) return `${prefix}${pick(ADJECTIVES)}${pick(TOWN_SUFFIXES).toLowerCase()}`;
  if (style === 3) return `${prefix}${base}'s ${cap(pick(TOWN_SUFFIXES))}`;
  if (style === 4) return `${pick(ADJECTIVES)} ${base}`;
  return `${prefix}${pick(NOUNS)}${pick(TOWN_SUFFIXES)}`;
}

export function generateItemName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 1) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 2) return `${pick(NOUNS)} of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 3) return `${pick(NOUNS)} of ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 4) return `${pick(ADJECTIVES)} ${pick(NOUNS)} of the ${pick(NOUNS)}`;
  return `The ${pick(NOUNS)}'s ${pick(NOUNS)}`;
}

export function generateFactionName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 1) return `${pick(NOUNS)} of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 2) return `The ${pick(NOUNS)} of ${pick(NOUNS)}`;
  if (style === 3) return `Order of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 4) return `${pick(ADJECTIVES)} ${pick(NOUNS)} Syndicate`;
  return `The ${pick(NOUNS)} Brotherhood`;
}

export function generatePlaceName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 1) return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 2) return `${pick(NOUNS)} of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 3) return `${pick(NOUNS)} of ${pick(NOUNS)}`;
  if (style === 4) return `The ${pick(NOUNS)}'s ${pick(NOUNS)}`;
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(NOUNS)}`;
}

export function generateCreatureName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 1) return `${pick(ADJECTIVES)}-${pick(NOUNS).toLowerCase()}`;
  if (style === 2) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 3) return `${pick(NOUNS)}${pick(NOUNS).toLowerCase()}`;
  if (style === 4) return `${pick(NOUNS)} of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${pick(NOUNS)}`;
}

export function generateLoreName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 1) return `${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 2) return `The ${pick(NOUNS)} of ${pick(NOUNS)}`;
  if (style === 3) return `${pick(NOUNS)} of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 4) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}: ${pick(NOUNS)} of ${pick(NOUNS)}`;
  return `Age of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
}

export function generateRaceName() {
  const style = Math.floor(Math.random() * 5);
  const raceBase = pick(['folk', 'kin', 'born', 'blood', 'spawn', 'brood', 'touched', 'marked']);
  if (style === 0) return `${pick(ADJECTIVES)}${raceBase}`;
  if (style === 1) return `${pick(NOUNS)}${raceBase}`;
  if (style === 2) return `The ${pick(ADJECTIVES)} ${cap(raceBase)}`;
  if (style === 3) return `${pick(ADJECTIVES)} ${pick(NOUNS)} ${cap(raceBase)}`;
  return `${pick(NOUNS)}${pick(NOUNS).toLowerCase()}`;
}

export function generateTavernName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `The ${pick(ADJECTIVES)} ${pick(TAVERN_NOUNS)}`;
  if (style === 1) return `The ${pick(TAVERN_NOUNS)} and ${pick(TAVERN_NOUNS)}`;
  if (style === 2) return `The ${pick(ADJECTIVES)} ${pick(TAVERN_NOUNS)} Inn`;
  if (style === 3) return `${pick(TAVERN_NOUNS)}'s Rest`;
  if (style === 4) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  return `The ${pick(NOUNS)} & ${pick(TAVERN_NOUNS)}`;
}

export function generateShipName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `The ${pick(SHIP_ADJECTIVES)} ${pick(SHIP_NOUNS)}`;
  if (style === 1) return `${pick(SHIP_ADJECTIVES)} ${pick(SHIP_NOUNS)}`;
  if (style === 2) return `The ${pick(NOUNS)}'s ${pick(SHIP_NOUNS)}`;
  if (style === 3) return `${pick(SHIP_NOUNS)} of the ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 4) return `${pick(ADJECTIVES)} ${pick(SHIP_NOUNS)}`;
  return `The ${pick(SHIP_NOUNS)} of ${pick(NOUNS)}`;
}

export function generateDeityName() {
  const style = Math.floor(Math.random() * 6);
  const name = pick(NOUNS); 
  const domain = pick(DEITY_DOMAINS);
  if (style === 0) return `${name}, ${domain}`;
  if (style === 1) return `The ${pick(ADJECTIVES)} God of ${pick(NOUNS)}`;
  if (style === 2) return `${name}, The ${pick(ADJECTIVES)} ${pick(NOUNS)}`;
  if (style === 3) return `The ${pick(ADJECTIVES)} ${pick(NOUNS)} of ${domain}`;
  if (style === 4) return `${pick(ADJECTIVES)} ${name}, ${domain}`;
  return `${name}, ${domain} and ${pick(DEITY_DOMAINS)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// DISPATCH
// ─────────────────────────────────────────────────────────────────────────────

export const GENERATOR_TYPES = [
  { key: 'character', label: 'Character',      fn: () => generateCharacterName('any') },
  { key: 'town',      label: 'Town',           fn: generateTownName      },
  { key: 'item',      label: 'Item',           fn: generateItemName      },
  { key: 'faction',   label: 'Faction',        fn: generateFactionName   },
  { key: 'place',     label: 'Place',          fn: generatePlaceName     },
  { key: 'creature',  label: 'Creature',       fn: generateCreatureName  },
  { key: 'lore',      label: 'Lore / Concept', fn: generateLoreName      },
  { key: 'race',      label: 'Race / Species', fn: generateRaceName      },
  { key: 'tavern',    label: 'Tavern / Inn',   fn: generateTavernName    },
  { key: 'ship',      label: 'Ship / Vessel',  fn: generateShipName      },
  { key: 'deity',     label: 'Deity / Myth',   fn: generateDeityName     },
];

export function generateName(type, race = 'any', options = {}) {
  if (type === 'character') return generateCharacterName(race, options);
  const gen = GENERATOR_TYPES.find(g => g.key === type);
  return gen ? gen.fn() : '';
}
