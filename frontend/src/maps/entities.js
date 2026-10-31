import { Users, Map as MapIcon, Box, BookMarked, Flag, PawPrint } from 'lucide-react';

// Pin styling and picker labels per entity type.
export const TYPE_META = {
  characters: { icon: Users,      color: '#3b82f6', label: 'Character' },
  locations:  { icon: MapIcon,    color: '#10b981', label: 'Location'  },
  things:     { icon: Box,        color: '#f59e0b', label: 'Thing'     },
  lore:       { icon: BookMarked, color: '#8b5cf6', label: 'Lore'      },
  factions:   { icon: Flag,       color: '#6366f1', label: 'Faction'   },
  creatures:  { icon: PawPrint,   color: '#f97316', label: 'Creature'  },
};

export const PROTAGONIST_COLOR = '#eab308';
