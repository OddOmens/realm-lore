import { Link, matchPath, useLocation } from 'react-router-dom';
import { Globe, Users, Map, Library, MoreHorizontal } from 'lucide-react';
import { pageScroller } from '../lib/nativeFeel';

// iOS tab bars hold at most five tabs; everything else lives under More.
const TABS = [
  { path: '/',           label: 'Home',       icon: Globe,   end: true },
  { path: '/characters', label: 'Characters', icon: Users },
  { path: '/locations',  label: 'Locations',  icon: Map },
  { path: '/stories',    label: 'Library',    icon: Library, also: ['/books/*'] },
  { path: '/more',       label: 'More',       icon: MoreHorizontal },
];

function tabFor(pathname) {
  const hit = TABS.find(t =>
    [t.end ? t.path : `${t.path}/*`, ...(t.also || [])].some(p => matchPath(p, pathname)),
  );
  // Pages without a tab of their own were reached from More.
  return hit ? hit.path : '/more';
}

export default function BottomNav() {
  const { pathname } = useLocation();
  const activeTab = tabFor(pathname);

  // Tapping the tab you're already on scrolls back to the top, as in UIKit.
  const onTabClick = (path) => (e) => {
    if (path !== activeTab || pathname !== path) return;
    e.preventDefault();
    pageScroller(document.getElementById('app-scroll'))?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 flex items-stretch border-t border-border/70 bg-card/80 backdrop-blur-xl backdrop-saturate-150"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {TABS.map(({ path, label, icon: Icon }) => {
        const isActive = path === activeTab;
        return (
          <Link
            key={path}
            to={path}
            state={{ tab: true }}
            onClick={onTabClick(path)}
            aria-current={isActive ? 'page' : undefined}
            className={`flex-1 flex flex-col items-center justify-start pt-[7px] gap-[3px] h-[var(--tabbar-h)] text-[10px] font-medium tracking-tight active:!opacity-100 ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon size={24} strokeWidth={isActive ? 2.25 : 1.75} />
            <span className="leading-none">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
