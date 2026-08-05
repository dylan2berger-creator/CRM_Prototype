// Screen 6 - /roll-up. The executive / VP / RVP cross-region view. Rolls the
// challenged-store picture up to region cards, a small set of application
// metrics, a ranked worst-shops table by gap to business case, a 12-month
// trend, and a Boyd-vs-JHCC split so integration performance reads separately.
// Read-only; every figure traces to the DOMO exec revenue dataset.

import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ActionPlan, Region, Store } from '@/types';
import { DIVISIONS } from '@/mock/names';
import { useData } from '@/data/DataContext';
import { useRole } from '@/app/RoleContext';
import { challengedStoreIds } from '@/data/rollups';
import { storeMetricValue, storeMetricBaseline } from '@/data/metrics';
import { challengedInfo, planForStore, regionName, trailingRevenuePctOfPlan } from '@/data/selectors';
import { evaluateStore } from '@/logic/challengedRule';
import { Panel, Stat, TbdTag, OpenQuestion, EmptyState } from '@/components/ui';
import { ChallengedBadge, PlanStatusBadge, Badge } from '@/components/status';
import { PctOfPlan } from '@/components/Variance';
import { SourceTag } from '@/components/Provenance';
import { money, moneyCompact, int, pct, monthShort, monthLabel } from '@/utils/format';
import { trailing } from '@/utils/dates';

const DATASET = 'DOMO Exec Dashboard - Revenue';

// Current-month store revenue actual and plan (sum across carriers).
function storeMonthRevenue(data: ReturnType<typeof useData>['data'], storeId: string, month: string) {
  const actual = storeMetricValue(data, storeId, 'revenueActual', month);
  const plan = storeMetricBaseline(data, storeId, 'revenueActual', month) ?? 0;
  return { actual, plan, gap: actual - plan };
}

// A plan has an overdue step when any not-done step's due date has passed.
function planHasOverdueStep(plan: ActionPlan, month: string): boolean {
  return plan.steps.some((s) => s.status !== 'Done' && s.dueOn < `${month}-01`);
}

export function RollUp() {
  const { data } = useData();
  const { role, config } = useRole();
  const cm = data.currentMonth;

  // Scope: an RVP sees only their region; everyone else sees the whole book.
  const scopedRegionId = role === 'rvp' && config.scope.type === 'region' ? config.scope.regionId : null;

  const view = useMemo(() => {
    const challenged = challengedStoreIds(data);
    const stores = scopedRegionId ? data.stores.filter((s) => s.regionId === scopedRegionId) : data.stores;
    const regions = scopedRegionId ? data.regions.filter((r) => r.id === scopedRegionId) : data.regions;

    // Per-store roll of the numbers the table + cards need.
    type Row = {
      store: Store;
      isChallenged: boolean;
      months: number;
      gap: number;
      t3Pct: number | null;
      plan: ActionPlan | undefined;
      recovered: boolean;
    };
    const rows: Row[] = stores.map((store) => {
      const info = challengedInfo(data, store.id);
      const { gap } = storeMonthRevenue(data, store.id, cm);
      return {
        store,
        isChallenged: challenged.has(store.id),
        months: info.monthsChallenged,
        gap,
        t3Pct: trailingRevenuePctOfPlan(data, store.id, 3),
        plan: planForStore(data, store.id),
        recovered: info.recoveredRecently,
      };
    });

    // Region cards.
    const regionCards = regions.map((region) => {
      const rs = rows.filter((r) => r.store.regionId === region.id);
      const challengedRows = rs.filter((r) => r.isChallenged);
      const plansInRegion = rs.filter((r) => r.plan).map((r) => r.plan!);
      const totalPlan = rs.reduce((s, r) => s + storeMonthRevenue(data, r.store.id, cm).plan, 0);
      const gapSum = rs.reduce((s, r) => s + r.gap, 0);
      const covered = challengedRows.filter((r) => r.plan).length;
      const overdue = plansInRegion.filter((p) => planHasOverdueStep(p, cm)).length;
      return {
        region,
        stores: rs.length,
        challenged: challengedRows.length,
        gapSum,
        gapPct: totalPlan > 0 ? (gapSum / totalPlan) * 100 : 0,
        planCoverage: challengedRows.length ? (covered / challengedRows.length) * 100 : null,
        overdueRate: plansInRegion.length ? (overdue / plansInRegion.length) * 100 : null,
        unassigned: rs.filter((r) => r.store.cpmId === '').length,
      };
    });

    // Application metrics (scope-wide).
    const assigned = stores.filter((s) => s.cpmId !== '').length;
    const meetingTargets = rows.filter((r) => !r.isChallenged).length;
    const recoveredCount = rows.filter((r) => r.recovered).length;
    const allSteps = rows.flatMap((r) => (r.plan ? r.plan.steps : []));
    const onTrackSteps = allSteps.filter((s) => s.status !== 'Blocked' && !(s.status !== 'Done' && s.dueOn < `${cm}-01`));
    const appMetrics = {
      cpmAssignedPct: stores.length ? (assigned / stores.length) * 100 : 0,
      meetingTargetsPct: rows.length ? (meetingTargets / rows.length) * 100 : 0,
      recoveredCount,
      tasksOnTrackPct: allSteps.length ? (onTrackSteps.length / allSteps.length) * 100 : null,
      taskCount: allSteps.length,
    };

    // Ranked worst shops by gap to business case (most negative first).
    const ranked = [...rows].sort((a, b) => a.gap - b.gap).slice(0, 25);

    // Brand split - keeps JHCC integration performance readable on its own.
    const brandSplit = (['Boyd', 'JHCC'] as const).map((brand) => {
      const bs = rows.filter((r) => r.store.brand === brand);
      const challengedRows = bs.filter((r) => r.isChallenged);
      const covered = challengedRows.filter((r) => r.plan).length;
      return {
        brand,
        stores: bs.length,
        challenged: challengedRows.length,
        gapSum: bs.reduce((s, r) => s + r.gap, 0),
        planCoverage: challengedRows.length ? (covered / challengedRows.length) * 100 : null,
      };
    });

    // 12-month trend: challenged store count and total revenue gap.
    const window = trailing(data.months, cm, 12);
    const scopeIds = new Set(stores.map((s) => s.id));
    const gapByMonth = new Map<string, number>();
    for (const m of data.metrics) {
      if (scopeIds.has(m.storeId) && window.includes(m.month)) {
        gapByMonth.set(m.month, (gapByMonth.get(m.month) ?? 0) + (m.revenueActual - m.revenuePlan));
      }
    }
    const trend = window.map((month) => ({
      month,
      challenged: stores.filter((s) => evaluateStore(s.id, month, data).isChallenged).length,
      gap: Math.round(gapByMonth.get(month) ?? 0),
    }));

    const totals = {
      stores: stores.length,
      challenged: rows.filter((r) => r.isChallenged).length,
      gapSum: rows.reduce((s, r) => s + r.gap, 0),
    };

    // Group region cards under their division (North / South / West), with a
    // subtotal per division, mirroring a Division > Region > Grand Total pivot.
    const planCount = (cards: typeof regionCards) => {
      const rs = rows.filter((r) => cards.some((c) => c.region.id === r.store.regionId));
      const ch = rs.filter((r) => r.isChallenged);
      const covered = ch.filter((r) => r.plan).length;
      const planTotal = rs.reduce((s, r) => s + storeMonthRevenue(data, r.store.id, cm).plan, 0);
      const gapSum = rs.reduce((s, r) => s + r.gap, 0);
      return {
        stores: rs.length,
        challenged: ch.length,
        gapSum,
        gapPct: planTotal > 0 ? (gapSum / planTotal) * 100 : 0,
        planCoverage: ch.length ? (covered / ch.length) * 100 : null,
      };
    };
    const divisions = DIVISIONS.map((division) => {
      const cards = regionCards.filter((c) => c.region.division === division);
      return { division, cards, subtotal: planCount(cards) };
    }).filter((d) => d.cards.length > 0);
    const grandTotal = planCount(regionCards);

    return { regionCards, divisions, grandTotal, appMetrics, ranked, brandSplit, trend, totals };
  }, [data, cm, scopedRegionId]);

  const scopeLabel = scopedRegionId ? regionName(data, scopedRegionId) : 'all regions';

  if (!view.totals.stores) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold text-ink">Executive and region roll-up</h1>
        <EmptyState title="No shops in scope">Nothing to roll up for this view.</EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <h1 className="text-lg font-semibold text-ink">Executive and region roll-up</h1>
        <p className="text-sm text-muted">
          Where the book is challenged and how far it sits from business case, rolled up across {scopeLabel} for {monthLabel(cm)}.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-0.5">
          <SourceTag dataset={DATASET} />
          <span className="text-2xs text-muted">
            {role === 'rvp' ? 'Region view' : 'Cross-region view'} · {int(view.totals.stores)} shops · {int(view.totals.challenged)} challenged ·{' '}
            {money(view.totals.gapSum)} gap to plan this month
          </span>
        </div>
      </header>

      <OpenQuestion>Application-metric targets are not set - shown as TBD.</OpenQuestion>

      {/* Application metrics strip */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Stat
          label="Shops with an assigned CPM"
          value={pct(view.appMetrics.cpmAssignedPct)}
          tone={view.appMetrics.cpmAssignedPct < 100 ? 'warn' : 'good'}
          sub={
            <span className="flex flex-wrap items-center gap-1">
              Expected to decrease as coverage tightens · Target <TbdTag />
            </span>
          }
        />
        <Stat
          label="Shops meeting targets"
          value={pct(view.appMetrics.meetingTargetsPct)}
          tone="default"
          sub={
            <span className="flex flex-wrap items-center gap-1">
              Expected to increase · {int(view.appMetrics.recoveredCount)} recovered recently · Target <TbdTag />
            </span>
          }
        />
        <Stat
          label="Action plan tasks on track"
          value={view.appMetrics.tasksOnTrackPct == null ? '-' : pct(view.appMetrics.tasksOnTrackPct)}
          tone={
            view.appMetrics.tasksOnTrackPct == null
              ? 'default'
              : view.appMetrics.tasksOnTrackPct >= 80
                ? 'good'
                : view.appMetrics.tasksOnTrackPct >= 60
                  ? 'warn'
                  : 'bad'
          }
          sub={
            <span className="flex flex-wrap items-center gap-1">
              Not blocked and not overdue · {int(view.appMetrics.taskCount)} tasks · Target <TbdTag />
            </span>
          }
        />
      </div>

      {/* Divisions and regions */}
      <Panel
        title="Divisions and regions"
        subtitle="Challenged load, gap to business case, and plan health, grouped by division"
        right={<SourceTag dataset={DATASET} />}
      >
        <div className="space-y-4">
          {view.divisions.map((d) => (
            <div key={d.division}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line-strong pb-1">
                <h3 className="text-sm font-semibold text-ink">{d.division}</h3>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs">
                  <span className="text-muted">{int(d.subtotal.stores)} shops</span>
                  <span className={d.subtotal.challenged > 0 ? 'text-bad-text' : 'text-muted'}>{int(d.subtotal.challenged)} challenged</span>
                  <span className={d.subtotal.gapSum < 0 ? 'text-bad-text' : 'text-good-text'}>
                    {moneyCompact(d.subtotal.gapSum)} gap ({pct(d.subtotal.gapPct)})
                  </span>
                  <span className="text-muted">{d.subtotal.planCoverage == null ? '-' : pct(d.subtotal.planCoverage)} plan coverage</span>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
                {d.cards.map((c) => (
                  <RegionCard key={c.region.id} c={c} />
                ))}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded border border-line-strong bg-panel px-3 py-2">
            <span className="text-sm font-semibold text-ink">Grand total</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs">
              <span className="text-muted">{int(view.grandTotal.stores)} shops</span>
              <span className={view.grandTotal.challenged > 0 ? 'font-medium text-bad-text' : 'text-muted'}>
                {int(view.grandTotal.challenged)} challenged
              </span>
              <span className={`font-medium ${view.grandTotal.gapSum < 0 ? 'text-bad-text' : 'text-good-text'}`}>
                {moneyCompact(view.grandTotal.gapSum)} gap ({pct(view.grandTotal.gapPct)})
              </span>
              <span className="text-muted">{view.grandTotal.planCoverage == null ? '-' : pct(view.grandTotal.planCoverage)} plan coverage</span>
            </div>
          </div>
        </div>
      </Panel>

      {/* Trend */}
      <Panel
        title="Challenged shops and gap to plan"
        subtitle="Trailing 12 months across the current scope"
        right={<SourceTag dataset={DATASET} />}
      >
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={view.trend} margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
              <CartesianGrid stroke="#eef2f7" vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthShort}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                minTickGap={16}
              />
              <YAxis
                yAxisId="count"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={36}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="gap"
                orientation="right"
                tickFormatter={(v) => moneyCompact(v as number)}
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={58}
              />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                labelFormatter={(m) => monthLabel(m as string)}
                formatter={(v: number, name) => [name === 'Gap to plan' ? money(v) : int(v), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                yAxisId="count"
                type="monotone"
                dataKey="challenged"
                name="Challenged shops"
                stroke="#b91c1c"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                yAxisId="gap"
                type="monotone"
                dataKey="gap"
                name="Gap to plan"
                stroke="#0f766e"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Brand split */}
      <Panel
        title="By brand"
        subtitle="Boyd and JHCC read separately so integration performance is visible"
        right={<SourceTag dataset={DATASET} />}
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Brand</th>
                <th className="text-right">Shops</th>
                <th className="text-right">Challenged</th>
                <th className="text-right">Gap to plan</th>
                <th className="text-right">Plan coverage</th>
              </tr>
            </thead>
            <tbody>
              {view.brandSplit.map((b) => (
                <tr key={b.brand}>
                  <td className="font-medium text-ink">{b.brand}</td>
                  <td className="num">{int(b.stores)}</td>
                  <td className="num">{int(b.challenged)}</td>
                  <td className={`num ${b.gapSum < 0 ? 'text-bad-text' : 'text-good-text'}`}>{money(b.gapSum)}</td>
                  <td className="num">{b.planCoverage == null ? '-' : pct(b.planCoverage)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {/* Ranked worst shops */}
      <Panel
        title="Worst shops by gap to business case"
        subtitle="Ranked by current-month revenue below plan · top 25"
        right={<SourceTag dataset={DATASET} />}
      >
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Shop</th>
                <th>Region</th>
                <th>Brand</th>
                <th className="text-right">T3 revenue % of plan</th>
                <th className="text-right">Gap this month</th>
                <th>Flag</th>
                <th>Plan</th>
              </tr>
            </thead>
            <tbody>
              {view.ranked.map((r) => (
                <tr key={r.store.id}>
                  <td>
                    <Link to={`/store/${r.store.id}`} className="font-medium text-accent hover:text-accent-hover hover:underline">
                      {r.store.name}
                    </Link>
                    <div className="text-2xs text-muted">{r.store.id}</div>
                  </td>
                  <td className="text-muted">{regionName(data, r.store.regionId)}</td>
                  <td className="text-muted">{r.store.brand}</td>
                  <td className="num">
                    <PctOfPlan value={r.t3Pct} />
                  </td>
                  <td className={`num font-medium ${r.gap < 0 ? 'text-bad-text' : 'text-good-text'}`}>{money(r.gap)}</td>
                  <td>{r.isChallenged ? <ChallengedBadge months={r.months} /> : <span className="text-2xs text-muted">-</span>}</td>
                  <td>{r.plan ? <PlanStatusBadge status={r.plan.status} /> : <span className="text-2xs text-muted">No plan</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

interface RegionCardData {
  region: Region;
  stores: number;
  challenged: number;
  gapSum: number;
  gapPct: number;
  planCoverage: number | null;
  overdueRate: number | null;
  unassigned: number;
}

function RegionCard({ c }: { c: RegionCardData }) {
  return (
    <div className="rounded border border-line bg-panel p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-ink">{c.region.name}</div>
          <div className="text-2xs text-muted">RVP {c.region.rvpName} · {int(c.stores)} shops</div>
        </div>
        {c.challenged > 0 ? (
          <Badge variant="bad" title={`${c.challenged} challenged shops`}>{int(c.challenged)} challenged</Badge>
        ) : (
          <Badge variant="good">On track</Badge>
        )}
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
        <div>
          <dt className="text-2xs uppercase tracking-wide text-muted">Challenged</dt>
          <dd className="tnum font-semibold text-ink">{int(c.challenged)}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-muted">Gap to plan</dt>
          <dd className={`tnum font-semibold ${c.gapSum < 0 ? 'text-bad-text' : 'text-good-text'}`}>
            {moneyCompact(c.gapSum)} <span className="text-2xs font-normal text-muted">({pct(c.gapPct)})</span>
          </dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-muted">Plan coverage</dt>
          <dd className="tnum text-ink">{c.planCoverage == null ? '-' : pct(c.planCoverage)}</dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-muted">Overdue step rate</dt>
          <dd className={`tnum ${c.overdueRate != null && c.overdueRate > 0 ? 'text-warn-text' : 'text-ink'}`}>
            {c.overdueRate == null ? '-' : pct(c.overdueRate)}
          </dd>
        </div>
        <div>
          <dt className="text-2xs uppercase tracking-wide text-muted">Unassigned CPM</dt>
          <dd className={`tnum ${c.unassigned > 0 ? 'text-warn-text' : 'text-ink'}`}>{int(c.unassigned)}</dd>
        </div>
      </dl>
    </div>
  );
}
