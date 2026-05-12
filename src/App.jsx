import React, { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useWorldStore } from './store/useWorldStore';
import { useAppSettings, applyAppSettings } from './store/useAppSettings';
import { usePluginStore } from './store/usePluginStore';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import SaveBanner from './components/SaveBanner';
import UpdateBanner from './components/UpdateBanner';
import OnboardingModal from './components/OnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';

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
const DndTools       = lazy(() => import('./pages/DndTools'));
const PluginPanel    = lazy(() => import('./pages/PluginPanel'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

// Expose app internals for plugin panels loaded as data-URL modules
window.__WB_React = React;
window.__WB_useWorldStore = useWorldStore;

function App() {
  const initialize    = useWorldStore(state => state.initialize);
  const backupConfig  = useWorldStore(state => state.backupConfig);
  const triggerBackup = useWorldStore(state => state.triggerBackup);
  const { fontSize, density } = useAppSettings();
  const loadPlugins = usePluginStore(state => state.load);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [worldsPath, setWorldsPath]         = useState('');

  useEffect(() => { applyAppSettings({ fontSize, density }); }, [fontSize, density]);

  useEffect(() => { initialize(); }, [initialize]);
  useEffect(() => { loadPlugins(); }, [loadPlugins]);

  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onAppInfo(({ firstLaunch, worldsPath: wp }) => {
      setWorldsPath(wp || '');
      if (firstLaunch) setShowOnboarding(true);
    });
  }, []);

  useEffect(() => {
    if (backupConfig.frequency <= 0) return;
    const intervalMs = backupConfig.frequency * 60 * 1000;
    const timer = setInterval(() => { triggerBackup(); }, intervalMs);
    return () => clearInterval(timer);
  }, [backupConfig.frequency, backupConfig.lastBackupAt, triggerBackup]);

  return (
    <Router>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <main className="flex-1 flex flex-col overflow-hidden relative">
          {/* Draggable title bar strip for Electron — sits above page content */}
          <div style={{ WebkitAppRegion: 'drag', height: '44px', flexShrink: 0, background: 'transparent' }} className="hidden lg:block" />
          <div className="flex-1 overflow-y-auto relative mobile-bottom-pad" style={{ marginTop: '-44px' }}>
            <ErrorBoundary>
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
                <Route path="/tools/*" element={<DndTools />} />
                <Route path="/plugins/:panelId" element={<PluginPanel />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </div>
        </main>
        <BottomNav />
        <SaveBanner />
        <UpdateBanner />
        {showOnboarding && (
          <OnboardingModal worldsPath={worldsPath} onClose={() => setShowOnboarding(false)} />
        )}
      </div>
    </Router>
  );
}

export default App;
