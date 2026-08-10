// MVP home - one consolidated screen that covers the core stories:
//  - identify / monitor / prioritize challenged shops (story 1), at shop,
//    region and carrier levels, comparing forecast revenue + DRP volume vs
//    actual and DRP score;
//  - surface automated anomaly / drop alerts (story 3);
//  - show the owner of each shop and plan for accountability (story 7),
//    linking into the store record for root cause, plan and history.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '@/data/DataContext';
import { useRole } from '@/app/RoleContext';
import {
  portfolioRow,
  PortfolioRow,
  regionName,
  clientById,
  spmName,
  storeById,
  storesForScope,
} from '@/data/selectors';
import { rollupsForMonth } from '@/data/rollups';
import { Panel, Stat, Segmented, EmptyState } from '@/components/ui';
import { ChallengedBadge, PlanStatusBadge, RecoveredBadge, TierBadge } from '@/components/status';
import { Variance, PctOfPlan } from '@/components/Variance';
import { SourceTag } from '@/components/Provenance';
import { dateLabel, int, monthLabel } from '@/utils/format';

type Level = 'shop' | 'division' | 'region' | 'carrier';

export function MvpHome() {
  const { data } = useData();
  const { config, role } = useRole();
  const cur = data.currentMonth;

  // The VP persona (exec) lands on the by-division rollup; everyone else starts
  // on the shop watchlist.
  const [level, setLevel] = useState<Level>(role === 'exec' ? 'division' : 'shop');
  const [showAll, setShowAll] = useState(false);

  // Re-land on the persona's default level when the role changes.
  useEffect(() => {
    setLevel(role === 'exec' ? 'division' : 'shop');
  }, [role]);

  const stores = storesForScope(data, config.scope);
  const rows = useMemo(() => stores.map((s) => portfolioRow(data, s)), [stores, data]);

  const challenged = rows.filter((r) => r.challenged.isChallenged);
  const recovered = rows.filter((r) => !r.challenged.isChallenged && r.challenged.recoveredRecently);
  const noPlan = challenged.filter((r) => !r.plan);

  const watchlist = useMemo(() => {
    const base = showAll ? rows : [...challenged, ...recovered];
    return [...base].sort((a, b) => {
      if (a.challenged.isChallenged !== b.challenged.isChallenged) return a.challenged.isChallenged ? -1 : 1;
      return (a.t3RevenuePct ?? 999) - (b.t3RevenuePct ?? 999);
    });
  }, [rows, challenged, recovered, showAll]);

  const alerts = useMemo(
    () => [...data.alerts].sort((a, b) => (a.raisedOn < b.raisedOn ? 1 : -1)),
    [data.alerts],
  );
  const openAlerts = alerts.filter((a) => !a.acknowledged);

  const regionRows = useMemo(() => {
    return rollupsForMonth(data, 'region', cur)
      .map((r) => ({
        id: r.keys.regionId ?? '',
        name: regionName(data, r.keys.regionId ?? ''),
        revVar: r.revenueForecast > 0 ? (r.revenueActual / r.revenueForecast - 1) * 100 : null,
        asnVar: r.assignmentForecast > 0 ? (r.assignmentActual / r.assignmentForecast - 1) * 100 : null,
        score: r.drpScoreAvg,
        challenged: r.challengedStoreCount,
      }))
      .sort((a, b) => b.challenged - a.challenged || (a.revVar ?? 0) - (b.revVar ?? 0));
  }, [data, cur]);

  const divisionRows = useMemo(() => {
    return rollupsForMonth(data, 'division', cur)
      .map((r) => ({
        id: r.keys.division ?? '',
        name: r.keys.division ?? '',
        revVar: r.revenueForecast > 0 ? (r.revenueActual / r.revenueForecast - 1) * 100 : null,
        asnVar: r.assignmentForecast > 0 ? (r.assignmentActual / r.assignmentForecast - 1) * 100 : null,
        score: r.drpScoreAvg,
        challenged: r.challengedStoreCount,
      }))
      .sort((a, b) => b.challenged - a.challenged || (a.revVar ?? 0) - (b.revVar ?? 0));
  }, [data, cur]);

  const carrierRows = useMemo(() => {
    return rollupsForMonth(data, 'carrier', cur)
      .map((r) => ({
        id: r.keys.clientId ?? '',
        name: clientById(data, r.keys.clientId ?? '')?.name ?? r.keys.clientId ?? '',
        revVar: r.revenueForecast > 0 ? (r.revenueActual / r.revenueForecast - 1) * 100 : null,
        asnVar: r.assignmentForecast > 0 ? (r.assignmentActual / r.assignmentForecast - 1) * 100 : null,
        score: r.drpScoreAvg,
        challenged: r.challengedStoreCount,
      }))
      .sort((a, b) => (a.asnVar ?? 0) - (b.asnVar ?? 0));
  }, [data, cur]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-ink">Challenged shops</h1>
            <span className="chip bg-accent-soft text-accent">MVP</span>
          </div>
          <p className="text-xs text-muted">
            {role === 'spm' || role === 'cpm' ? `${config.userName}'s book` : config.label} for {monthLabel(cur)}. Forecast
            revenue and DRP volume vs actual and DRP score - prioritized so the shops missing KPIs surface first.
          </p>
        </div>
        <SourceTag dataset="DOMO Exec Dashboard - Revenue" />
      </header>

      {/* KPI summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Challenged shops" value={int(challenged.length)} sub={`of ${rows.length} in book`} tone={challenged.length ? 'bad' : 'good'} />
        <Stat label="No plan yet" value={int(noPlan.length)} sub="challenged, no action plan" tone={noPlan.length ? 'warn' : 'good'} />
        <Stat label="Open alerts" value={int(openAlerts.length)} sub="anomalies + drops to review" tone={openAlerts.length ? 'warn' : 'good'} />
        <Stat label="Recovered" value={int(recovered.length)} sub="back on track (last 2 mo)" tone="good" />
      </div>

      {/* Prioritized watchlist across levels */}
      <Panel
        title="Prioritized watchlist"
        subtitle="Track the same picture at shop, division, region, and insurance-partner level."
        right={
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: 'shop', label: 'Shop' },
              { value: 'division', label: 'Division' },
              { value: 'region', label: 'Region' },
              { value: 'carrier', label: 'Insurance Partner' },
            ]}
          />
        }
      >
        {level === 'shop' && (
          <>
            <label className="mb-2 flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
              Show all shops (default: challenged and recently recovered only)
            </label>
            {watchlist.length === 0 ? (
              <EmptyState title="No challenged shops in this book">Every shop is meeting its KPIs this month.</EmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Shop</th>
                      <th>Region</th>
                      <th title="Shop Performance Manager who owns this shop">Owner</th>
                      <th className="text-right">Revenue vs plan</th>
                      <th className="text-right">DRP volume vs forecast</th>
                      <th>Worst DRP tier</th>
                      <th>Status</th>
                      <th>Action plan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchlist.map((r) => (
                      <ShopRow key={r.store.id} r={r} data={data} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {level === 'division' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Division</th>
                  <th className="text-right">Challenged shops</th>
                  <th className="text-right">Revenue vs forecast</th>
                  <th className="text-right">DRP volume vs forecast</th>
                  <th className="text-right">Avg DRP score</th>
                </tr>
              </thead>
              <tbody>
                {divisionRows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.name}</td>
                    <td className="num">{r.challenged}</td>
                    <td className="num"><Variance pct={r.revVar} /></td>
                    <td className="num"><Variance pct={r.asnVar} /></td>
                    <td className="num text-muted">{r.score != null ? r.score.toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {level === 'region' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Region</th>
                  <th className="text-right">Challenged shops</th>
                  <th className="text-right">Revenue vs forecast</th>
                  <th className="text-right">DRP volume vs forecast</th>
                  <th className="text-right">Avg DRP score</th>
                </tr>
              </thead>
              <tbody>
                {regionRows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.name}</td>
                    <td className="num">{r.challenged}</td>
                    <td className="num"><Variance pct={r.revVar} /></td>
                    <td className="num"><Variance pct={r.asnVar} /></td>
                    <td className="num text-muted">{r.score != null ? r.score.toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {level === 'carrier' && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Insurance Partner</th>
                  <th className="text-right">Challenged shops</th>
                  <th className="text-right">Revenue vs forecast</th>
                  <th className="text-right">Assignment vs forecast</th>
                  <th className="text-right">Avg DRP score</th>
                </tr>
              </thead>
              <tbody>
                {carrierRows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-medium text-ink">{r.name}</td>
                    <td className="num">{r.challenged}</td>
                    <td className="num"><Variance pct={r.revVar} /></td>
                    <td className="num"><Variance pct={r.asnVar} /></td>
                    <td className="num text-muted">{r.score != null ? r.score.toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Automated anomaly / drop alerts */}
      <Panel
        title="Recent alerts"
        subtitle="Anomalies and KPI drops flagged automatically, so you can intervene before a shop crosses the challenged threshold."
        right={
          <Link to="/alerts" className="text-xs text-accent hover:underline">
            View all ({openAlerts.length} open)
          </Link>
        }
      >
        {alerts.length === 0 ? (
          <p className="text-xs text-muted">No alerts this period.</p>
        ) : (
          <ul className="divide-y divide-line">
            {alerts.slice(0, 6).map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2">
                <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.acknowledged ? 'bg-line-strong' : 'bg-warn'}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-ink">{a.message}</div>
                  <div className="text-2xs text-muted">
                    {a.kind} · {dateLabel(a.raisedOn)}
                    {' · '}
                    <Link to={`/store/${a.storeId}`} className="text-accent hover:underline">
                      {storeById(data, a.storeId)?.name ?? a.storeId}
                    </Link>
                  </div>
                </div>
                {!a.acknowledged && <span className="chip bg-warn-soft text-warn-text">Open</span>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ShopRow({ r, data }: { r: PortfolioRow; data: ReturnType<typeof useData>['data'] }) {
  const unassigned = r.store.spmId === '';
  return (
    <tr className={r.challenged.isChallenged ? 'bg-bad-soft/40' : r.challenged.recoveredRecently ? 'bg-good-soft/40' : ''}>
      <td>
        <Link to={`/store/${r.store.id}`} className="font-medium text-accent hover:underline">
          {r.store.name}
        </Link>
        <div className="text-2xs text-muted">{r.store.id}</div>
      </td>
      <td className="text-xs">
        {regionName(data, r.store.regionId)}
        <div className="text-2xs text-muted">{data.regions.find((rg) => rg.id === r.store.regionId)?.division}</div>
      </td>
      <td className="text-xs">
        {unassigned ? (
          <span className="chip bg-bad-soft text-bad-text">Unassigned</span>
        ) : (
          spmName(data, r.store.spmId)
        )}
      </td>
      <td className="num"><PctOfPlan value={r.t3RevenuePct} threshold={90} /></td>
      <td className="num"><PctOfPlan value={r.t3VolumePct} threshold={90} /></td>
      <td><TierBadge tier={r.worstTier} /></td>
      <td>
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
          <div className="flex flex-col gap-0.5">
            <PlanStatusBadge status={r.plan.status} />
            <span className="text-2xs text-muted">{r.plan.createdBy}</span>
          </div>
        ) : r.challenged.isChallenged ? (
          <Link to={`/store/${r.store.id}/plan`} className="chip bg-warn-soft text-warn-text hover:underline">
            Create plan
          </Link>
        ) : (
          <span className="text-2xs text-muted">-</span>
        )}
      </td>
    </tr>
  );
}
