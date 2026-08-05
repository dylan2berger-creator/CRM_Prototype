// User / role dropdown. No auth - role is chosen here, and changing it changes
// the visible store scope and the default landing route.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Role } from '@/types';
import { useRole } from '@/app/RoleContext';
import { useData } from '@/data/DataContext';

function initials(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function UserMenu() {
  const { role, config, setRole, roles } = useRole();
  const { landmarks } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const choose = (r: Role) => {
    setRole(r);
    setOpen(false);
    navigate(r === 'cpm' ? '/' : r === 'gm' ? `/store/${landmarks.gmStoreId}` : '/roll-up');
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded border border-line-strong bg-surface px-1.5 py-1 hover:bg-panel"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-2xs font-bold text-white">{initials(config.userName)}</span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-medium text-ink">{config.userName}</span>
          <span className="block text-2xs text-muted">{config.label}</span>
        </span>
        <span aria-hidden className="text-2xs text-muted">▾</span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1 w-64 rounded-lg border border-line bg-surface p-1.5 shadow-lg">
            <div className="px-2 pb-1 pt-1 text-2xs font-semibold uppercase tracking-wide text-muted">View the app as</div>
            <ul>
              {roles.map((r) => (
                <li key={r.role}>
                  <button
                    onClick={() => choose(r.role)}
                    className={`flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-panel ${
                      role === r.role ? 'text-accent-hover' : 'text-ink'
                    }`}
                  >
                    <span>{r.label}</span>
                    {role === r.role && <span aria-hidden className="text-accent">✓</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t border-line px-2 py-1.5 text-2xs text-muted">
              No authentication - role is switched here for the demo. It changes the visible store scope and landing screen.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
