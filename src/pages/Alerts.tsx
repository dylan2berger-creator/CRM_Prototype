// 8. /alerts - Alert queue.
// Proactive alerts grouped by kind, newest first, acknowledgeable. Each alert
// message already states what changed, by how much, and against what baseline;
// this screen makes them triageable and traceable back to the store record (and
// the carrier view for carrier-level kinds).

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/data/DataContext';
import { storeById } from '@/data/selectors';
import { Alert, AlertKind } from '@/types';
import { Badge } from '@/components/status';
import { EmptyState, Segmented } from '@/components/ui';
import { dateLabel } from '@/utils/format';

type Variant = 'good' | 'warn' | 'bad' | 'neutral' | 'accent';

// Kind → badge variant. Status is never color-only; Badge adds a shape + label.
const KIND_VARIANT: Record<AlertKind, Variant> = {
  'New flag': 'bad',
  Slippage: 'warn',
  'Overdue step': 'warn',
  'DRP tier drop': 'bad',
  'Carrier volume anomaly': 'warn',
  'Scorecard anomaly': 'warn',
};

// Kinds that also warrant a link to the carrier view.
const CARRIER_KINDS: ReadonlySet<AlertKind> = new Set<AlertKind>([
  'Carrier volume anomaly',
  'Scorecard anomaly',
]);

// Stable group order so the queue reads the same on every render.
const KIND_ORDER: AlertKind[] = [
  'New flag',
  'DRP tier drop',
  'Slippage',
  'Overdue step',
  'Carrier volume anomaly',
  'Scorecard anomaly',
];

type FilterMode = 'unacknowledged' | 'all';

export function Alerts() {
  const { data, acknowledgeAlert, acknowledgeAll } = useData();
  const [filter, setFilter] = useState<FilterMode>('unacknowledged');

  // Group alerts by kind, newest first within each group.
  const groups = useMemo(() => {
    const byKind = new Map<AlertKind, Alert[]>();
    for (const a of data.alerts) {
      const list = byKind.get(a.kind) ?? [];
      list.push(a);
      byKind.set(a.kind, list);
    }
    return KIND_ORDER.filter((k) => byKind.has(k)).map((kind) => {
      const all = byKind
        .get(kind)!
        .slice()
        .sort((a, b) => (a.raisedOn < b.raisedOn ? 1 : a.raisedOn > b.raisedOn ? -1 : 0));
      const unacked = all.filter((a) => !a.acknowledged);
      return { kind, all, unacked };
    });
  }, [data.alerts]);

  const totalUnacked = groups.reduce((n, g) => n + g.unacked.length, 0);

  // Apply the show/hide-acknowledged filter, keeping unacknowledged first and
  // dimming any acknowledged ones that remain visible.
  const visibleGroups = groups
    .map((g) => {
      const rows =
        filter === 'unacknowledged'
          ? g.unacked
          : [...g.unacked, ...g.all.filter((a) => a.acknowledged)];
      return { ...g, rows };
    })
    .filter((g) => g.rows.length > 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-ink">Alert queue</h1>
          <p className="mt-0.5 max-w-2xl text-xs text-muted">
            Proactive alerts fire when a store or carrier moves against its baseline. Each one
            states what changed, by how much, and against what - read it, open the record, then
            acknowledge to clear it from the queue.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-2xs text-muted">
            {totalUnacked} unacknowledged
          </span>
          <Segmented<FilterMode>
            value={filter}
            onChange={setFilter}
            size="sm"
            options={[
              { value: 'unacknowledged', label: 'Unacknowledged' },
              { value: 'all', label: 'Show acknowledged' },
            ]}
          />
        </div>
      </div>

      {visibleGroups.length === 0 ? (
        <EmptyState title="Nothing to triage">
          {filter === 'unacknowledged'
            ? 'Every alert has been acknowledged. Switch to show acknowledged to review what cleared, or check back as new movement is detected.'
            : 'No alerts have been raised. Check back as new movement against baseline is detected.'}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          {visibleGroups.map((g) => (
            <section key={g.kind} className="card">
              <header className="flex items-center justify-between gap-3 border-b border-line px-3 py-2">
                <div className="flex items-center gap-2">
                  <Badge variant={KIND_VARIANT[g.kind]}>{g.kind}</Badge>
                  <span className="text-2xs text-muted">
                    {g.unacked.length} unacknowledged of {g.all.length}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn"
                  disabled={g.unacked.length === 0}
                  onClick={() => acknowledgeAll(g.unacked.map((a) => a.id))}
                >
                  Acknowledge all in group
                </button>
              </header>
              <ul className="divide-y divide-line">
                {g.rows.map((a) => {
                  const store = storeById(data, a.storeId);
                  const storeName = store?.name ?? a.storeId;
                  const isCarrier = CARRIER_KINDS.has(a.kind);
                  return (
                    <li
                      key={a.id}
                      className={`flex flex-wrap items-start justify-between gap-3 px-3 py-2 ${
                        a.acknowledged ? 'opacity-50' : ''
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-ink">{a.message}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-2xs text-muted">
                          <Link to={`/store/${a.storeId}`} className="font-medium text-accent hover:text-accent-hover hover:underline">
                            {storeName}
                          </Link>
                          {isCarrier && (
                            <>
                              <span aria-hidden>·</span>
                              <Link to="/carriers" className="font-medium text-accent hover:text-accent-hover hover:underline">
                                Carrier view
                              </Link>
                            </>
                          )}
                          <span aria-hidden>·</span>
                          <span className="tnum">{dateLabel(a.raisedOn)}</span>
                          {a.acknowledged && (
                            <>
                              <span aria-hidden>·</span>
                              <span className="font-medium">Acknowledged</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0">
                        <button
                          type="button"
                          className="btn"
                          disabled={a.acknowledged}
                          onClick={() => acknowledgeAlert(a.id)}
                        >
                          {a.acknowledged ? 'Acknowledged' : 'Acknowledge'}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
