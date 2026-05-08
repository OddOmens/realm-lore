import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useWorldStore } from './store/useWorldStore';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import SaveBanner from './components/SaveBanner';
import Login from './pages/Login';

// Lazily load heavy page bundles so navigating between sections
// doesn't block the main thread while parsing large modules.
const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Characters     = lazy(() => import('./pages/Characters'));
const Locations      = lazy(() => import('./pages/Locations'));
const Things         = lazy(() => import('./pages/Things'));
const Lore           = lazy(() => import('./pages/Lore'));
const Factions       = lazy(() => import('./pages/Factions'));
const Creatures      = lazy(() => import('./pages/Creatures'));
const Races          = lazy(() => import('./pages/Races'));
const Stories        = lazy(() => import('./pages/Stories'));
const StoryEditor    = lazy(() => import('./pages/StoryEditor'));
const BookDetail     = lazy(() => import('./pages/BookDetail'));
const EntityWiki     = lazy(() => import('./pages/EntityWiki'));
const Settings       = lazy(() => import('./pages/Settings'));
const Trash          = lazy(() => import('./pages/Trash'));
const Timeline       = lazy(() => import('./pages/Timeline'));
const Maps           = lazy(() => import('./pages/Maps'));
const MapDetail      = lazy(() => import('./pages/MapDetail'));
const NameGenerator  = lazy(() => import('./pages/NameGenerator'));

// Minimal fallback shown while a lazy chunk loads
function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

function App() {
  const initialize = useWorldStore(state => state.initialize);
  const isAuthenticated = useWorldStore(state => state.isAuthenticated);
  const backupConfig = useWorldStore(state => state.backupConfig);
  const triggerBackup = useWorldStore(state => state.triggerBackup);

  useEffect(() => {
    if (isAuthenticated) {
      // initialize() rethrows on UNAUTHORIZED so Login can react; here we just
      // need to swallow it (the store's catch already called logout()).
      initialize().catch(() => {});
    }
  }, [initialize, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || backupConfig.frequency <= 0) return;
    const intervalMs = backupConfig.frequency * 60 * 1000;
    const timer = setInterval(() => {
      triggerBackup();
    }, intervalMs);
    return () => clearInterval(timer);
    // Including `lastBackupAt` here means a successful backup (manual *or*
    // scheduled) tears down and restarts this interval, so a forced backup
    // can't be followed seconds later by a stale scheduled one.
  }, [isAuthenticated, backupConfig.frequency, backupConfig.lastBackupAt, triggerBackup]);

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <div className="flex-1 overflow-y-auto relative mobile-bottom-pad">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/characters" element={<Characters />} />
                <Route path="/characters/:id" element={<EntityWiki />} />
                <Route path="/locations" element={<Locations />} />
                <Route path="/locations/:id" element={<EntityWiki />} />
                <Route path="/things" element={<Things />} />
                <Route path="/things/:id" element={<EntityWiki />} />
                <Route path="/lore" element={<Lore />} />
                <Route path="/lore/:id" element={<EntityWiki />} />
                <Route path="/factions" element={<Factions />} />
                <Route path="/factions/:id" element={<EntityWiki />} />
                <Route path="/creatures" element={<Creatures />} />
                <Route path="/creatures/:id" element={<EntityWiki />} />
                <Route path="/races" element={<Races />} />
                <Route path="/races/:id" element={<EntityWiki />} />
                <Route path="/stories" element={<Stories />} />
                <Route path="/stories/:id" element={<StoryEditor />} />
                <Route path="/books/:bookId" element={<BookDetail />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/maps" element={<Maps />} />
                <Route path="/maps/:id" element={<MapDetail />} />
                <Route path="/names" element={<NameGenerator />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/trash" element={<Trash />} />
              </Routes>
            </Suspense>
          </div>
        </main>
        <BottomNav />
        <SaveBanner />
      </div>
    </Router>
  );
}

export default App;
