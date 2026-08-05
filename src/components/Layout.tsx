// App shell: a left navigation pane (brand + primary nav) and a top bar in the
// content area carrying the data-freshness indicator and the user/role menu.
// Styled to mirror ClickUp: white sidebar, gradient brand mark, rounded active
// nav items with the purple accent, line icons.

import { ComponentType, ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '@/app/RoleContext';
import { useData } from '@/data/DataContext';
import { FreshnessIndicator } from '@/components/FreshnessIndicator';
import { UserMenu } from '@/components/UserMenu';
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
  const { data, landmarks } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const unacked = data.alerts.filter((a) => !a.acknowledged).length;

  const nav: NavItem[] =
    role === 'gm'
      ? [
          { to: `/store/${landmarks.gmStoreId}`, label: 'My shop', icon: IconStore },
          { to: '/alerts', label: 'Alerts', icon: IconAlerts },
        ]
      : NAV;

  return (
    <div className="flex min-h-screen bg-panel">
      {/* Left nav pane */}
      <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col border-r border-line bg-surface">
        <button onClick={() => navigate(config.landing)} className="flex items-center gap-2.5 px-4 py-4 text-left">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-purple via-brand-pink to-brand-blue text-base font-bold text-white shadow-card">
            R
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold text-ink">Rebound</span>
            <span className="block text-2xs text-muted">Shop performance recovery</span>
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
                  active ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-panel hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className={`h-[18px] w-[18px] ${active ? 'text-accent' : 'text-muted group-hover:text-ink'}`} />
                  {n.label}
                </span>
                {n.to === '/alerts' && unacked > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-bad px-1 text-2xs font-semibold text-white">{unacked}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-line px-4 py-3 text-2xs text-muted">
          <div>Boyd Group · prototype</div>
          <div>All data mocked</div>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-5 py-2.5">
          <div className="min-w-0 text-2xs text-muted">
            Viewing as <span className="font-medium text-ink">{config.userName}</span> · {config.label}
          </div>
          <div className="flex items-center gap-2">
            <FreshnessIndicator />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-5 py-5">{children}</main>
      </div>
    </div>
  );
}
