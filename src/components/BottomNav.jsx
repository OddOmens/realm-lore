import { NavLink } from 'react-router-dom';
import { Globe, Users, Map, BookMarked, Library, MoreHorizontal, Flag } from 'lucide-react';
import { useWorldStore } from '../store/useWorldStore';

const PRIMARY_TABS = [
  { path: '/',          label: 'Home',       icon: Globe },
  { path: '/characters', label: 'Characters', icon: Users },
  { path: '/locations',  label: 'Locations',  icon: Map },
  { path: '/factions',   label: 'Factions',   icon: Flag },
  { path: '/lore',       label: 'Lore',       icon: BookMarked },
  { path: '/stories',    label: 'Library',    icon: Library },
];

export default function BottomNav() {
  const setMobileMenuOpen = useWorldStore(s => s.setMobileMenuOpen);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-card border-t border-border flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {PRIMARY_TABS.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[52px] text-[10px] font-medium transition-colors ${
              isActive ? 'text-primary' : 'text-muted-foreground'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.75} />
              <span>{label}</span>
            </>
          )}
        </NavLink>
      ))}
      <button
        onClick={() => setMobileMenuOpen(true)}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2 min-h-[52px] text-[10px] font-medium text-muted-foreground"
      >
        <MoreHorizontal size={20} strokeWidth={1.75} />
        <span>More</span>
      </button>
    </nav>
  );
}
