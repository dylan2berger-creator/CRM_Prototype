// 1. Portfolio (CPM home) - the list that replaces the tracker doc. The list is
// the identification step: challenged stores surface at the top, no hunting.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/data/DataContext';
import { useRole } from '@/app/RoleContext';
import {
  portfolioRow,
  PortfolioRow,
  regionName,
  spmName,
  storesForScope,
  TIER_ORDER,
} from '@/data/selectors';
import { ChallengedBadge, PlanStatusBadge, RecoveredBadge, TierBadge } from '@/components/status';
import { PctOfPlan } from '@/components/Variance';
import { Sparkline } from '@/components/Sparkline';
import { EmptyState, Field, Select } from '@/components/ui';
import { SourceTag } from '@/components/Provenance';
import { dateLabel } from '@/utils/format';
import { DIVISIONS } from '@/mock/names';

type PlanFilter = 'all' | 'has-plan' | 'no-plan' | 'overdue';

export function Portfolio() {
  const { data } = useData();
  const { config, role } = useRole();
  const stores = storesForScope(data, config.scope);

  const [challengedOnly, setChallengedOnly] = useState(false);
  const [division, setDivision] = useState('all');
  const [region, setRegion] = useState('all');
  const [client, setClient] = useState('all');
  const [tier, setTier] = useState('all');
  const [planFilter, setPlanFilter] = useState<PlanFilter>('all');

  const regionDivision = useMemo(() => new Map(data.regions.map((r) => [r.id, r.division])), [data.regions]);

  // Region options narrow to the chosen division; picking a division resets the
  // region so the two stay consistent.
  const regionOptions = [
    { value: 'all', label: 'All regions' },
    ...data.regions.filter((r) => division === 'all' || r.division === division).map((r) => ({ value: r.id, label: r.name })),
  ];
  const onDivisionChange = (v: string) => {
    setDivision(v);
    setRegion('all');
  };

  const rows = useMemo(() => stores.map((s) => portfolioRow(data, s)), [stores, data]);

  const filtered = useMemo(() => {
    let out = rows;
    if (challengedOnly) out = out.filter((r) => r.challenged.isChallenged);
    if (division !== 'all') out = out.filter((r) => regionDivision.get(r.store.regionId) === division);
    if (region !== 'all') out = out.filter((r) => r.store.regionId === region);
    if (tier !== 'all') out = out.filter((r) => r.worstTier === tier);
    if (client !== 'all') out = out.filter((r) => r.clientMix.some((c) => c.client.id === client));
    if (planFilter === 'has-plan') out = out.filter((r) => r.plan);
    if (planFilter === 'no-plan') out = out.filter((r) => r.challenged.isChallenged && !r.plan);
    if (planFilter === 'overdue') out = out.filter((r) => r.hasOverdueStep);
    // challenged first, then by worst T3 revenue
    return [...out].sort((a, b) => {
      if (a.challenged.isChallenged !== b.challenged.isChallenged) return a.challenged.isChallenged ? -1 : 1;
      return (a.t3RevenuePct ?? 999) - (b.t3RevenuePct ?? 999);
    });
  }, [rows, challengedOnly, division, region, client, tier, planFilter, regionDivision]);

  const challengedCount = rows.filter((r) => r.challenged.isChallenged).length;
  const noPlanCount = rows.filter((r) => r.challenged.isChallenged && !r.plan).length;

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-lg font-semibold text-ink">Portfolio</h1>
          <p className="text-xs text-muted">
            {role === 'spm' || role === 'cpm' ? `${config.userName}'s book` : config.label} - {rows.length} stores,{' '}
            <span className="font-medium text-bad-text">{challengedCount} challenged</span>
            {noPlanCount > 0 && <>, {noPlanCount} with no plan yet</>}. Challenged stores are listed first.
          </p>
        </div>
        <SourceTag dataset="DOMO Exec Dashboard - Revenue" />
      </header>

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={challengedOnly} onChange={(e) => setChallengedOnly(e.target.checked)} />
          Challenged only
        </label>
        <Field label="Division">
          <Select
            value={division}
            onChange={onDivisionChange}
            aria-label="Division filter"
            options={[{ value: 'all', label: 'All divisions' }, ...DIVISIONS.map((dv) => ({ value: dv, label: dv }))]}
          />
        </Field>
        <Field label="Region">
          <Select value={region} onChange={setRegion} aria-label="Region filter" options={regionOptions} />
        </Field>
        <Field label="Client">
          <Select
            value={client}
            onChange={setClient}
            aria-label="Client filter"
            options={[{ value: 'all', label: 'All clients' }, ...data.clients.map((c) => ({ value: c.id, label: c.name + (c.isDrp ? ' (DRP)' : '') }))]}
          />
        </Field>
        <Field label="DRP tier">
          <Select
            value={tier}
            onChange={setTier}
            aria-label="DRP tier filter"
            options={[{ value: 'all', label: 'All tiers' }, ...TIER_ORDER.map((t) => ({ value: t, label: t }))]}
          />
        </Field>
        <Field label="Plan status">
          <Select
            value={planFilter}
            onChange={(v) => setPlanFilter(v as PlanFilter)}
            aria-label="Plan status filter"
            options={[
              { value: 'all', label: 'Any' },
              { value: 'no-plan', label: 'Challenged, no plan' },
              { value: 'overdue', label: 'Plan with overdue steps' },
              { value: 'has-plan', label: 'Has a plan' },
            ]}
          />
        </Field>
        <span className="ml-auto self-center text-2xs text-muted">
          {filtered.length} of {rows.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="No stores match these filters">
          Widen a filter to bring stores back - clear "challenged only" or pick "All regions" to see the full book.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Store</th>
                <th>Region</th>
                <th title="Shop Performance Manager who owns this shop">SPM</th>
                <th>Client mix</th>
                <th className="text-right">T3 revenue vs plan</th>
                <th className="text-right">T3 volume vs forecast</th>
                <th className="text-right">Challenged</th>
                <th>Plan</th>
                <th>Next step due</th>
                <th>Worst DRP tier</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <Row key={r.store.id} r={r} data={data} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Row({ r, data }: { r: PortfolioRow; data: ReturnType<typeof useData>['data'] }) {
  const unassigned = r.store.spmId === '';
  const dominant = r.clientMix[0];
  const rowTone = r.challenged.isChallenged
    ? 'bg-bad-soft/40'
    : r.challenged.recoveredRecently
      ? 'bg-good-soft/40'
      : '';
  return (
    <tr className={rowTone}>
      <td>
        <Link to={`/store/${r.store.id}`} className="font-medium text-accent-hover hover:underline">
          {r.store.name}
        </Link>
        <div className="text-2xs text-muted">{r.store.id}</div>
      </td>
      <td className="text-xs">
        {regionName(data, r.store.regionId)}
        <div className="text-2xs text-muted">{data.regions.find((rg) => rg.id === r.store.regionId)?.division}</div>
      </td>
      <td>
        {unassigned ? (
          <span className="chip bg-bad-soft text-bad-text" title="No SPM assigned">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bad" /> Unassigned
          </span>
        ) : (
          <span className="text-xs">{spmName(data, r.store.spmId)}</span>
        )}
      </td>
      <td className="text-xs">
        {dominant ? (
          <span title={r.clientMix.map((c) => `${c.client.name} ${c.sharePct.toFixed(0)}%`).join(', ')}>
            {dominant.client.name} <span className="text-muted">{dominant.sharePct.toFixed(0)}%</span>
            {r.clientMix.length > 1 && <span className="text-muted"> +{r.clientMix.length - 1}</span>}
          </span>
        ) : (
          <span className="text-muted">-</span>
        )}
      </td>
      <td className="num">
        <div className="flex items-center justify-end gap-2">
          <PctOfPlan value={r.t3RevenuePct} threshold={90} />
          <Sparkline values={r.revenueSpark} tone={r.challenged.isChallenged ? 'bad' : 'neutral'} />
        </div>
      </td>
      <td className="num">
        <PctOfPlan value={r.t3VolumePct} threshold={90} />
      </td>
      <td className="num">
        {r.challenged.isChallenged ? (
          <ChallengedBadge months={r.challenged.monthsChallenged} />
        ) : r.challenged.recoveredRecently ? (
          <RecoveredBadge />
        ) : (
          <span className="text-2xs text-muted">On track</span>
        )}
      </td>
      <td>
        {r.plan ? (
          <div className="flex items-center gap-1">
            <PlanStatusBadge status={r.plan.status} />
            {r.hasOverdueStep && (
              <span className="chip bg-bad-soft text-bad-text" title="Has an overdue step">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-bad" /> overdue
              </span>
            )}
          </div>
        ) : r.challenged.isChallenged ? (
          <Link to={`/store/${r.store.id}/plan`} className="chip bg-warn-soft text-warn-text hover:underline" title="Challenged with no plan yet">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" /> No plan yet
          </Link>
        ) : (
          <span className="text-2xs text-muted">-</span>
        )}
      </td>
      <td className="text-xs">{r.nextStepDue ? dateLabel(r.nextStepDue) : <span className="text-muted">-</span>}</td>
      <td>
        <TierBadge tier={r.worstTier} />
      </td>
    </tr>
  );
}
