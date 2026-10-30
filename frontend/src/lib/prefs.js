// Preferences (theme, favorites, writing streaks, word goals, tool state…)
// live on the server so every device sees the same ones. The app keeps
// reading and writing localStorage as before; this mirrors it to the server.

let pending = { set: {}, remove: [] };
let timer = null;

function flush() {
  timer = null;
  const batch = pending;
  pending = { set: {}, remove: [] };
  if (!Object.keys(batch.set).length && !batch.remove.length) return;
  fetch('/api/prefs', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(batch),
    keepalive: true,
  }).catch(() => { /* next change retries the whole key */ });
}

function queue() {
  if (!timer) timer = setTimeout(flush, 400);
}

// Loads the server's preferences into localStorage, then mirrors every later
// change back. Runs before the app's modules load, since some read
// localStorage at import time.
export async function initPrefs() {
  const res = await fetch('/api/prefs');
  if (!res.ok) return;
  const server = await res.json();

  if (Object.keys(server).length === 0) {
    // First visit to a fresh server: keep what this browser has.
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      pending.set[k] = localStorage.getItem(k);
    }
    queue();
  } else {
    localStorage.clear();
    for (const [k, v] of Object.entries(server)) localStorage.setItem(k, v);
  }

  const setItem = localStorage.setItem.bind(localStorage);
  const removeItem = localStorage.removeItem.bind(localStorage);
  localStorage.setItem = (k, v) => {
    setItem(k, v);
    pending.set[k] = String(v);
    pending.remove = pending.remove.filter(x => x !== k);
    queue();
  };
  localStorage.removeItem = (k) => {
    removeItem(k);
    delete pending.set[k];
    pending.remove.push(k);
    queue();
  };
  window.addEventListener('pagehide', flush);
}
