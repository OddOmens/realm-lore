import { syncThemeColor } from './nativeFeel';

const THEME_CLASSES = ['theme-light', 'theme-dark', 'theme-parchment', 'theme-scifi', 'theme-grimdark', 'theme-purple', 'theme-green', 'dark'];
const LIGHT_THEMES = new Set(['light', 'parchment']);
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

// 'system' follows the device's light/dark appearance.
export function resolveTheme(theme) {
  if (theme === 'system') return systemDark.matches ? 'dark' : 'light';
  return theme;
}

let followSystem = null;

// Puts the theme's class on <html>; with 'system', keeps following the device.
export function applyTheme(theme = 'system') {
  const root = document.documentElement;
  const resolved = resolveTheme(theme);
  root.classList.remove(...THEME_CLASSES);
  root.classList.add(`theme-${resolved}`);
  if (!LIGHT_THEMES.has(resolved)) root.classList.add('dark');
  root.style.colorScheme = LIGHT_THEMES.has(resolved) ? 'light' : 'dark';
  syncThemeColor();

  if (followSystem) systemDark.removeEventListener('change', followSystem);
  followSystem = null;
  if (theme === 'system') {
    followSystem = () => applyTheme(theme);
    systemDark.addEventListener('change', followSystem);
  }
}
