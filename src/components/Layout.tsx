// App shell: a left navigation pane (brand + primary nav), and a top bar in the
// content area carrying the data-freshness indicator and the user/role menu.
// The role switch (in the user menu) changes visible scope and landing route.

import { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useRole } from '@/app/RoleContext';
import { useData } from '@/data/DataContext';
import { FreshnessIndicator } from '@/components/FreshnessIndicator';
import { UserMenu } from '@/components/UserMenu';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Portfolio', icon: '▣' },
  { to: '/analysis', label: 'Analysis', icon: '◪' },
  { to: '/benchmarking', label: 'Benchmarking', icon: '◈' },
  { to: '/carriers', label: 'Carriers', icon: '⬡' },
  { to: '/roll-up', label: 'Roll-up', icon: '☰' },
  { to: '/alerts', label: 'Alerts', icon: '◔' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { role, config } = useRole();
  const { data, landmarks } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const unacked = data.alerts.filter((a) => !a.acknowledged).length;

  // GM sees only their store; give them a "My store" entry plus alerts.
  const nav: NavItem[] =
    role === 'gm'
      ? [
          { to: `/store/${landmarks.gmStoreId}`, label: 'My store', icon: '▣' },
          { to: '/alerts', label: 'Alerts', icon: '◔' },
        ]
      : NAV;

  return (
    <div className="flex min-h-screen bg-panel">
      {/* Left nav pane */}
      <aside className="sticky top-0 flex h-screen w-52 shrink-0 flex-col border-r border-line bg-surface">
        <button onClick={() => navigate(config.landing)} className="flex items-center gap-2 border-b border-line px-3 py-3 text-left">
          <span className="grid h-8 w-8 place-items-center rounded bg-accent text-sm font-bold text-white">Rb</span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-ink">Rebound</span>
            <span className="block text-2xs text-muted">Shop performance recovery</span>
          </span>
        </button>

        <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {nav.map((n) => {
            const active = n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to);
            return (
              <NavLink
                key={n.to}
                to={n.to}
                className={`flex items-center justify-between rounded px-2.5 py-2 text-sm font-medium ${
                  active ? 'bg-accent-soft text-accent-hover' : 'text-muted hover:bg-panel hover:text-ink'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span aria-hidden className={`text-base ${active ? 'text-accent' : 'text-line-strong'}`}>{n.icon}</span>
                  {n.label}
                </span>
                {n.to === '/alerts' && unacked > 0 && (
                  <span className="rounded-full bg-bad px-1.5 text-2xs font-semibold text-white">{unacked}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-line p-2 text-2xs text-muted">
          <div className="px-1">Boyd Group · prototype</div>
          <div className="px-1">All data mocked</div>
        </div>
      </aside>

      {/* Content column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-2">
          <div className="min-w-0 text-2xs text-muted">
            Viewing as <span className="font-medium text-ink">{config.userName}</span> - {config.label}
          </div>
          <div className="flex items-center gap-2">
            <FreshnessIndicator />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">{children}</main>
      </div>
    </div>
  );
}
