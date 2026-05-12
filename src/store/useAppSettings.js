import { create } from 'zustand';

const DEFAULTS = {
  // Sidebar nav visibility — keys match navItems paths in Sidebar.jsx
  navVisible: {
    '/':          true,
    '/characters': true,
    '/creatures':  true,
    '/races':      true,
    '/factions':   true,
    '/locations':  true,
    '/things':     true,
    '/timeline':   true,
    '/maps':       true,
    '/stories':    true,
    '/names':      true,
    '/trash':      true,
  },
  // Appearance
  fontSize: 'md',      // 'sm' | 'md' | 'lg'
  density: 'comfortable', // 'compact' | 'comfortable' | 'spacious'
  // Editor
  autosaveDelay: 800,  // ms
  defaultListView: 'grid', // 'grid' | 'list'
  showWordCount: true,
  showEntityCounts: true,
  // DnD Tools (all off by default)
  dndTools: {
    enabled: false,       // master switch — shows sidebar + floating button
    diceRoller: true,
    initiativeTracker: true,
    encounterRoller: true,
    spellSlots: true,
  },
};

function load() {
  try {
    const raw = localStorage.getItem('appSettings');
    if (!raw) return DEFAULTS;
    const saved = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...saved,
      navVisible: { ...DEFAULTS.navVisible, ...saved.navVisible },
      dndTools: { ...DEFAULTS.dndTools, ...saved.dndTools },
    };
  } catch {
    return DEFAULTS;
  }
}

const OMIT_KEYS = new Set(['update', 'reset', 'setDndTool', 'setNavVisible']);

function persist(state) {
  const settings = Object.fromEntries(Object.entries(state).filter(([k]) => !OMIT_KEYS.has(k)));
  localStorage.setItem('appSettings', JSON.stringify(settings));
}

export const useAppSettings = create((set) => ({
  ...load(),

  update(patch) {
    set(prev => {
      const next = { ...prev, ...patch };
      persist(next);
      return next;
    });
  },

  setDndTool(key, value) {
    set(prev => {
      const dndTools = { ...prev.dndTools, [key]: value };
      const next = { ...prev, dndTools };
      persist(next);
      return next;
    });
  },

  setNavVisible(path, visible) {
    set(prev => {
      const navVisible = { ...prev.navVisible, [path]: visible };
      const next = { ...prev, navVisible };
      persist(next);
      return next;
    });
  },

  reset() {
    localStorage.removeItem('appSettings');
    set({ ...DEFAULTS });
  },
}));

// Apply CSS custom properties to :root based on settings
export function applyAppSettings({ fontSize, density }) {
  const root = document.documentElement;
  const fontSizeMap = { sm: '13px', md: '15px', lg: '17px' };
  const densityMap  = { compact: '0.5rem', comfortable: '1rem', spacious: '1.5rem' };
  root.style.setProperty('--app-font-size', fontSizeMap[fontSize] ?? fontSizeMap.md);
  root.style.setProperty('--app-density', densityMap[density] ?? densityMap.comfortable);
}
