import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useWorldStore } from './store/useWorldStore';
import { useAppSettings, applyAppSettings } from './store/useAppSettings';
import AppChrome from './components/Sidebar';
import BottomNav from './components/BottomNav';
import SaveBanner from './components/SaveBanner';
import OnboardingModal from './components/OnboardingModal';
import ErrorBoundary from './components/ErrorBoundary';
import { api } from './lib/api';
import { useRouteTransitions, useEdgeSwipeBack } from './lib/nativeFeel';

const Dashboard      = lazy(() => import('./pages/Dashboard'));
const Characters     = lazy(() => import('./pages/Characters'));
const Locations      = lazy(() => import('./pages/Locations'));
const Things         = lazy(() => import('./pages/Things'));
const Notes          = lazy(() => import('./pages/Notes'));
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
const AssetGallery   = lazy(() => import('./pages/AssetGallery'));
const MapDetail      = lazy(() => import('./pages/MapDetail'));
const NameGenerator  = lazy(() => import('./pages/NameGenerator'));
const CustomEntities = lazy(() => import('./pages/CustomEntities'));
const DndTools       = lazy(() => import('./pages/DndTools'));
const More           = lazy(() => import('./pages/More'));

function PageLoader() {
  return (
    <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Loading…
    </div>
  );
}

function App() {
  const { theme, fontSize, density } = useAppSettings();
  useEffect(() => { applyAppSettings({ theme, fontSize, density }); }, [theme, fontSize, density]);

  return (
    <Router>
      <Shell />
    </Router>
  );
}

function Shell() {
  const initialize    = useWorldStore(state => state.initialize);

  const [showOnboarding, setShowOnboarding] = useState(false);
  const [worldsPath, setWorldsPath]         = useState('');

  const pageRef   = useRef(null);
  const scrollRef = useRef(null);
  useRouteTransitions(pageRef, scrollRef);
  useEdgeSwipeBack(pageRef);

  useEffect(() => { initialize(); }, [initialize]);

  useEffect(() => {
    api.getInfo().then(({ firstLaunch, worldsPath: wp }) => {
      setWorldsPath(wp || '');
      if (firstLaunch) setShowOnboarding(true);
    }).catch(() => {});
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background text-foreground">
      <AppChrome>
        <main ref={pageRef} className="app-safe-area flex-1 flex flex-col overflow-hidden relative bg-background">
          <div id="app-scroll" ref={scrollRef} className="app-scroll flex-1 flex flex-col overflow-y-auto relative mobile-bottom-pad">
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
                <Route path="/notes" element={<Notes />} />
                <Route path="/notes/:id" element={<EntityWiki />} />
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
                <Route path="/assets" element={<AssetGallery />} />
                <Route path="/names" element={<NameGenerator />} />
                <Route path="/custom/:typeId" element={<CustomEntities />} />
                <Route path="/custom/:typeId/:id" element={<EntityWiki />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/trash" element={<Trash />} />
                <Route path="/tools/*" element={<DndTools />} />
                <Route path="/more" element={<More />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
          </div>
        </main>
      </AppChrome>
      <BottomNav />
      <SaveBanner />
      {showOnboarding && (
        <OnboardingModal worldsPath={worldsPath} onClose={() => setShowOnboarding(false)} />
      )}
    </div>
  );
}

export default App;
