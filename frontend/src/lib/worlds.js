export function worldInitials(name = '') {
  const words = name.replace(/[_-]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

// A stable colour per world name, from a small muted set.
const WORLD_COLORS = ['#3b5bdb', '#0c8599', '#2f9e44', '#e8590c', '#c2255c', '#7048e8', '#5c940d', '#1971c2'];
export function worldColor(name = '') {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return WORLD_COLORS[h % WORLD_COLORS.length];
}

// World folders use underscores for spaces.
export function displayWorldName(name = '') {
  return name.replace(/_/g, ' ');
}
