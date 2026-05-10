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
};

function load() {
  try {
    const raw = localStorage.getItem('appSettings');
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw), navVisible: { ...DEFAULTS.navVisible, ...JSON.parse(raw).navVisible } };
  } catch {
    return DEFAULTS;
  }
}

function persist(state) {
  const { update, reset, ...settings } = state;
  localStorage.setItem('appSettings', JSON.stringify(settings));
}

export const useAppSettings = create((set, get) => ({
  ...load(),

  update(patch) {
    set(prev => {
      const next = { ...prev, ...patch };
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
