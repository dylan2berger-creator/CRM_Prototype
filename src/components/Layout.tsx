// App shell: header with the app identity, primary nav, role switcher, and the
// data-freshness indicator. The role switcher changes visible store scope and
// the default landing route.

import { ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Role } from '@/types';
import { useRole } from '@/app/RoleContext';
import { useData } from '@/data/DataContext';
import { FreshnessIndicator } from '@/components/FreshnessIndicator';

const NAV: { to: string; label: string; roles?: Role[] }[] = [
  { to: '/', label: 'Portfolio' },
  { to: '/analysis', label: 'Analysis' },
  { to: '/benchmarking', label: 'Benchmarking' },
  { to: '/carriers', label: 'Carriers' },
  { to: '/roll-up', label: 'Roll-up' },
  { to: '/alerts', label: 'Alerts' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { role, config, setRole, roles } = useRole();
  const { data, landmarks } = useData();
  const navigate = useNavigate();
  const location = useLocation();

  const unacked = data.alerts.filter((a) => !a.acknowledged).length;

  const onRoleChange = (r: Role) => {
    setRole(r);
    // jump to that role's default landing route
    const landing = r === 'cpm' ? '/' : r === 'gm' ? `/store/${landmarks.gmStoreId}` : '/roll-up';
    navigate(landing);
  };

  // GM sees only their store; hide portfolio-style nav that implies a book.
  const nav = role === 'gm' ? NAV.filter((n) => ['/alerts'].includes(n.to)) : NAV;

  return (
    <div className="min-h-screen bg-panel">
      <header className="sticky top-0 z-40 border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2">
          <button onClick={() => navigate(config.landing)} className="flex items-center gap-2 text-left">
            <span className="grid h-7 w-7 place-items-center rounded bg-accent text-xs font-bold text-white">Rb</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold text-ink">
                Rebound <span className="font-normal text-muted">· Shop performance recovery</span>
              </div>
              <div className="text-2xs text-muted">Boyd Group · prototype · all data mocked</div>
            </div>
          </button>

          <nav className="order-3 flex w-full items-center gap-1 overflow-x-auto md:order-2 md:w-auto">
            {nav.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                className={({ isActive }) =>
                  `relative whitespace-nowrap rounded px-2.5 py-1.5 text-sm font-medium ${
                    isActive || (n.to !== '/' && location.pathname.startsWith(n.to))
                      ? 'bg-accent-soft text-accent-hover'
                      : 'text-muted hover:bg-panel hover:text-ink'
                  }`
                }
              >
                {n.label}
                {n.to === '/alerts' && unacked > 0 && (
                  <span className="ml-1 rounded-full bg-bad px-1.5 text-2xs font-semibold text-white">{unacked}</span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
            <FreshnessIndicator />
            <div className="flex items-center gap-1.5">
              <label className="text-2xs text-muted" htmlFor="role-switch">
                Role
              </label>
              <select
                id="role-switch"
                className="field py-1"
                value={role}
                onChange={(e) => onRoleChange(e.target.value as Role)}
              >
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-[1600px] px-4 pb-1.5 text-2xs text-muted">
          Viewing as <span className="font-medium text-ink">{config.userName}</span> — {config.label}
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-4">{children}</main>
    </div>
  );
}
