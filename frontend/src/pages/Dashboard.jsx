import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorldStore } from '../store/useWorldStore';
import { useShallow } from 'zustand/shallow';
import { Users, Map, Box, BookOpen, BookMarked, Link2, FileText, TrendingUp, Feather, Flame, ChevronRight } from 'lucide-react';
import { getWritingStreak } from '../lib/writingStreak';
import WorldAvatar from '../components/WorldAvatar';
import { displayWorldName } from '../lib/worlds';

function wordGoalKey(world) {
  return world ? `wb_world_word_goal_${world}` : '';
}

const STAT_META = [
  { key: 'characters', label: 'Characters', icon: Users,      path: '/characters' },
  { key: 'locations',  label: 'Locations',  icon: Map,        path: '/locations' },
  { key: 'things',     label: 'Things',     icon: Box,        path: '/things' },
  { key: 'lore',       label: 'Lore',       icon: BookMarked, path: '/lore' },
  { key: 'stories',    label: 'Stories',    icon: BookOpen,   path: '/stories' },
];

function wordCount(text) {
  if (!text) return 0;
  return text.replace(/\f/g, ' ').trim().split(/\s+/).filter(Boolean).length;
}

function StatCard({ meta, count, navigate }) {
  const Icon = meta.icon;
  return (
    <button
      onClick={() => navigate(meta.path)}
      className="card card-hover p-4 text-left flex flex-col gap-3"
    >
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon size={16} className="shrink-0" />
        {meta.label}
      </span>
      <span className="text-2xl font-semibold tracking-[-0.02em] text-foreground leading-none">{count}</span>
    </button>
  );
}

function MiniStat({ icon: Icon, iconClass = 'text-muted-foreground', value, label, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`card px-4 py-3 flex items-center gap-3 text-left ${onClick ? 'card-hover' : ''}`}
    >
      <Icon size={16} className={`shrink-0 ${iconClass}`} />
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground leading-tight">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </Tag>
  );
}

const RECENT_META = {
  characters: { icon: Users,      label: 'Character' },
  locations:  { icon: Map,        label: 'Location' },
  things:     { icon: Box,        label: 'Thing' },
  lore:       { icon: BookMarked, label: 'Lore' },
  stories:    { icon: BookOpen,   label: 'Story' },
};

function RecentItem({ entity, type, navigate }) {
  const meta = RECENT_META[type];
  const Icon = meta.icon;
  const path = type === 'stories' ? `/stories/${entity.id}` : `/${type}/${entity.id}`;
  const preview = entity.description || entity.background || entity.atmosphere || entity.content?.slice(0, 80) || '';
  const ago = entity.updatedAt ? (() => {
    // eslint-disable-next-line react-hooks/purity -- relative timestamps for dashboard list
    const diff = Date.now() - entity.updatedAt;
    const mins = Math.floor(diff / 60000);
    const hrs  = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  })() : null;

  return (
    <button
      onClick={() => navigate(path)}
      className="ios-row w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-accent/60"
    >
      <Icon size={16} className="shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{entity.name || 'Untitled'}</p>
        {preview && <p className="text-xs text-muted-foreground truncate">{preview}</p>}
      </div>
      <span className="hidden sm:block shrink-0 text-xs text-muted-foreground">{meta.label}</span>
      <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{ago}</span>
    </button>
  );
}

export default function Dashboard() {
  const { characters, locations, things, lore, stories, relationships, activeWorld, isLoading } = useWorldStore(
    useShallow(s => ({
      characters: s.characters,
      locations: s.locations,
      things: s.things,
      lore: s.lore,
      stories: s.stories,
      relationships: s.relationships,
      activeWorld: s.activeWorld,
      isLoading: s.isLoading,
    }))
  );
  const navigate    = useNavigate();

  const [wordGoalInput, setWordGoalInput] = useState('');
  /* eslint-disable react-hooks/set-state-in-effect -- reset local draft when switching worlds */
  useEffect(() => {
    if (!activeWorld) {
      setWordGoalInput('');
      return;
    }
    const raw = localStorage.getItem(wordGoalKey(activeWorld));
    setWordGoalInput(raw && raw !== '0' ? String(Number(raw) || '') : '');
  }, [activeWorld]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const persistWordGoal = (raw) => {
    const n = parseInt(String(raw).replace(/\D/g, ''), 10);
    if (!activeWorld) return;
    if (!n || n < 1) {
      localStorage.removeItem(wordGoalKey(activeWorld));
      setWordGoalInput('');
      return;
    }
    localStorage.setItem(wordGoalKey(activeWorld), String(n));
    setWordGoalInput(String(n));
  };

  const wordGoalNum = Number.parseInt(wordGoalInput, 10);

  const recentItems = useMemo(() => {
    const all = [
      ...characters.map(e => ({ entity: e, type: 'characters' })),
      ...locations.map(e  => ({ entity: e, type: 'locations' })),
      ...things.map(e     => ({ entity: e, type: 'things' })),
      ...lore.map(e       => ({ entity: e, type: 'lore' })),
      ...stories.map(e    => ({ entity: e, type: 'stories' })),
    ];
    return all
      .filter(({ entity }) => entity.updatedAt)
      .sort((a, b) => (b.entity.updatedAt || 0) - (a.entity.updatedAt || 0))
      .slice(0, 10);
  }, [characters, locations, things, lore, stories]);

  const totalWords = useMemo(
    () => stories.reduce((sum, s) => sum + (s.wordCount || 0), 0),
    [stories]
  );

  const goalProgress =
    Number.isFinite(wordGoalNum) && wordGoalNum > 0
      ? Math.min(100, Math.round((totalWords / wordGoalNum) * 100))
      : null;
  const streakDays = getWritingStreak(activeWorld);

  const totalEntities = characters.length + locations.length + things.length + lore.length;
  const counts = {
    characters: characters.length,
    locations:  locations.length,
    things:     things.length,
    lore:       lore.length,
    stories:    stories.length,
  };

  if (isLoading) return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading universe…</div>
  );

  const lastStory = [...stories]
    .filter(st => st.updatedAt)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="page">
        {/* World header */}
        <header className="flex items-start gap-4">
          {activeWorld && <WorldAvatar name={activeWorld} className="size-12 rounded-xl text-base" />}
          <div className="min-w-0 flex-1">
            <h1 className="page-title truncate">{displayWorldName(activeWorld)}</h1>
            <p className="page-subtitle">
              {totalEntities === 0 ? 'Your universe awaits — start building.' : `${totalEntities} world entr${totalEntities === 1 ? 'y' : 'ies'} · ${stories.length} stor${stories.length === 1 ? 'y' : 'ies'} · ${totalWords.toLocaleString()} words`}
            </p>
          </div>
        </header>

        {/* Entity stat cards */}
        <div className="mt-8 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {STAT_META.map(meta => (
            <StatCard key={meta.key} meta={meta} count={counts[meta.key]} navigate={navigate} />
          ))}
        </div>

        {/* Secondary stats row */}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MiniStat icon={FileText} value={totalWords.toLocaleString()} label="Total words" />
          <MiniStat icon={Link2} value={relationships.length} label="Connections" />
          <MiniStat
            icon={TrendingUp}
            value={lore.filter(e => e._isTimelineEvent).length || '—'}
            label="Timeline events"
            onClick={() => navigate('/timeline')}
          />
          <MiniStat
            icon={Flame}
            iconClass="text-orange-400"
            value={streakDays > 0 ? streakDays : '—'}
            label={streakDays > 0 ? `${streakDays}-day streak` : 'Writing streak · save a chapter today'}
          />
          <div className="card px-4 py-3 flex flex-col gap-1.5 col-span-2 sm:col-span-2 lg:col-span-1">
            <label htmlFor="word-goal" className="section-label">Story word goal</label>
            <input
              id="word-goal"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 50000"
              value={wordGoalInput}
              onChange={e => setWordGoalInput(e.target.value)}
              onBlur={() => persistWordGoal(wordGoalInput)}
              className="input h-7"
            />
            {goalProgress !== null && (
              <>
                <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${goalProgress}%` }} />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {goalProgress}% · {totalWords.toLocaleString()} / {wordGoalNum.toLocaleString()} words
                </p>
              </>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-8 grid-cols-1 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* Recently updated */}
          <section className="min-w-0">
            <h2 className="section-title mb-3">Recently updated</h2>
            {recentItems.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                Nothing yet — start creating!
              </div>
            ) : (
              <div className="divide-y divide-border rounded-lg border border-border">
                {recentItems.map(({ entity, type }) => (
                  <RecentItem key={`${type}-${entity.id}`} entity={entity} type={type} navigate={navigate} />
                ))}
              </div>
            )}
          </section>

          {/* Continue Writing + Quick Access */}
          <section className="min-w-0">
            <h2 className="section-title mb-3">Quick access</h2>

            {lastStory && (
              <button
                onClick={() => navigate(`/stories/${lastStory.id}`)}
                className="card card-hover w-full flex items-center gap-3 mb-3 px-4 py-3 text-left"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
                  <Feather size={16} />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="section-label">Continue writing</p>
                  <p className="text-sm font-medium text-foreground truncate">{lastStory.name}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{wordCount(lastStory.content || '').toLocaleString()}w</span>
                <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
              </button>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { path: '/characters', icon: Users,      label: 'Characters' },
                { path: '/locations',  icon: Map,        label: 'Locations' },
                { path: '/things',     icon: Box,        label: 'Things' },
                { path: '/lore',       icon: BookMarked, label: 'Lore' },
                { path: '/stories',    icon: BookOpen,   label: 'Library' },
                { path: '/timeline',   icon: TrendingUp, label: 'Timeline' },
              ].map(({ path, icon: Icon, label }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="card card-hover flex items-center gap-2 px-3 h-10 text-sm font-medium text-foreground"
                >
                  <Icon size={16} className="shrink-0 text-muted-foreground" />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
