// Header data-freshness indicator. Every screen reading DOMO-derived numbers
// must be able to say how current they are - click to see per-dataset refresh.

import { useState } from 'react';
import { useData } from '@/data/DataContext';
import { dateTimeLabel } from '@/utils/format';
import { IconChevronDown } from '@/components/icons';

function relative(iso: string): string {
  const hrs = (Date.now() - Date.parse(iso)) / 3600_000;
  if (hrs < 1) return `${Math.round(hrs * 60)}m ago`;
  if (hrs < 48) return `${Math.round(hrs)}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

export function FreshnessIndicator() {
  const { data } = useData();
  const [open, setOpen] = useState(false);
  const newest = data.freshness.reduce((a, b) => (Date.parse(a.lastRefreshed) > Date.parse(b.lastRefreshed) ? a : b));
  const anyStale = data.freshness.some((f) => (Date.now() - Date.parse(f.lastRefreshed)) / 3600_000 > 24);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-2xs font-medium text-muted hover:bg-panel"
        title="Data freshness by dataset"
      >
        <span aria-hidden className={`inline-block h-1.5 w-1.5 rounded-full ${anyStale ? 'bg-warn' : 'bg-good'}`} />
        Data refreshed {relative(newest.lastRefreshed)}
        <IconChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-1.5 w-80 rounded-xl border border-line bg-surface p-2 shadow-pop">
            <div className="px-1 pb-1 text-2xs font-semibold uppercase tracking-wide text-muted">
              Source datasets (all mocked)
            </div>
            <ul className="divide-y divide-line">
              {data.freshness.map((f) => (
                <li key={f.dataset} className="flex items-center justify-between gap-2 px-1 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-xs text-ink">{f.dataset}</div>
                    <div className="text-2xs text-muted">{dateTimeLabel(f.lastRefreshed)}</div>
                  </div>
                  <span
                    className={`chip shrink-0 ${f.certified ? 'bg-good-soft text-good-text' : 'bg-warn-soft text-warn-text'}`}
                  >
                    {f.certified ? 'Certified' : 'Uncertified'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
