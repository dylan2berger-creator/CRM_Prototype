// Screen 4 - /analysis: forecast vs actual, deficiency, and root cause.
// The pivot control is the point: one toggle re-aggregates the whole screen
// across carrier / region / shop / carrier-in-region so the VP can answer
// "which carriers are underperforming forecast across the Southeast" without
// leaving the page. Everything reads from PerformanceRollup + the diagnostic
// metric set. Portfolio-wide by default (this is a cross-shop exec/VP screen);
// the filter controls, not role scope, narrow it.

import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { PerformanceRollup } from '@/types';
import { useData } from '@/data/DataContext';
import { PivotLevel, challengedStoreIds, rollupsForMonth, rollupTrend } from '@/data/rollups';
import {
  clientById,
  cbsaById,
  planForStore,
  regionName,
  storeById,
  trailingRevenuePctOfPlan,
} from '@/data/selectors';
import { DIAGNOSTIC_METRICS, METRICS, formatMetric, scopeMetricValue, storeMetricValue } from '@/data/metrics';
import { diagnose } from '@/data/diagnosis';
import { TIER_ORDER } from '@/data/selectors';
import { addMonths, trailing } from '@/utils/dates';
import { int, money, moneyCompact, monthLabel, monthShort, pct, pctSigned } from '@/utils/format';
import { Field, OpenQuestion, Panel, Segmented, Select, Stat } from '@/components/ui';
import { Variance } from '@/components/Variance';
import { Sparkline } from '@/components/Sparkline';
import { SourceTag } from '@/components/Provenance';
import { TierBadge } from '@/components/status';

type SortKey = 'gap' | 'trend' | 'noplan';

const LEVEL_OPTIONS: { value: PivotLevel; label: string }[] = [
  { value: 'carrier', label: 'Carrier' },
  { value: 'region', label: 'Region' },
  { value: 'store', label: 'Shop' },
  { value: 'carrier-in-region', label: 'Carrier within region' },
];

const LEVEL_NOUN: Record<PivotLevel, string> = {
  carrier: 'carrier',
  region: 'region',
  store: 'shop',
  'carrier-in-region': 'carrier within region',
};

// One computed row of the main pivot table.
interface Row {
  key: string;
  label: string;
  storeId?: string;
  clientId?: string;
  regionId?: string;
  revenueActual: number;
  revenueForecast: number;
  assignmentActual: number;
  assignmentForecast: number;
  drpScoreAvg: number | null;
  challengedStoreCount: number;
  revGapPct: number | null; // (actual - forecast) / forecast * 100
  trendDelta: number | null; // change in revenue %-of-forecast vs 3 months ago
  hasPlan: boolean; // store level only
  groupStoreIds: string[];
}

const rowKeyOf = (k: PerformanceRollup['keys']): string => `${k.storeId ?? ''}|${k.clientId ?? ''}|${k.regionId ?? ''}`;
const gapPct = (actual: number, forecast: number): number | null => (forecast > 0 ? ((actual - forecast) / forecast) * 100 : null);

export function Analysis() {
  const { data } = useData();
  const cur = data.currentMonth;
  const prior3 = addMonths(cur, -3);

  const [level, setLevel] = useState<PivotLevel>('carrier');
  const [sort, setSort] = useState<SortKey>('gap');
  const [region, setRegion] = useState('all');
  const [client, setClient] = useState('all');
  const [drp, setDrp] = useState<'all' | 'drp' | 'nondrp'>('all');
  const [cbsa, setCbsa] = useState('all');
  const [brand, setBrand] = useState('all');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const challenged = challengedStoreIds(data);

  // --- Filter universes ------------------------------------------------------
  const filteredStores = useMemo(
    () =>
      data.stores.filter(
        (s) =>
          (region === 'all' || s.regionId === region) &&
          (brand === 'all' || s.brand === brand) &&
          (cbsa === 'all' || s.cbsaId === cbsa),
      ),
    [data.stores, region, brand, cbsa],
  );
  const filteredStoreIds = useMemo(() => new Set(filteredStores.map((s) => s.id)), [filteredStores]);
  const filteredRegionIds = useMemo(
    () => (region === 'all' ? new Set(filteredStores.map((s) => s.regionId)) : new Set([region])),
    [filteredStores, region],
  );
  const filteredClientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of data.clients) {
      if (client !== 'all' && c.id !== client) continue;
      if (drp === 'drp' && !c.isDrp) continue;
      if (drp === 'nondrp' && c.isDrp) continue;
      ids.add(c.id);
    }
    return ids;
  }, [data.clients, client, drp]);

  // client -> stores that trade with it (for group scoping of carrier rollups)
  const clientStores = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const row of data.metrics) {
      let s = m.get(row.clientId);
      if (!s) m.set(row.clientId, (s = new Set()));
      s.add(row.storeId);
    }
    return m;
  }, [data.metrics]);

  // --- Rollups for the current + prior month (prior drives the trend arrow) ---
  const curRollups = useMemo(() => rollupsForMonth(data, level, cur), [data, level, cur]);
  const priorRollups = useMemo(() => rollupsForMonth(data, level, prior3), [data, level, prior3]);
  const priorByKey = useMemo(() => {
    const m = new Map<string, PerformanceRollup>();
    for (const r of priorRollups) m.set(rowKeyOf(r.keys), r);
    return m;
  }, [priorRollups]);

  // --- Build + filter the pivot rows -----------------------------------------
  const rows = useMemo<Row[]>(() => {
    const keep = (r: PerformanceRollup): boolean => {
      const k = r.keys;
      if (k.storeId != null && !filteredStoreIds.has(k.storeId)) return false;
      if (k.regionId != null && !filteredRegionIds.has(k.regionId)) return false;
      if (k.clientId != null && !filteredClientIds.has(k.clientId)) return false;
      return true;
    };
    const label = (k: PerformanceRollup['keys']): string => {
      switch (level) {
        case 'store':
          return storeById(data, k.storeId!)?.name ?? k.storeId!;
        case 'carrier':
          return clientById(data, k.clientId!)?.name ?? k.clientId!;
        case 'region':
          return regionName(data, k.regionId!);
        case 'carrier-in-region':
          return `${clientById(data, k.clientId!)?.name ?? k.clientId} · ${regionName(data, k.regionId!)}`;
      }
    };
    const groupStores = (k: PerformanceRollup['keys']): string[] => {
      switch (level) {
        case 'store':
          return [k.storeId!];
        case 'region':
          return filteredStores.filter((s) => s.regionId === k.regionId).map((s) => s.id);
        case 'carrier':
          return [...(clientStores.get(k.clientId!) ?? [])].filter((id) => filteredStoreIds.has(id));
        case 'carrier-in-region': {
          const inRegion = new Set(filteredStores.filter((s) => s.regionId === k.regionId).map((s) => s.id));
          return [...(clientStores.get(k.clientId!) ?? [])].filter((id) => inRegion.has(id));
        }
      }
    };

    return curRollups.filter(keep).map((r) => {
      const key = rowKeyOf(r.keys);
      const prev = priorByKey.get(key);
      const nowPct = gapPct(r.revenueActual, r.revenueForecast);
      const prevPct = prev ? gapPct(prev.revenueActual, prev.revenueForecast) : null;
      return {
        key,
        label: label(r.keys),
        storeId: r.keys.storeId,
        clientId: r.keys.clientId,
        regionId: r.keys.regionId,
        revenueActual: r.revenueActual,
        revenueForecast: r.revenueForecast,
        assignmentActual: r.assignmentActual,
        assignmentForecast: r.assignmentForecast,
        drpScoreAvg: r.drpScoreAvg,
        challengedStoreCount: r.challengedStoreCount,
        revGapPct: nowPct,
        trendDelta: nowPct != null && prevPct != null ? nowPct - prevPct : null,
        hasPlan: r.keys.storeId ? !!planForStore(data, r.keys.storeId) : true,
        groupStoreIds: groupStores(r.keys),
      };
    });
  }, [curRollups, priorByKey, level, data, filteredStores, filteredStoreIds, filteredRegionIds, filteredClientIds, clientStores]);

  // Default sort surfaces the entities worth acting on, never alphabetical.
  const sortedRows = useMemo(() => {
    const gapDollars = (r: Row) => r.revenueActual - r.revenueForecast; // negative = shortfall
    const copy = [...rows];
    if (sort === 'gap') {
      copy.sort((a, b) => gapDollars(a) - gapDollars(b)); // biggest shortfall first
    } else if (sort === 'trend') {
      copy.sort((a, b) => (a.trendDelta ?? 0) - (b.trendDelta ?? 0)); // steepest decline first
    } else {
      // gap with no plan first (store level); then by shortfall
      copy.sort((a, b) => {
        const an = !a.hasPlan && gapDollars(a) < 0 ? 0 : 1;
        const bn = !b.hasPlan && gapDollars(b) < 0 ? 0 : 1;
        if (an !== bn) return an - bn;
        return gapDollars(a) - gapDollars(b);
      });
    }
    return copy;
  }, [rows, sort]);

  const selectedRow = useMemo(
    () => sortedRows.find((r) => r.key === selectedKey) ?? sortedRows[0],
    [sortedRows, selectedKey],
  );

  // --- Headline aggregate (foots to the visible rows) ------------------------
  const totals = useMemo(() => {
    let ra = 0;
    let rf = 0;
    let aa = 0;
    let af = 0;
    let scoreSum = 0;
    let scoreN = 0;
    for (const r of rows) {
      ra += r.revenueActual;
      rf += r.revenueForecast;
      aa += r.assignmentActual;
      af += r.assignmentForecast;
      if (r.drpScoreAvg != null) {
        scoreSum += r.drpScoreAvg;
        scoreN++;
      }
    }
    const challengedInView = [...filteredStoreIds].filter((id) => challenged.has(id)).length;
    return { ra, rf, aa, af, avgScore: scoreN ? scoreSum / scoreN : null, challengedInView };
  }, [rows, filteredStoreIds, challenged]);

  // --- DRP score trend for the selected entity (rollupTrend) -----------------
  const scoreTrend = useMemo(() => {
    if (!selectedRow) return [];
    const match = (r: PerformanceRollup) => {
      const k = r.keys;
      if (level === 'store') return k.storeId === selectedRow.storeId;
      if (level === 'carrier') return k.clientId === selectedRow.clientId;
      if (level === 'region') return k.regionId === selectedRow.regionId;
      return k.clientId === selectedRow.clientId && k.regionId === selectedRow.regionId;
    };
    return rollupTrend(data, level, match).map((r) => ({
      month: r.month,
      score: r.drpScoreAvg,
      revPctOfForecast: r.revenueForecast > 0 ? (r.revenueActual / r.revenueForecast) * 100 : null,
    }));
  }, [data, level, selectedRow]);

  // --- Root cause: diagnostic metric set across the selected group -----------
  const rootCause = useMemo(() => {
    if (!selectedRow) return null;
    if (level === 'store' && selectedRow.storeId) {
      return { kind: 'store' as const, storeId: selectedRow.storeId, diag: diagnose(data, selectedRow.storeId) };
    }
    const group = selectedRow.groupStoreIds;
    const portfolio = [...filteredStoreIds];
    const rowsMetrics = DIAGNOSTIC_METRICS.map((metric) => {
      const meta = METRICS[metric];
      const groupVal = scopeMetricValue(data, group, metric, cur);
      const portVal = scopeMetricValue(data, portfolio, metric, cur);
      const variancePct = portVal !== 0 ? ((groupVal - portVal) / portVal) * 100 : 0;
      const adverse = meta.higherIsBetter ? variancePct < 0 : variancePct > 0;
      // how many stores in the group sit on the adverse side of the portfolio value
      let adverseStores = 0;
      for (const id of group) {
        const v = storeMetricValue(data, id, metric, cur);
        if (meta.higherIsBetter ? v < portVal : v > portVal) adverseStores++;
      }
      return { metric, groupVal, portVal, variancePct, adverse, adverseStores, groupN: group.length };
    });
    return { kind: 'group' as const, rows: rowsMetrics, groupN: group.length };
  }, [data, level, selectedRow, filteredStoreIds, cur]);

  // --- PIF + Boyd share by CBSA (trended) ------------------------------------
  const marketRows = useMemo(() => {
    const wanted = new Set(filteredStores.map((s) => s.cbsaId));
    const byCbsa = new Map<string, { pif: number[]; share: number[]; months: string[] }>();
    for (const m of data.cbsaMarkets) {
      if (!wanted.has(m.cbsaId)) continue;
      let e = byCbsa.get(m.cbsaId);
      if (!e) byCbsa.set(m.cbsaId, (e = { pif: [], share: [], months: [] }));
      e.months.push(m.month);
      e.pif.push(m.pifCount);
      e.share.push(m.boydSharePct);
    }
    const win = new Set(trailing(data.months, cur, 12));
    const out = [...byCbsa.entries()].map(([cbsaId, e]) => {
      // series are in cbsaMarkets order (chronological per cbsa)
      const pifWin = e.months.map((mo, i) => ({ mo, v: e.pif[i] })).filter((x) => win.has(x.mo)).map((x) => x.v);
      const shareWin = e.months.map((mo, i) => ({ mo, v: e.share[i] })).filter((x) => win.has(x.mo)).map((x) => x.v);
      const shareNow = shareWin[shareWin.length - 1] ?? 0;
      const shareThen = shareWin[0] ?? shareNow;
      const shareDelta = shareNow - shareThen;
      const c = cbsaById(data, cbsaId);
      return {
        cbsaId,
        name: c ? `${c.name}, ${c.state}` : cbsaId,
        pifNow: pifWin[pifWin.length - 1] ?? 0,
        pifSpark: pifWin,
        shareNow,
        shareSpark: shareWin,
        shareDelta,
      };
    });
    // shrinking markets first - the ones that reframe a shop miss as a market miss
    out.sort((a, b) => a.shareDelta - b.shareDelta);
    return out;
  }, [data, filteredStores, cur]);

  // --- DRP standing (score, rank, tier, 3-month tier change) -----------------
  const standingRows = useMemo(() => {
    const priorIdx = new Map<string, (typeof data.scorecards)[number]>();
    for (const s of data.scorecards) if (s.month === prior3) priorIdx.set(`${s.storeId}|${s.clientId}`, s);
    const out = data.scorecards
      .filter((s) => s.month === cur && filteredStoreIds.has(s.storeId) && filteredClientIds.has(s.clientId))
      .map((s) => {
        const prev = priorIdx.get(`${s.storeId}|${s.clientId}`);
        const tierMove = prev ? TIER_ORDER.indexOf(prev.tier) - TIER_ORDER.indexOf(s.tier) : 0; // + = improved
        return {
          storeId: s.storeId,
          storeName: storeById(data, s.storeId)?.name ?? s.storeId,
          clientName: clientById(data, s.clientId)?.name ?? s.clientId,
          score: s.score,
          scoreDelta: prev ? s.score - prev.score : null,
          rankInCbsa: s.rankInCbsa,
          competitorsInCbsa: s.competitorsInCbsa,
          tier: s.tier,
          priorTier: prev?.tier ?? null,
          tierMove,
        };
      });
    out.sort((a, b) => a.score - b.score); // worst standing first
    return out;
  }, [data, cur, prior3, filteredStoreIds, filteredClientIds]);

  // --- Shop problem vs market problem scatter --------------------------------
  const scatter = useMemo(() => {
    const shareByCbsa = new Map<string, number>();
    for (const m of data.cbsaMarkets) if (m.month === cur) shareByCbsa.set(m.cbsaId, m.boydSharePct);
    const pts = filteredStores
      .map((s) => {
        const y = trailingRevenuePctOfPlan(data, s.id, 3);
        const x = shareByCbsa.get(s.cbsaId);
        if (y == null || x == null) return null;
        return { id: s.id, name: s.name, x, y, challenged: challenged.has(s.id) };
      })
      .filter((p): p is { id: string; name: string; x: number; y: number; challenged: boolean } => p !== null);
    const xs = pts.map((p) => p.x).sort((a, b) => a - b);
    const medianShare = xs.length ? xs[Math.floor(xs.length / 2)] : 0;
    return { pts, medianShare };
  }, [data, filteredStores, cur, challenged]);

  const gapDollars = totals.ra - totals.rf;
  const revGapPct = gapPct(totals.ra, totals.rf);
  const volGapUnits = totals.aa - totals.af;
  const volGapPct = gapPct(totals.aa, totals.af);
  const noun = LEVEL_NOUN[level];

  const selectorOptions = sortedRows.slice(0, 60).map((r) => ({ value: r.key, label: r.label }));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Forecast vs actual, deficiency, and root cause</h1>
        <p className="mt-0.5 text-sm text-muted">
          Pivot the whole view across carrier, region, shop, or carrier within region to see where actuals miss
          forecast, how deep the deficiency runs, and whether the cause is execution or the market.
        </p>
      </div>

      {/* Pivot + filters ----------------------------------------------------- */}
      <Panel
        title="Pivot and filters"
        subtitle="The pivot re-aggregates every table and chart below. Filters narrow the portfolio."
        right={<SourceTag dataset="DOMO Exec Dashboard - Revenue" />}
      >
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted">Pivot by</span>
            <Segmented value={level} onChange={(v) => { setLevel(v); setSelectedKey(null); }} options={LEVEL_OPTIONS} />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Field label="Region">
              <Select
                value={region}
                onChange={setRegion}
                aria-label="Filter by region"
                options={[{ value: 'all', label: 'All regions' }, ...data.regions.map((r) => ({ value: r.id, label: r.name }))]}
              />
            </Field>
            <Field label="Carrier">
              <Select
                value={client}
                onChange={setClient}
                aria-label="Filter by carrier"
                options={[{ value: 'all', label: 'All carriers' }, ...data.clients.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </Field>
            <Field label="DRP">
              <Select
                value={drp}
                onChange={(v) => setDrp(v as 'all' | 'drp' | 'nondrp')}
                aria-label="Filter by DRP status"
                options={[
                  { value: 'all', label: 'All carriers' },
                  { value: 'drp', label: 'DRP carriers only' },
                  { value: 'nondrp', label: 'Non-DRP only' },
                ]}
              />
            </Field>
            <Field label="CBSA">
              <Select
                value={cbsa}
                onChange={setCbsa}
                aria-label="Filter by CBSA"
                options={[{ value: 'all', label: 'All CBSAs' }, ...data.cbsas.map((c) => ({ value: c.id, label: `${c.name}, ${c.state}` }))]}
              />
            </Field>
            <Field label="Brand">
              <Select
                value={brand}
                onChange={setBrand}
                aria-label="Filter by brand"
                options={[
                  { value: 'all', label: 'All brands' },
                  { value: 'Boyd', label: 'Boyd' },
                  { value: 'JHCC', label: 'JHCC' },
                ]}
              />
            </Field>
          </div>
          {level === 'carrier' && (region !== 'all' || cbsa !== 'all' || brand !== 'all') && (
            <OpenQuestion>
              Carrier rollups are portfolio-wide across every shop. Region, CBSA, and brand filters do not constrain
              them - switch to carrier within region to scope a carrier to the Southeast or any single region.
            </OpenQuestion>
          )}
        </div>
      </Panel>

      {/* Headline forecast vs actual ---------------------------------------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Revenue actual vs forecast"
          value={moneyCompact(totals.ra)}
          sub={`Forecast ${moneyCompact(totals.rf)} · gap ${moneyCompact(gapDollars)} (${revGapPct == null ? '-' : pctSigned(revGapPct)})`}
          tone={revGapPct != null && revGapPct < -2 ? 'bad' : revGapPct != null && revGapPct < 0 ? 'warn' : 'good'}
        />
        <Stat
          label="DRP volume actual vs forecast"
          value={int(totals.aa)}
          sub={`Forecast ${int(totals.af)} · gap ${int(volGapUnits)} (${volGapPct == null ? '-' : pctSigned(volGapPct)})`}
          tone={volGapPct != null && volGapPct < -2 ? 'bad' : volGapPct != null && volGapPct < 0 ? 'warn' : 'good'}
        />
        <Stat
          label={`Avg DRP score (${noun})`}
          value={totals.avgScore == null ? '-' : totals.avgScore.toFixed(1)}
          sub={`Across ${rows.length} ${noun}${rows.length === 1 ? '' : 's'} in view`}
        />
        <Stat
          label="Challenged shops in view"
          value={int(totals.challengedInView)}
          sub={`of ${filteredStoreIds.size} shops`}
          tone={totals.challengedInView > 0 ? 'warn' : 'default'}
        />
      </div>

      {/* Main pivot table ---------------------------------------------------- */}
      <Panel
        title={`Forecast vs actual by ${noun}`}
        subtitle="Revenue and DRP assignment volume side by side - a shop can hit revenue and still miss DRP volume."
        right={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xs uppercase tracking-wide text-muted">Sort</span>
            <Segmented
              size="sm"
              value={sort}
              onChange={setSort}
              options={[
                { value: 'gap', label: 'Revenue gap' },
                { value: 'trend', label: 'Declining' },
                { value: 'noplan', label: 'Gap · no plan' },
              ]}
            />
          </div>
        }
      >
        {sortedRows.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">No {noun}s match the current filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{noun.charAt(0).toUpperCase() + noun.slice(1)}</th>
                  <th className="num">Revenue actual</th>
                  <th className="num">Revenue forecast</th>
                  <th className="num">Gap $</th>
                  <th className="num">Gap %</th>
                  <th className="num">3-mo trend</th>
                  <th className="num">DRP vol actual</th>
                  <th className="num">DRP vol forecast</th>
                  <th className="num">Gap units</th>
                  <th className="num">Gap %</th>
                  <th className="num">Avg score</th>
                  <th className="num">Challenged</th>
                  {level === 'store' && <th>Plan</th>}
                </tr>
              </thead>
              <tbody>
                {sortedRows.slice(0, 120).map((r) => {
                  const rGap = r.revenueActual - r.revenueForecast;
                  const vGap = r.assignmentActual - r.assignmentForecast;
                  const vPct = gapPct(r.assignmentActual, r.assignmentForecast);
                  const active = selectedRow?.key === r.key;
                  return (
                    <tr
                      key={r.key}
                      onClick={() => setSelectedKey(r.key)}
                      className={`cursor-pointer ${active ? 'bg-accent-soft' : ''}`}
                    >
                      <td className="max-w-[16rem] truncate">
                        {level === 'store' && r.storeId ? (
                          <Link to={`/store/${r.storeId}`} className="text-accent hover:underline" onClick={(e) => e.stopPropagation()}>
                            {r.label}
                          </Link>
                        ) : (
                          r.label
                        )}
                      </td>
                      <td className="num">{money(r.revenueActual)}</td>
                      <td className="num text-muted">{money(r.revenueForecast)}</td>
                      <td className="num">{money(rGap)}</td>
                      <td className="num"><Variance pct={r.revGapPct} /></td>
                      <td className="num"><Variance pct={r.trendDelta} /></td>
                      <td className="num">{int(r.assignmentActual)}</td>
                      <td className="num text-muted">{int(r.assignmentForecast)}</td>
                      <td className="num">{int(vGap)}</td>
                      <td className="num"><Variance pct={vPct} /></td>
                      <td className="num">{r.drpScoreAvg == null ? '-' : r.drpScoreAvg.toFixed(1)}</td>
                      <td className="num">{r.challengedStoreCount || '-'}</td>
                      {level === 'store' && (
                        <td>
                          {r.hasPlan ? (
                            <span className="text-2xs text-muted">Has plan</span>
                          ) : rGap < 0 ? (
                            <span className="chip bg-warn-soft text-warn-text ring-1 ring-inset ring-warn/30">No plan</span>
                          ) : (
                            <span className="text-2xs text-muted">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-2xs text-muted">
            {sortedRows.length > 120 ? `Showing top 120 of ${sortedRows.length}. ` : ''}
            Row selection drives the score trend and root-cause panels below.
          </p>
          <div className="flex items-center gap-3">
            <SourceTag dataset="DOMO Exec Dashboard - Revenue" />
            <SourceTag dataset="BDAP - DRP Assignments" />
          </div>
        </div>
      </Panel>

      {/* Score trend + root cause ------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title={`DRP score trend - ${selectedRow?.label ?? '-'}`}
          subtitle="Score decay at the group level shows before individual shops flag."
          right={
            selectorOptions.length > 1 ? (
              <Select
                className="max-w-[12rem]"
                value={selectedRow?.key ?? ''}
                onChange={setSelectedKey}
                aria-label="Select entity to trend"
                options={selectorOptions}
              />
            ) : undefined
          }
        >
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={scoreTrend} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthShort}
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                  minTickGap={20}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  width={34}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
                  labelFormatter={(m) => monthLabel(m as string)}
                  formatter={(v: number) => [v == null ? '-' : v.toFixed(1), 'Avg DRP score']}
                />
                <Line type="monotone" dataKey="score" name="Avg DRP score" stroke="#0f766e" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1"><SourceTag dataset="DOMO - DRP Scorecards" /></div>
        </Panel>

        <Panel
          title="Root cause"
          subtitle={
            rootCause?.kind === 'store'
              ? 'Diagnostic metrics ranked by how far this shop is off its comparator.'
              : `Diagnostic metrics across the group vs the filtered portfolio - a shared pattern separates from a single-shop miss.`
          }
        >
          {rootCause?.kind === 'store' ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="num">Value</th>
                    <th className="num">Comparator</th>
                    <th>Basis</th>
                    <th className="num">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {rootCause.diag.map((d) => (
                    <tr key={d.metric} className={d.adverse && d.offBy > 5 ? 'bg-bad-soft/50' : ''}>
                      <td>{METRICS[d.metric].label}</td>
                      <td className="num">{formatMetric(d.metric, d.value)}</td>
                      <td className="num text-muted">{formatMetric(d.metric, d.comparator)}</td>
                      <td className="text-2xs text-muted">{d.comparatorLabel}</td>
                      <td className="num"><Variance pct={d.variancePct} good={!d.adverse} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : rootCause ? (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Metric</th>
                    <th className="num">Group avg</th>
                    <th className="num">Portfolio avg</th>
                    <th className="num">Variance</th>
                    <th className="num">Shops adverse</th>
                  </tr>
                </thead>
                <tbody>
                  {rootCause.rows
                    .slice()
                    .sort((a, b) => (b.adverse ? Math.abs(b.variancePct) : -1) - (a.adverse ? Math.abs(a.variancePct) : -1))
                    .map((m) => {
                      const systemic = m.adverse && m.groupN > 1 && m.adverseStores / m.groupN >= 0.5;
                      return (
                        <tr key={m.metric} className={m.adverse ? 'bg-bad-soft/40' : ''}>
                          <td>
                            {METRICS[m.metric].label}
                            {systemic && (
                              <span className="ml-1.5 chip bg-bad-soft text-bad-text ring-1 ring-inset ring-bad/30">Systemic</span>
                            )}
                          </td>
                          <td className="num">{formatMetric(m.metric, m.groupVal)}</td>
                          <td className="num text-muted">{formatMetric(m.metric, m.portVal)}</td>
                          <td className="num"><Variance pct={m.variancePct} good={!m.adverse} /></td>
                          <td className="num">
                            {m.adverseStores} / {m.groupN}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="px-1 py-6 text-center text-sm text-muted">Select a {noun} above to see its root cause.</p>
          )}
          <div className="mt-2"><SourceTag dataset="BDAP - Estimate Accuracy" /></div>
        </Panel>
      </div>

      {/* Shop problem vs market problem ------------------------------------- */}
      <Panel
        title="Shop problem or market problem"
        subtitle="Revenue vs plan against Boyd share of the shop's CBSA. Below plan in a growing market points to execution; below plan in a shrinking market points to the market."
        right={<SourceTag dataset="Market - PIF & Boyd Share" />}
      >
        <div style={{ width: '100%', height: 340 }}>
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 20, left: 8, bottom: 28 }}>
              <CartesianGrid stroke="#eef2f7" />
              <XAxis
                type="number"
                dataKey="x"
                name="Boyd share"
                unit="%"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                domain={['dataMin - 1', 'dataMax + 1']}
                label={{ value: 'Boyd share of CBSA (%) - latest', position: 'insideBottom', offset: -14, fontSize: 11, fill: '#64748b' }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="Revenue % of plan"
                unit="%"
                tick={{ fontSize: 10, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={44}
                domain={['dataMin - 3', 'dataMax + 3']}
                label={{ value: 'T3 revenue % of plan', angle: -90, position: 'insideLeft', offset: 12, fontSize: 11, fill: '#64748b' }}
              />
              <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="5 4" label={{ value: 'plan', position: 'right', fontSize: 10, fill: '#64748b' }} />
              <ReferenceLine x={scatter.medianShare} stroke="#cbd5e1" strokeDasharray="3 3" label={{ value: 'median share', position: 'top', fontSize: 10, fill: '#94a3b8' }} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={(props: any) => {
                  const payload = props?.payload as { payload: { name: string; x: number; y: number } }[] | undefined;
                  if (!payload || !payload.length) return null;
                  const p = payload[0].payload;
                  return (
                    <div className="rounded border border-line bg-surface px-2 py-1 text-xs shadow-sm">
                      <div className="font-medium text-ink">{p.name}</div>
                      <div className="text-muted">Revenue {p.y.toFixed(1)}% of plan · Boyd share {p.x.toFixed(1)}%</div>
                    </div>
                  );
                }}
              />
              <Scatter name="Shops" data={scatter.pts} isAnimationActive={false}>
                {scatter.pts.map((p) => {
                  const color =
                    p.y >= 100 ? '#0f766e' : p.x >= scatter.medianShare ? '#b45309' : '#b91c1c';
                  return <Cell key={p.id} fill={color} fillOpacity={0.75} />;
                })}
              </Scatter>
              <Legend
                verticalAlign="top"
                height={24}
                payload={[
                  { value: 'At or above plan', type: 'circle', color: '#0f766e', id: 'ok' },
                  { value: 'Below plan, growing market - execution', type: 'circle', color: '#b45309', id: 'exec' },
                  { value: 'Below plan, shrinking market - market', type: 'circle', color: '#b91c1c', id: 'mkt' },
                ]}
                wrapperStyle={{ fontSize: 11 }}
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-2xs text-muted">{scatter.pts.length} shops plotted. Points left of the median-share line in a shrinking market are more likely a market problem than an execution one.</p>
      </Panel>

      {/* PIF + Boyd share by CBSA ------------------------------------------- */}
      <Panel
        title="PIF count and Boyd share by CBSA"
        subtitle="Market size and Boyd's share of it, trended over the last 12 months. Shrinking markets first."
        right={<SourceTag dataset="Market - PIF & Boyd Share" />}
      >
        {marketRows.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">No CBSAs in view.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>CBSA</th>
                  <th className="num">PIF count</th>
                  <th>PIF trend</th>
                  <th className="num">Boyd share</th>
                  <th>Share trend</th>
                  <th className="num">12-mo change</th>
                </tr>
              </thead>
              <tbody>
                {marketRows.slice(0, 30).map((m) => (
                  <tr key={m.cbsaId}>
                    <td className="max-w-[18rem] truncate">{m.name}</td>
                    <td className="num">{int(m.pifNow)}</td>
                    <td><Sparkline values={m.pifSpark} tone="neutral" /></td>
                    <td className="num">{pct(m.shareNow)}</td>
                    <td><Sparkline values={m.shareSpark} tone={m.shareDelta < 0 ? 'bad' : 'good'} /></td>
                    <td className="num"><Variance pct={m.shareDelta} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {marketRows.length > 30 && <p className="mt-2 text-2xs text-muted">Showing 30 of {marketRows.length} CBSAs.</p>}
      </Panel>

      {/* DRP standing -------------------------------------------------------- */}
      <Panel
        title="DRP standing"
        subtitle="Score, rank within CBSA, tier, and tier movement over the last three months. Worst standing first."
        right={<SourceTag dataset="DOMO - DRP Scorecards" />}
      >
        <OpenQuestion>
          DRP scorecard competitor-granularity data may not be licensable - the rank-in-CBSA and competitor-count
          columns depend on a source not yet confirmed.
        </OpenQuestion>
        {standingRows.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-muted">No scorecards match the current filters.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shop</th>
                  <th>Carrier</th>
                  <th className="num">Score</th>
                  <th className="num">3-mo Δ</th>
                  <th className="num">Rank in CBSA</th>
                  <th>Tier</th>
                  <th>Tier change (3 mo)</th>
                </tr>
              </thead>
              <tbody>
                {standingRows.slice(0, 50).map((s) => (
                  <tr key={`${s.storeId}-${s.clientName}`}>
                    <td className="max-w-[15rem] truncate">
                      <Link to={`/store/${s.storeId}`} className="text-accent hover:underline">
                        {s.storeName}
                      </Link>
                    </td>
                    <td>{s.clientName}</td>
                    <td className="num">{s.score.toFixed(1)}</td>
                    <td className="num"><Variance pct={s.scoreDelta} /></td>
                    <td className="num">
                      {s.rankInCbsa} <span className="text-muted">of {s.competitorsInCbsa}</span>
                    </td>
                    <td><TierBadge tier={s.tier} /></td>
                    <td className="text-2xs">
                      {s.priorTier == null ? (
                        <span className="text-muted">-</span>
                      ) : s.tierMove > 0 ? (
                        <span className="text-good-text">▲ up from {s.priorTier}</span>
                      ) : s.tierMove < 0 ? (
                        <span className="text-bad-text">▼ down from {s.priorTier}</span>
                      ) : (
                        <span className="text-muted">· held</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {standingRows.length > 50 && <p className="mt-2 text-2xs text-muted">Showing worst 50 of {standingRows.length} scorecards in view.</p>}
      </Panel>
    </div>
  );
}
