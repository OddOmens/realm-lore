/** Tracks calendar days on which the user saved prose (any chapter). */

const keyDays = (world) => `wb_write_days_${world}`;

export function recordWritingDay(world) {
  if (!world) return;
  const today = new Date().toISOString().slice(0, 10);
  const raw = localStorage.getItem(keyDays(world));
  const arr = raw ? JSON.parse(raw) : [];
  const set = new Set(Array.isArray(arr) ? arr : []);
  set.add(today);
  localStorage.setItem(keyDays(world), JSON.stringify([...set].sort()));
}

/** Longest run of consecutive calendar days ending today (requires today recorded). */
export function getWritingStreak(world) {
  if (!world) return 0;
  let raw;
  try {
    raw = JSON.parse(localStorage.getItem(keyDays(world)) || '[]');
  } catch {
    raw = [];
  }
  const set = new Set(Array.isArray(raw) ? raw : []);
  const today = new Date().toISOString().slice(0, 10);
  if (!set.has(today)) return 0;

  let streak = 0;
  const d = new Date();
  while (true) {
    const dayKey = d.toISOString().slice(0, 10);
    if (!set.has(dayKey)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}
