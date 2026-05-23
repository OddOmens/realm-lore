// ── Name generation library ───────────────────────────────────────────────────

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

function generateHumanName() {
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(HUMAN_FIRST_MALE) : pick(HUMAN_FIRST_FEMALE);
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

function generateElfName() {
  const style = Math.floor(Math.random() * 4);
  let first;
  if (style === 0) first = cap(pick(ELF_STARTS).toLowerCase() + pick(ELF_MIDS) + pick(ELF_ENDS));
  else if (style === 1) first = cap(pick(ELF_STARTS).toLowerCase() + pick(ELF_ENDS));
  else if (style === 2) first = pick(ELF_STARTS) + pick(ELF_MIDS);
  else first = cap(pick(ELF_STARTS).toLowerCase() + pick(ELF_MIDS) + pick(ELF_MIDS) + pick(ELF_ENDS));

  // Occasionally add an apostrophe break for High Elf feel
  if (maybe(0.08) && first.length > 5) {
    const mid = Math.floor(first.length / 2);
    first = first.slice(0, mid) + "'" + first.slice(mid);
  }

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

function generateDwarfName() {
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(DWARF_FIRST_MALE) : pick(DWARF_FIRST_FEMALE);
  // Dwarves almost always use clan names
  if (maybe(0.75)) return `${first} ${pick(DWARF_CLAN_NAMES)}`;
  // Occasionally "son/daughter of"
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

function generateGnomeName() {
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(GNOME_FIRST_MALE) : pick(GNOME_FIRST_FEMALE);
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

function generateOrcName() {
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(ORC_FIRST_MALE) : pick(ORC_FIRST_FEMALE);
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

function generateHalflingName() {
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(HALFLING_FIRST_MALE) : pick(HALFLING_FIRST_FEMALE);
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

function generateTieflingName() {
  const style = Math.floor(Math.random() * 3);
  if (style === 0) {
    // Virtue name (any gender)
    const virtue = pick(TIEFLING_VIRTUE_NAMES);
    if (maybe(0.4)) return `${virtue} ${pick(TIEFLING_SURNAMES)}`;
    return virtue;
  }
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(TIEFLING_INFERNAL_MALE) : pick(TIEFLING_INFERNAL_FEMALE);
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

function generateDragonbornName() {
  const gender = maybe(0.5) ? 'male' : 'female';
  const first = gender === 'male' ? pick(DRAGONBORN_FIRST_MALE) : pick(DRAGONBORN_FIRST_FEMALE);
  if (maybe(0.7)) return `${first} ${pick(DRAGONBORN_CLANS)}`;
  return first;
}

// ── Half-Orc ──────────────────────────────────────────────────────────────────
// Mix of human and orc styling

function generateHalfOrcName() {
  const style = Math.floor(Math.random() * 3);
  if (style === 0) {
    // Orc first name + human surname
    const gender = maybe(0.5) ? 'male' : 'female';
    const first = gender === 'male' ? pick(ORC_FIRST_MALE) : pick(ORC_FIRST_FEMALE);
    return `${first} ${pick(HUMAN_SURNAMES)}`;
  }
  if (style === 1) {
    // Human first name + orc title
    const gender = maybe(0.5) ? 'male' : 'female';
    const first = gender === 'male' ? pick(HUMAN_FIRST_MALE) : pick(HUMAN_FIRST_FEMALE);
    return `${first} ${pick(ORC_TITLES)}`;
  }
  // Pure orc name
  return generateOrcName();
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

function generateAnyCharacterName() {
  const style = Math.floor(Math.random() * 5);
  let first;
  if (style === 0) first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_MIDS) + pick(CHAR_ENDS));
  else if (style === 1) first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_ENDS));
  else if (style === 2) first = pick(CHAR_STARTS);
  else if (style === 3) first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_MIDS));
  else first = cap(pick(CHAR_STARTS).toLowerCase() + pick(CHAR_ENDS));

  if (maybe(0.25)) return `${first} ${pick(CHAR_SURNAMES)}`;
  if (maybe(0.15)) return `${first} ${pick(CHAR_EPITHETS)}`;
  return first;
}

// ── Character name dispatcher ─────────────────────────────────────────────────

export const CHARACTER_RACES = [
  { key: 'any',        label: 'Any',        emoji: '✨' },
  { key: 'human',      label: 'Human',      emoji: '🧑' },
  { key: 'elf',        label: 'Elf',        emoji: '🧝' },
  { key: 'dwarf',      label: 'Dwarf',      emoji: '⛏️' },
  { key: 'gnome',      label: 'Gnome',      emoji: '🍄' },
  { key: 'halfling',   label: 'Halfling',   emoji: '🌿' },
  { key: 'orc',        label: 'Orc',        emoji: '🪓' },
  { key: 'half-orc',   label: 'Half-Orc',   emoji: '⚔️' },
  { key: 'tiefling',   label: 'Tiefling',   emoji: '😈' },
  { key: 'dragonborn', label: 'Dragonborn', emoji: '🐉' },
];

export function generateCharacterName(race = 'any') {
  switch (race) {
    case 'human':      return generateHumanName();
    case 'elf':        return generateElfName();
    case 'dwarf':      return generateDwarfName();
    case 'gnome':      return generateGnomeName();
    case 'halfling':   return generateHalflingName();
    case 'orc':        return generateOrcName();
    case 'half-orc':   return generateHalfOrcName();
    case 'tiefling':   return generateTieflingName();
    case 'dragonborn': return generateDragonbornName();
    default:           return generateAnyCharacterName();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// TOWN / SETTLEMENT NAMES
// ─────────────────────────────────────────────────────────────────────────────

const TOWN_FIRST = [
  'Ash','Birch','Black','Bracken','Bram','Bright','Brook','Briar',
  'Cald','Cedar','Chalk','Cinder','Clay','Cliff','Cold','Copper',
  'Crag','Cross','Crow','Dusk','Dew','Drake','Dun',
  'Elder','Elm','Ember','Ever','Fair','Fen','Field','Flint','Ford',
  'Glen','Gold','Grain','Green','Grey','Grim','Gorse',
  'Hazel','Heather','High','Hill','Hollow','Holt','Horn',
  'Iron','Ivy','Lake','Larch','Leaf','Long','Low',
  'Marsh','Mill','Mist','Moss','Mud','Murk',
  'Night','North','Oak','Old','Otter',
  'Pine','Pool','Reed','River','Rock','Rook',
  'Salt','Sand','Shale','Silver','Slate','South','Stone','Storm','Swan',
  'Thorn','Timber','Trout',
  'Weld','West','White','Wind','Winter','Wolf','Wood','Wren','Yarrow','Yew',
  'Broken','Burnt','Dark','Dead','Deep','Dry','Far','Fast',
  'Hidden','Last','Little','Lost','Narrow','New','Open','Over',
  'Plain','Quick','Rough','Round','Small','Still','Upper','Wide',
];

const TOWN_SECOND = [
  'barrow','beach','beck','bend','borough','bridge','brook','burn','bury',
  'by','cliff','combe','crest','croft','cross','dale','dell','den',
  'dike','ditch','don','down','drift','dun','edge','end',
  'falls','farm','fell','fen','field','fold','ford','fork',
  'gate','gill','glen','green','grove',
  'hall','ham','haven','heath','hill','holt','home','hood',
  'hollow','holm','hurst','ing','keep','landing','lea',
  'lock','mead','mere','mill','moor','mouth','nest',
  'pool','port','reach','rest','ridge','rise','rock','run',
  'seat','shaw','side','slip','spring','stead','stone','strand',
  'thorpe','ton','vale','view','watch','well','wick','wood','worth','yard',
];

const TOWN_PREFIXES = [
  'Upper ','Lower ','East ','West ','North ','South ',
  'Great ','Little ','Old ','New ','Port ','Fort ',
];

export function generateTownName() {
  const prefix = maybe(0.12) ? pick(TOWN_PREFIXES) : '';
  const possessive = maybe(0.08);
  const base = pick(TOWN_FIRST);
  const second = pick(TOWN_SECOND);
  if (possessive) return `${prefix}${base}'s ${cap(second)}`;
  return `${prefix}${base}${second}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// ITEM NAMES
// ─────────────────────────────────────────────────────────────────────────────

const ITEM_ADJ = [
  'Ancient','Battered','Blackened','Broken','Burnished','Chipped','Cracked',
  'Dented','Dulled','Etched','Faded','Notched','Pitted','Rusted','Salt-worn',
  'Scorched','Stained','Tarnished','Warped','Worn','Weathered',
  'Bone','Brass','Carved','Curved','Double-edged','Flint','Forged','Gilded',
  'Hammered','Heavy','Hollow','Hooked','Iron','Jagged','Knotted','Leaden',
  'Long','Pale','Plain','Polished','Runed','Serrated','Short','Slim',
  'Smooth','Steel','Stone','Thick','Thin','Twisted','Unadorned','Wrapped',
  'Cursed','Blessed','Bound','Sealed','Marked','Whispering','Singing',
  'Burning','Frozen','Living','Dead','Twice-Forged','Blood-Marked',
  'Ash-Wrought','Storm-Tempered','Moon-Kissed','Shadow-Cast','Fell-Wrought',
];

const ITEM_MATERIAL = [
  'ash','birch','bone','coral','elm','horn','ivory','leather','linen',
  'oak','reed','willow','wool','yew','antler','chitin','hide','sinew',
  'amber','shell','vine','root',
  'clay','flint','jade','obsidian','quartz','slate','stone',
  'brass','bronze','copper','gold','iron','pewter','silver','steel','tin',
  'glass','crystal','moonstone','shadowglass','stormsteel','voidite',
  'starstone','ashglass','ironwood','blackoak','deepstone','coldsilver',
];

const ITEM_NOUN = [
  'axe','blade','bow','cleaver','crossbow','dagger','flail','glaive',
  'greataxe','greatsword','halberd','hammer','handaxe','hatchet','javelin',
  'knife','lance','mace','maul','morningstar','pick','pike','rapier',
  'scimitar','scythe','sickle','spear','staff','sword','trident','warhammer','whip',
  'belt','bracer','buckle','cap','chain','cloak','collar','coif','gauntlet',
  'girdle','glove','gorget','greave','helm','hood','jerkin','mail','mantle',
  'mask','pauldron','ring','robe','sash','shield','visor','wrap',
  'amulet','astrolabe','band','bottle','brace','brooch','canteen','clasp',
  'compass','crown','cup','disc','flask','focus','hook',
  'horn','journal','key','lamp','lantern','locket','medallion',
  'mirror','needle','orb','pendant','pin','pouch','quill','rod','rope',
  'satchel','seal','signet','tome','torch','vial','wand','whistle',
];

const ITEM_OF = [
  'the Dawn','the Dusk','the Deep','the Dark','the Void','the Storm',
  'the Tide','the North Wind','the South Wind','the East Gate','the West Shore',
  'the Rising Sun','the Fading Moon','the Starless Night','the Hidden Sky',
  'the Sea','the River','the Vale','the Wood','the Mountain',
  'the Fallen','the Lost','the Forgotten','the Harvest','the Watch',
  'the Old Ways','the First Vow','the Last Word','the Unbroken Path',
  'the Common Road','the Second Dawn','the Final Crossing',
  'Ash and Ember','Bone and Salt','Iron and Oak','Stone and Root',
  'Blood and Coin','Dust and Memory','Fire and Rain','Mud and Gold',
  'Night and Fog','Wind and Tide','Teeth and Claw','Rust and Ruin',
];

const ITEM_PROPER_ADJ = [
  'Undying','Forsaken','Eternal','Relentless','Faithful','Merciless',
  'Steadfast','Shattered','Woven','Risen','Fallen','Burning','Fading',
  'Silent','Hollow','Radiant','Cursed','Blessed','Sundered','Mended',
];

export function generateItemName() {
  const style = Math.floor(Math.random() * 6);
  if (style === 0) return `${pick(ITEM_ADJ)} ${cap(pick(ITEM_MATERIAL))} ${cap(pick(ITEM_NOUN))}`;
  if (style === 1) return `The ${pick(ITEM_ADJ)} ${cap(pick(ITEM_NOUN))}`;
  if (style === 2) return `${cap(pick(ITEM_MATERIAL))} ${cap(pick(ITEM_NOUN))} of ${pick(ITEM_OF)}`;
  if (style === 3) return `${pick(ITEM_ADJ)} ${cap(pick(ITEM_NOUN))} of ${pick(ITEM_OF)}`;
  if (style === 4) return `The ${pick(ITEM_PROPER_ADJ)} ${cap(pick(ITEM_NOUN))}`;
  const name = generateCharacterName('any').split(' ')[0];
  return `${name}'s ${pick(ITEM_ADJ)} ${cap(pick(ITEM_NOUN))}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// FACTION NAMES
// ─────────────────────────────────────────────────────────────────────────────

const FACTION_ADJ = [
  'Ancient','Faithful','Free','Honored','Patient','Steadfast','True','Unbroken',
  'Vigilant','Righteous','Sacred','Sworn','Undying','Everlasting','Enduring',
  'Ashen','Bitter','Black','Blind','Broken','Burned','Cold','Crimson',
  'Dark','Deep','Distant','Fallen','Grey','Hollow','Iron','Last',
  'Lost','Mended','Old','Pale','Quiet','Red','Salt','Silent',
  'Slow','Stone','Wandering','White','Worn',
  'Amber','Briar','Cedar','Copper','Dusk','Ember','Frost','Gold',
  'Green','Leaf','Moss','Oak','Pine','River','Root','Silver','Storm',
  'Thorn','Tide','Vine','Wind','Wood',
];

const FACTION_NOUN = [
  'Accord','Assembly','Canon','Chapter','Charter','Compact','Conclave',
  'Congress','Consortium','Council','Court','Covenant','Decree',
  'Delegation','Dominion','Embassy','Enclave','Forum',
  'Band','Brotherhood','Cadre','Cohort','Company','Corps',
  'Fist','Hand','Legion','Regiment','Vanguard','Warband',
  'Circle','Creed','Cult','Fold','Gathering','Lodge','Order',
  'Path','Rite','Ring','Secret','Shroud','Sisterhood','Society',
  'Clan','Fellowship','Guild','House','Keep','League',
  'Pact','Root','Sept','Sworn','Threshold','Union','Vigil','Watch','Way',
];

const FACTION_OF = [
  'the Ash Road','the Black Mountain','the Broken Shore','the Cold River',
  'the Common Field','the Deep Well','the Ember Gate','the Far Shore',
  'the Grey Hills','the High Pass','the Iron Bell','the Last Bridge',
  'the Mending','the North Wind','the Old Flame','the Open Hand',
  'the Pale River','the Quiet Wood','the Salt Flats','the Still Pool',
  'the Stone Keep','the Thornwood','the True Path','the Wandering Road',
  'the Fallen Crown','the First Dawn','the Last Hour','the Long Road',
  'the Old Oath','the Second Sun','the Silent Age','the Sundered Realm',
  'Blood and Coin','Fire and Salt','Iron and Bone','Stone and Ash',
  'Dust and Memory','Night and Fog','Root and Thorn','Wind and Rain',
];

export function generateFactionName() {
  const style = Math.floor(Math.random() * 5);
  if (style === 0) return `The ${pick(FACTION_ADJ)} ${pick(FACTION_NOUN)}`;
  if (style === 1) return `${pick(FACTION_NOUN)} of ${pick(FACTION_OF)}`;
  if (style === 2) return `The ${pick(FACTION_NOUN)} of ${pick(FACTION_OF)}`;
  if (style === 3) return `The ${pick(FACTION_ADJ)} ${pick(FACTION_NOUN)} of ${pick(FACTION_OF)}`;
  return `${pick(FACTION_ADJ)} ${pick(FACTION_NOUN)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// PLACE NAMES
// ─────────────────────────────────────────────────────────────────────────────

const PLACE_ADJ = [
  'Ancient','Broken','Buried','Crumbling','Dead','Fallen','Forgotten',
  'Frozen','Haunted','Overgrown','Ruined','Shattered','Sunken','Twisted',
  'Waterlogged','Worn','Ashen','Bitter','Cold','Dark','Deep','Distant',
  'Dried','Far','Flooded','Grey','High','Hollow','Low','Narrow','Old',
  'Pale','Quiet','Salt','Silent','Wide','Wild','Windswept',
  'Black','Bone-white','Crimson','Golden','Green','Iron','Misted',
  'Muddy','Obsidian','Scarlet','Shadowed','Silver','Smoky','Stony','Thorned',
];

const PLACE_NOUN = [
  'Abyss','Basin','Bay','Bluff','Canyon','Cavern','Chasm','Cliff',
  'Crevasse','Dell','Depths','Desert','Divide','Dunes','Expanse','Falls',
  'Fen','Fields','Flats','Gap','Gorge','Grove','Heights','Hollow',
  'Isle','Isthmus','Labyrinth','Maw','Meadow','Moor','Narrows',
  'Pass','Peak','Peninsula','Plain','Plateau','Reaches','Ridge','Rift',
  'Shelf','Shore','Slope','Sprawl','Steppe','Swamp','Tangle',
  'Tomb','Valley','Waste','Weald','Wood',
  'Archway','Bastion','Catacombs','Citadel','Crossing','Dungeon',
  'Fortress','Gate','Hall','Hold','Keep','Library','Monument',
  'Observatory','Outpost','Ruin','Sanctuary','Shrine','Spire',
  'Temple','Throne','Tower','Vault','Warren',
];

const PLACE_THE = [
  'Expanse of ','Reaches of ','Depths of ','Wastes of ','Edge of ',
  'Heart of ','Throat of ','Crown of ','Belly of ','Foot of ',
];

export function generatePlaceName() {
  const style = Math.floor(Math.random() * 5);
  if (style === 0) return generateTownName();
  if (style === 1) return `The ${pick(PLACE_ADJ)} ${pick(PLACE_NOUN)}`;
  if (style === 2) return `${pick(PLACE_ADJ)} ${pick(PLACE_NOUN)}`;
  if (style === 3) return `The ${pick(PLACE_THE)}${pick(PLACE_ADJ).toLowerCase()} ${pick(PLACE_NOUN).toLowerCase()}`;
  const owner = generateCharacterName('any').split(' ')[0];
  return `${owner}'s ${pick(PLACE_NOUN)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATURE NAMES
// ─────────────────────────────────────────────────────────────────────────────

const CREATURE_STARTS = [
  'Alder','Bark','Barrow','Bog','Bone','Bram','Briar','Burrow',
  'Cinder','Clay','Crag','Dark','Deep','Dusk','Dust','Ember',
  'Fen','Field','Flint','Frost','Gale','Glen','Gloom','Gnaw',
  'Grim','Grove','Hollow','Iron','Mire','Mist','Moat','Moss',
  'Mud','Night','Rain','Reed','River','Rock','Root','Rush',
  'Salt','Shade','Silt','Slate','Smoke','Snag','Stone','Storm',
  'Thorn','Timber','Vale','Vine','Wallow','Web','Wind','Wood',
  'Bellow','Bite','Blood','Claw','Coil','Crawl','Creep','Dire',
  'Dread','Fang','Fell','Fierce','Grin','Growl','Hiss','Howl',
  'Hunt','Kill','Lunge','Prowl','Rend','Rip','Roar','Savage',
  'Shriek','Skulk','Snarl','Snap','Stalk','Strike','Tear','Track',
  'Ash','Black','Blind','Bright','Brown','Crimson','Dun','Ghost',
  'Gold','Green','Grey','Pale','Red','Rust','Shadow','Silver','White',
  'Cavern','Cave','Deep','Lake','Marsh','Mountain','Ocean','River',
  'Sea','Sky','Swamp','Tree','Under','Water',
];

const CREATURE_ENDS = [
  'back','beak','belly','brow','chin','claw','coat','ear',
  'eye','fang','fin','foot','gill','hide','horn','jaw',
  'mane','maw','muzzle','neck','paw','scale','shell','skin',
  'snout','spine','tail','thorn','tooth','tusk',
  'bite','breath','call','chaser','coil','crawl','creep',
  'fang','grub','hook','hound','lurk','moth','prowl',
  'runner','skull','stalk','stalker','track','tread',
  'veil','walker','watcher','worm','wrap',
  'basker','bearer','bleeder','bloat','burrower',
  'caller','drifter','devourer','feeder','flier','grazer',
  'gnasher','grappler','hauler','herder','killer','leaper',
  'lurker','masher','nester','raider','ravager','reaper',
  'roamer','screamer','scuttler','seeker','shrieker','slayer',
  'slinker','snapper','soarer','spawner','spearer','spinner',
  'stalker','stomper','strider','swimmer','swiper',
  'trampler','trawler','tunneler','twister','wanderer',
];

export function generateCreatureName() {
  const style = Math.floor(Math.random() * 4);
  if (style === 0) return pick(CREATURE_STARTS) + pick(CREATURE_ENDS);
  if (style === 1) return `${pick(CREATURE_STARTS)}-${pick(CREATURE_ENDS)}`;
  if (style === 2) return `${pick(CREATURE_STARTS)} ${cap(pick(CREATURE_STARTS))}${pick(CREATURE_ENDS)}`;
  return `The ${pick(CREATURE_STARTS)}${pick(CREATURE_ENDS)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LORE / CONCEPT NAMES
// ─────────────────────────────────────────────────────────────────────────────

const LORE_ADJ = [
  'Ancient','Eternal','Final','First','Last','Long-Forgotten','Old',
  'Second','Third','Unending','Undying','Vanished',
  'Ashen','Binding','Bitter','Black','Blind','Broken','Buried',
  'Cold','Common','Dark','Dead','Deep','Distant','Fallen','Fading',
  'Forbidden','Forgotten','Grey','Hidden','High','Hollow',
  'Lost','Low','Pale','Patient','Quiet','Red','Salt',
  'Silent','Slow','Sunken','True','Unspoken','Wandering','Worn',
];

const LORE_NOUN = [
  'Age','Arrival','Ascension','Awakening','Battle','Birth','Breaking',
  'Burning','Calling','Catastrophe','Change','Collapse','Coming','Crossing',
  'Dawn','Death','Departure','Descent','End','Erasure','Exodus','Fall',
  'Flood','Founding','Herald','Hour','Hunger','Leaving','Martyrdom',
  'Passage','Purge','Reckoning','Return','Rise','Rupture','Schism',
  'Shattering','Siege','Silence','Sundering','Tide','Turning','Vanishing','War',
  'Accord','Annals','Axiom','Binding','Canon','Chronicle','Compact',
  'Covenant','Creed','Cycle','Decree','Doctrine','Edict','Era',
  'Flame','Law','Lament','Legacy','Oath','Omen','Order','Proclamation',
  'Promise','Prophecy','Revelation','Rite','Rule','Seal','Testament',
  'Trial','Truth','Vigil','Vow','Warning','Way','Word','Wound',
];

const LORE_OF = [
  'the First Age','the Second Crossing','the Third Dawn',
  'the Fallen Kingdom','the Broken Empire','the Sundered World',
  'the Ancient Court','the Lost City','the Vanished People',
  'the Old Covenant','the First War','the Final Hour',
  'the Blind King','the Last Queen','the Wandering Prophet',
  'the Unnamed God','the Betrayed Saint','the Forsaken Hero',
  'the Silent Empress','the Iron Warlord','the Weeping Scholar',
  'the Grey Mountains','the Deep River','the Ashen Wastes',
  'the Sunken Vale','the Hollow Shore','the Forgotten Tomb',
  'the Black Gate','the Silver Tower','the Iron Throne',
];

export function generateLoreName() {
  const style = Math.floor(Math.random() * 5);
  if (style === 0) return `The ${pick(LORE_ADJ)} ${pick(LORE_NOUN)}`;
  if (style === 1) return `${pick(LORE_ADJ)} ${pick(LORE_NOUN)}`;
  if (style === 2) return `The ${pick(LORE_NOUN)} of ${pick(LORE_OF)}`;
  if (style === 3) return `${pick(LORE_NOUN)} of the ${pick(LORE_ADJ).toLowerCase()} ${pick(LORE_NOUN).toLowerCase()}`;
  return `The ${pick(LORE_ADJ)} ${pick(LORE_NOUN)}: ${pick(LORE_OF)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// RACE / SPECIES NAMES
// ─────────────────────────────────────────────────────────────────────────────

const RACE_STARTS = [
  'Aer','Alar','Aur','Bael','Bhor','Cal','Dhar','Drav',
  'Eldrin','Erak','Eryn','Fal','Fir','Ghor','Gor','Grel',
  'Har','Hel','Il','Ith','Kal','Khar','Kir','Kral',
  'Lir','Lor','Mal','Mhar','Mor','Nar','Nel','Nith',
  'Orak','Oryn','Phal','Ral','Rel','Rhal','Rin','Rok',
  'Sal','Ser','Shal','Skael','Skor','Sol','Tal','Thar',
  'Thel','Thor','Til','Tur','Urak','Val','Vel','Vor',
  'Wal','Wyr','Xal','Xen','Yar','Yen','Zal','Zel',
];

const RACE_MIDS = ['an','ar','el','en','ir','or','in','on','ath','eth','ith','oth','aen','ien','oen','aer','ier','oer'];
const RACE_ENDS = ['i','in','en','an','on','un','ar','er','ir','or','ur','ath','eth','oth','ael','iel','uel','kin','ren','dar','nor','sor','tor','war'];
const RACE_DEMONYMS = ['folk','kin','born','blood','sworn','kind','spawn','brood','touched','marked','blessed','cursed','chosen','lost','fallen'];

export function generateRaceName() {
  const style = Math.floor(Math.random() * 5);
  if (style === 0) return cap(pick(RACE_STARTS).toLowerCase() + pick(RACE_MIDS) + pick(RACE_ENDS));
  if (style === 1) return cap(pick(CREATURE_STARTS).toLowerCase()) + pick(RACE_DEMONYMS);
  if (style === 2) return `The ${cap(pick(RACE_STARTS).toLowerCase() + pick(RACE_ENDS))}`;
  if (style === 3) return `${pick(LORE_ADJ)} ${cap(pick(RACE_ENDS))}folk`;
  return pick(RACE_STARTS) + pick(RACE_DEMONYMS);
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
];

export function generateName(type, race = 'any') {
  if (type === 'character') return generateCharacterName(race);
  const gen = GENERATOR_TYPES.find(g => g.key === type);
  return gen ? gen.fn() : '';
}
