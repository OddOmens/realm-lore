// World Stats panel — loaded as an ESM data-URL module inside the renderer.
// Cannot use bare imports; accesses React via window.__WB_React and the world
// store via window.__WB_useWorldStore, both set by the app on startup.

const React = window.__WB_React;
const { useState, useEffect } = React;

const COLLECTIONS = [
  { key: 'characters', label: 'Characters', color: '#818cf8' },
  { key: 'locations',  label: 'Locations',  color: '#34d399' },
  { key: 'things',     label: 'Things',     color: '#fb923c' },
  { key: 'lore',       label: 'Lore',       color: '#e879f9' },
  { key: 'factions',   label: 'Factions',   color: '#f87171' },
  { key: 'creatures',  label: 'Creatures',  color: '#facc15' },
  { key: 'races',      label: 'Races',      color: '#38bdf8' },
  { key: 'stories',    label: 'Stories',    color: '#a3e635' },
];

function Bar({ label, count, max, color }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0;
  return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
    React.createElement('div', {
      style: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-foreground)' }
    },
      React.createElement('span', null, label),
      React.createElement('span', { style: { fontWeight: 600 } }, count)
    ),
    React.createElement('div', {
      style: { height: 8, borderRadius: 4, background: 'var(--color-secondary)', overflow: 'hidden' }
    },
      React.createElement('div', {
        style: { height: '100%', width: `${pct}%`, borderRadius: 4, background: color, transition: 'width 0.6s ease' }
      })
    )
  );
}

function StatCard({ label, value, sub }) {
  return React.createElement('div', {
    style: {
      background: 'var(--color-card)',
      border: '1px solid var(--color-border)',
      borderRadius: 12,
      padding: '16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
    }
  },
    React.createElement('p', { style: { fontSize: 11, color: 'var(--color-muted-foreground)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 } }, label),
    React.createElement('p', { style: { fontSize: 28, fontWeight: 700, color: 'var(--color-foreground)', lineHeight: 1.2 } }, value),
    sub && React.createElement('p', { style: { fontSize: 11, color: 'var(--color-muted-foreground)' } }, sub)
  );
}

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - Number(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function WorldStatsPanel() {
  const useWorldStore = window.__WB_useWorldStore;
  const activeWorld = useWorldStore(s => s.activeWorld);
  const characters  = useWorldStore(s => s.characters);
  const locations   = useWorldStore(s => s.locations);
  const things      = useWorldStore(s => s.things);
  const lore        = useWorldStore(s => s.lore);
  const factions    = useWorldStore(s => s.factions);
  const creatures   = useWorldStore(s => s.creatures);
  const races       = useWorldStore(s => s.races);
  const stories     = useWorldStore(s => s.stories);

  const counts = {
    characters: characters.length,
    locations:  locations.length,
    things:     things.length,
    lore:       lore.length,
    factions:   factions.length,
    creatures:  creatures.length,
    races:      races.length,
    stories:    stories.length,
  };

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const maxCount = Math.max(...Object.values(counts), 1);

  // Most recently updated across all collections
  const allEntities = [
    ...characters.map(e => ({ ...e, _type: 'Character' })),
    ...locations.map(e  => ({ ...e, _type: 'Location'  })),
    ...things.map(e     => ({ ...e, _type: 'Thing'      })),
    ...lore.map(e       => ({ ...e, _type: 'Lore'       })),
    ...factions.map(e   => ({ ...e, _type: 'Faction'    })),
    ...creatures.map(e  => ({ ...e, _type: 'Creature'   })),
    ...races.map(e      => ({ ...e, _type: 'Race'       })),
    ...stories.map(e    => ({ ...e, _type: 'Story'      })),
  ].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)).slice(0, 8);

  // Tag frequency
  const tagFreq = {};
  for (const e of allEntities) {
    for (const tag of (e.tags || [])) {
      tagFreq[tag] = (tagFreq[tag] || 0) + 1;
    }
  }
  const topTags = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const styles = {
    page: { padding: '24px', display: 'flex', flexDirection: 'column', gap: 24 },
    header: { display: 'flex', flexDirection: 'column', gap: 2 },
    h2: { fontSize: 20, fontWeight: 700, color: 'var(--color-foreground)', margin: 0 },
    sub: { fontSize: 13, color: 'var(--color-muted-foreground)', margin: 0 },
    section: { display: 'flex', flexDirection: 'column', gap: 12 },
    sectionTitle: { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--color-muted-foreground)', margin: 0 },
    card: { background: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20 },
    statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 },
    recentRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid var(--color-border)',
    },
    pill: {
      display: 'inline-block', fontSize: 10, fontWeight: 600, padding: '2px 8px',
      borderRadius: 999, background: 'var(--color-secondary)', color: 'var(--color-muted-foreground)',
      border: '1px solid var(--color-border)',
    },
    tagRow: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  };

  return React.createElement('div', { style: styles.page },
    // Header
    React.createElement('div', { style: styles.header },
      React.createElement('h2', { style: styles.h2 }, `${activeWorld} — Stats`),
      React.createElement('p', { style: styles.sub }, `${total} total entr${total === 1 ? 'y' : 'ies'} across ${COLLECTIONS.length} collections`)
    ),

    // Stat cards
    React.createElement('div', { style: styles.section },
      React.createElement('p', { style: styles.sectionTitle }, 'Overview'),
      React.createElement('div', { style: styles.statsGrid },
        React.createElement(StatCard, { label: 'Total Entries', value: total }),
        React.createElement(StatCard, { label: 'Collections', value: COLLECTIONS.length }),
        React.createElement(StatCard, {
          label: 'Largest',
          value: COLLECTIONS.reduce((a, b) => counts[a.key] >= counts[b.key] ? a : b).label,
          sub: `${maxCount} entries`,
        }),
        React.createElement(StatCard, {
          label: 'Unique Tags',
          value: Object.keys(tagFreq).length,
        }),
      )
    ),

    // Bar chart
    React.createElement('div', { style: styles.section },
      React.createElement('p', { style: styles.sectionTitle }, 'By Collection'),
      React.createElement('div', { style: { ...styles.card, display: 'flex', flexDirection: 'column', gap: 14 } },
        ...COLLECTIONS.map(c =>
          React.createElement(Bar, { key: c.key, label: c.label, count: counts[c.key], max: maxCount, color: c.color })
        )
      )
    ),

    // Recently updated
    allEntities.length > 0 && React.createElement('div', { style: styles.section },
      React.createElement('p', { style: styles.sectionTitle }, 'Recently Updated'),
      React.createElement('div', { style: styles.card },
        allEntities.map((e, i) =>
          React.createElement('div', {
            key: e.id,
            style: { ...styles.recentRow, ...(i === allEntities.length - 1 ? { borderBottom: 'none' } : {}) }
          },
            React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 1 } },
              React.createElement('span', { style: { fontSize: 13, fontWeight: 500, color: 'var(--color-foreground)' } }, e.name || 'Untitled'),
              React.createElement('span', { style: { fontSize: 11, color: 'var(--color-muted-foreground)' } }, e._type)
            ),
            React.createElement('span', { style: { fontSize: 11, color: 'var(--color-muted-foreground)' } }, timeAgo(e.updatedAt))
          )
        )
      )
    ),

    // Top tags
    topTags.length > 0 && React.createElement('div', { style: styles.section },
      React.createElement('p', { style: styles.sectionTitle }, 'Top Tags'),
      React.createElement('div', { style: styles.tagRow },
        ...topTags.map(([tag, count]) =>
          React.createElement('span', { key: tag, style: styles.pill }, `${tag} (${count})`)
        )
      )
    )
  );
}
