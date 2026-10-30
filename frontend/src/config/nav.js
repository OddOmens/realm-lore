import {
  Globe, Users, Map, Library, Box, TrendingUp, Flag, PawPrint, MapPin, Wand2, Dna, Image, StickyNote,
  Layers, Dice5, Swords, Table2, Sparkles, BookOpen, Gem, User,
  BarChart2, Star, Zap, FlaskConical, Puzzle, Trash2, Network,
} from 'lucide-react';

// Sidebar destinations; visibility is toggled per path in Settings (navVisible).
export const navItems = [
  { path: '/', label: 'Overview', icon: Globe },
  { path: '/characters', label: 'Characters', icon: Users },
  { path: '/creatures', label: 'Creatures', icon: PawPrint },
  { path: '/races', label: 'Races', icon: Dna },
  { path: '/factions', label: 'Factions', icon: Flag },
  { path: '/locations', label: 'Locations', icon: Map },
  { path: '/things', label: 'Things', icon: Box },
  { path: '/timeline', label: 'Timeline', icon: TrendingUp },
  { path: '/maps', label: 'Maps', icon: MapPin },
  { path: '/stories', label: 'Library', icon: Library },
  { path: '/notes', label: 'Notes', icon: StickyNote },
  { path: '/names', label: 'Names', icon: Wand2 },
  { path: '/assets', label: 'Asset Gallery', icon: Image },
];

// D&D tools, each shown when its key is on in settings.dndTools.
export const dndToolItems = [
  { key: 'campaignDashboard', path: '/tools/dashboard',   label: 'Campaign Dashboard', icon: Layers },
  { key: 'diceRoller',        path: '/tools/dice',        label: 'Dice Roller',        icon: Dice5 },
  { key: 'initiativeTracker', path: '/tools/initiative',  label: 'Initiative',         icon: Swords },
  { key: 'encounterRoller',   path: '/tools/encounters',  label: 'Encounters',         icon: Table2 },
  { key: 'spellSlots',        path: '/tools/spells',      label: 'Spell Slots',        icon: Sparkles },
  { key: 'conditionRef',      path: '/tools/conditions',  label: 'Conditions',         icon: BookOpen },
  { key: 'lootGenerator',     path: '/tools/loot',        label: 'Loot',               icon: Gem },
  { key: 'nameGenerator',     path: '/tools/names',       label: 'Names',              icon: User },
  { key: 'spellsList',        path: '/tools/spells-list', label: 'Spells List',        icon: Wand2 },
  { key: 'itemsList',         path: '/tools/items-list',  label: 'Items List',         icon: Box },
];

// Icons a custom entity type can pick.
export const customTypeIcons = {
  BarChart2, Star, BookOpen, Layers, Zap, FlaskConical, Puzzle,
  Globe, Users, Map, Library, Box, TrendingUp, Flag, PawPrint,
  MapPin, Trash2, Wand2, Dna, Dice5, Swords, Table2, Sparkles, Gem, User,
  Network, Image,
};
