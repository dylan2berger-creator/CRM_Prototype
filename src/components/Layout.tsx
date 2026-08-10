// App shell: a full-width prototype notice bar across the top (carrying the
// demo-only controls - view mode, role switch, data freshness), then a dark
// navy left navigation pane and the light content area with white cards.
// Styled to mirror the hub design system: single blue accent, line icons.

import { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '@/app/RoleContext';
import { useData } from '@/data/DataContext';
import { UserMenu } from '@/components/UserMenu';
import { useMode } from '@/app/ModeContext';
import { Segmented } from '@/components/ui';
import {
  IconAlerts,
  IconAnalysis,
  IconBenchmarking,
  IconCarriers,
  IconPortfolio,
  IconRollup,
  IconStore,
} from '@/components/icons';

interface NavItem {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Portfolio', icon: IconPortfolio },
  { to: '/analysis', label: 'Analysis', icon: IconAnalysis },
  { to: '/benchmarking', label: 'Benchmarking', icon: IconBenchmarking },
  { to: '/carriers', label: 'Carriers', icon: IconCarriers },
  { to: '/roll-up', label: 'Roll-up', icon: IconRollup },
  { to: '/alerts', label: 'Alerts', icon: IconAlerts },
];

export function Layout({ children }: { children: ReactNode }) {
  const { role, config } = useRole();
  const { mvp, setMode } = useMode();
  const { data, landmarks } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const unacked = data.alerts.filter((a) => !a.acknowledged).length;

  // The MVP cut ships only the core screens: the challenged-shop watchlist and
  // the alert feed (the store record is reached from there). Full mode keeps
  // every screen.
  const nav: NavItem[] = mvp
    ? [
        { to: '/mvp', label: 'Challenged shops', icon: IconPortfolio },
        { to: '/alerts', label: 'Alerts', icon: IconAlerts },
      ]
    : role === 'gm'
      ? [
          { to: `/store/${landmarks.gmStoreId}`, label: 'My shop', icon: IconStore },
          { to: '/alerts', label: 'Alerts', icon: IconAlerts },
        ]
      : NAV;

  return (
    <div className="flex min-h-screen flex-col bg-panel">
      {/* Prototype notice bar - spans the full page. Carries the demo-only
          controls (view mode, role, data freshness) and signals to viewers
          that this bar is scaffolding, not part of the final product. */}
      <div className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-x-4 border-b border-warn/40 bg-warn-soft px-4">
        <div className="flex min-w-0 items-center gap-2">
          <span className="chip shrink-0 bg-warn text-white">PROTOTYPE</span>
          <span className="hidden truncate text-2xs text-warn-text lg:inline">
            Demo build - the view-mode and role controls in this bar are for exploring the prototype and won't be part of the final product.
          </span>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="hidden text-2xs text-ink md:inline">
            Viewing as <span className="font-semibold">{config.userName}</span> · {config.label}
          </span>
          <Segmented
            size="sm"
            value={mvp ? 'mvp' : 'full'}
            onChange={(v) => {
              setMode(v as 'full' | 'mvp');
              navigate(v === 'mvp' ? '/mvp' : '/');
            }}
            options={[
              { value: 'full', label: 'Full app' },
              { value: 'mvp', label: 'MVP' },
            ]}
          />
          <UserMenu />
        </div>
      </div>

      <div className="flex flex-1">
        {/* Left nav pane */}
        <aside className="sticky top-14 flex h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col border-r border-navy-line bg-navy">
          <button onClick={() => navigate(mvp ? '/mvp' : config.landing)} className="flex items-center gap-2.5 px-4 py-4 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-ring text-base font-bold text-navy shadow-card">
            R
          </span>
          <span className="leading-tight">
            <span className="block font-head text-[15px] font-semibold tracking-wide text-white">Rebound</span>
            <span className="block text-2xs text-nav">Shop performance recovery</span>
          </span>
        </button>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-2">
          {nav.map((n) => {
            const active = n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`group flex items-center justify-between rounded-lg px-2.5 py-2 text-sm font-medium transition-colors ${
                  active ? 'bg-white/12 text-white' : 'text-nav hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-white' : 'text-nav-dim group-hover:text-white'}`} />
                  {n.label}
                </span>
                {n.to === '/alerts' && unacked > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-2xs font-semibold text-white">{unacked}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-navy-line px-4 py-3 text-2xs text-nav-dim">
          <div>Boyd Group · prototype</div>
          <div>All data mocked</div>
        </div>
        </aside>

        {/* Content */}
        <main className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-5 py-5">{children}</main>
      </div>
    </div>
  );
}
