const favKey = (world) => `wb_favorites_${world}`;

export function readFavorites(world) {
  if (!world) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(favKey(world)) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** Each entry: `{ type: 'characters', id: 'uuid' }` */
export function writeFavorites(world, list) {
  if (!world) return;
  localStorage.setItem(favKey(world), JSON.stringify(list));
}

export function isFavorite(world, type, id) {
  return readFavorites(world).some(e => e.type === type && e.id === id);
}

export function toggleFavorite(world, type, id) {
  const cur = readFavorites(world);
  const exists = cur.findIndex(e => e.type === type && e.id === id);
  if (exists >= 0) cur.splice(exists, 1);
  else cur.push({ type, id });
  writeFavorites(world, cur);
  return exists < 0;
}
