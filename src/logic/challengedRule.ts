// The challenged-store rule - a single pure function with a version string.
//
// PROTOTYPE THRESHOLDS. These are placeholders pending sign-off from Finance
// and Client Performance Management; the UI labels them as such. If they
// change, they change here and nowhere else.

import {
  CarrierVolume,
  DataSet,
  DrpScorecard,
  FlagEvaluation,
  FlagReason,
  MetricPeriod,
} from '@/types';
import { addMonths, trailing } from '@/utils/dates';

export const RULE_VERSION = 'v2.1';

export const THRESHOLDS = {
  t3RevenuePctOfPlan: 90, // T3 revenue below 90% of plan
  t12RevenuePctOfPlan: 95, // T12 revenue below 95% of plan
  drpVolumePctOfForecast: 90, // DRP volume below 90% of forecast...
  materialClientSharePct: 20, // ...on any client > 20% of store revenue
  captureRatePct: 60, // capture rate below 60%...
  captureRateConsecutiveMonths: 2, // ...for two consecutive months
  watchTiers: ['Watch', 'At risk'] as const,
};

// Per-store indexes, memoized per DataSet instance so the rule stays cheap when
// called across every store and month at load.
interface StoreIndex {
  metricsByStore: Map<string, MetricPeriod[]>;
  volByStore: Map<string, CarrierVolume[]>;
  scByStore: Map<string, DrpScorecard[]>;
}
const indexCache = new WeakMap<DataSet, StoreIndex>();

function getIndex(data: DataSet): StoreIndex {
  let idx = indexCache.get(data);
  if (idx) return idx;
  const metricsByStore = new Map<string, MetricPeriod[]>();
  const volByStore = new Map<string, CarrierVolume[]>();
  const scByStore = new Map<string, DrpScorecard[]>();
  for (const m of data.metrics) push(metricsByStore, m.storeId, m);
  for (const v of data.carrierVolumes) push(volByStore, v.storeId, v);
  for (const s of data.scorecards) push(scByStore, s.storeId, s);
  idx = { metricsByStore, volByStore, scByStore };
  indexCache.set(data, idx);
  return idx;
}
function push<T>(map: Map<string, T[]>, key: string, val: T) {
  const arr = map.get(key);
  if (arr) arr.push(val);
  else map.set(key, [val]);
}

// Store-level revenue actual/plan for a given month (sum across clients).
function storeRevenue(rows: MetricPeriod[], month: string): { actual: number; plan: number } {
  let actual = 0;
  let plan = 0;
  for (const r of rows) {
    if (r.month === month) {
      actual += r.revenueActual;
      plan += r.revenuePlan;
    }
  }
  return { actual, plan };
}

// Trailing-window revenue ratio (actual / plan) as a percentage.
function trailingRevenuePct(rows: MetricPeriod[], months: string[], end: string, n: number): number | null {
  const window = trailing(months, end, n);
  let actual = 0;
  let plan = 0;
  for (const month of window) {
    const r = storeRevenue(rows, month);
    actual += r.actual;
    plan += r.plan;
  }
  if (plan <= 0) return null;
  return (actual / plan) * 100;
}

// Client shares of store revenue over trailing 12 months.
function clientShares(rows: MetricPeriod[], months: string[], end: string): Map<string, number> {
  const window = new Set(trailing(months, end, 12));
  const byClient = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if (window.has(r.month)) {
      byClient.set(r.clientId, (byClient.get(r.clientId) ?? 0) + r.revenueActual);
      total += r.revenueActual;
    }
  }
  const shares = new Map<string, number>();
  if (total > 0) for (const [c, v] of byClient) shares.set(c, (v / total) * 100);
  return shares;
}

// Store-level capture rate for a month: revenue-weighted mean across clients.
function storeCaptureRate(rows: MetricPeriod[], month: string): number | null {
  let wsum = 0;
  let w = 0;
  for (const r of rows) {
    if (r.month === month) {
      wsum += r.captureRatePct * r.revenueActual;
      w += r.revenueActual;
    }
  }
  return w > 0 ? wsum / w : null;
}

/**
 * Evaluate whether a store is challenged for a given month. Pure over `data`.
 * Records every reason it fired down to the metric, value, and threshold, so
 * the UI can always answer "why is this store flagged".
 */
export function evaluateStore(storeId: string, month: string, data: DataSet): FlagEvaluation {
  const idx = getIndex(data);
  const rows = idx.metricsByStore.get(storeId) ?? [];
  const months = data.months;
  const reasons: FlagReason[] = [];

  // 1. T3 revenue vs plan
  const t3 = trailingRevenuePct(rows, months, month, 3);
  if (t3 !== null && t3 < THRESHOLDS.t3RevenuePctOfPlan) {
    reasons.push({
      metric: 'revenueVsPlan',
      label: `T3 revenue ${(100 - t3).toFixed(1)}% below plan`,
      actual: round1(t3),
      threshold: THRESHOLDS.t3RevenuePctOfPlan,
    });
  }

  // 2. T12 revenue vs plan
  const t12 = trailingRevenuePct(rows, months, month, 12);
  if (t12 !== null && t12 < THRESHOLDS.t12RevenuePctOfPlan) {
    reasons.push({
      metric: 'revenueVsPlan',
      label: `T12 revenue ${(100 - t12).toFixed(1)}% below plan`,
      actual: round1(t12),
      threshold: THRESHOLDS.t12RevenuePctOfPlan,
    });
  }

  const shares = clientShares(rows, months, month);
  const materialClients = new Set(
    [...shares.entries()].filter(([, s]) => s > THRESHOLDS.materialClientSharePct).map(([c]) => c),
  );

  // 3. DRP assignment volume vs forecast on a material client
  const vols = idx.volByStore.get(storeId) ?? [];
  for (const clientId of materialClients) {
    const cv = vols.find((v) => v.clientId === clientId && v.month === month);
    if (cv && cv.assignmentForecast > 0) {
      const pctOfForecast = (cv.assignmentActual / cv.assignmentForecast) * 100;
      if (pctOfForecast < THRESHOLDS.drpVolumePctOfForecast) {
        reasons.push({
          metric: 'drpVolumeVsForecast',
          label: `DRP volume ${(100 - pctOfForecast).toFixed(1)}% below forecast on a carrier over 20% of revenue`,
          actual: round1(pctOfForecast),
          threshold: THRESHOLDS.drpVolumePctOfForecast,
        });
        break;
      }
    }
  }

  // 4. DRP tier Watch / At risk on a material client
  const scs = idx.scByStore.get(storeId) ?? [];
  for (const clientId of materialClients) {
    const sc = scs.find((s) => s.clientId === clientId && s.month === month);
    if (sc && (THRESHOLDS.watchTiers as readonly string[]).includes(sc.tier)) {
      reasons.push({
        metric: 'drpTier',
        label: `DRP tier "${sc.tier}" on a carrier over 20% of revenue`,
        actual: sc.score,
        threshold: 72, // Standard floor
      });
      break;
    }
  }

  // 5. Capture rate below 60% for two consecutive months
  const prevMonth = addMonths(month, -1);
  const capNow = storeCaptureRate(rows, month);
  const capPrev = storeCaptureRate(rows, prevMonth);
  if (
    capNow !== null &&
    capPrev !== null &&
    capNow < THRESHOLDS.captureRatePct &&
    capPrev < THRESHOLDS.captureRatePct
  ) {
    reasons.push({
      metric: 'captureRate',
      label: `Capture rate below 60% for two consecutive months (${capNow.toFixed(1)}%, ${capPrev.toFixed(1)}%)`,
      actual: round1(capNow),
      threshold: THRESHOLDS.captureRatePct,
    });
  }

  const isChallenged = reasons.length > 0;
  return {
    storeId,
    month,
    isChallenged,
    ruleVersion: RULE_VERSION,
    reasons,
    firstFlaggedMonth: isChallenged ? firstFlaggedMonth(storeId, month, data) : null,
  };
}

// Walk backwards from `month` while the store stays challenged; the start of
// that unbroken run is the first-flagged month.
function firstFlaggedMonth(storeId: string, month: string, data: DataSet): string {
  const months = data.months;
  let i = months.indexOf(month);
  let first = month;
  while (i - 1 >= 0) {
    const prev = months[i - 1];
    if (isChallengedQuiet(storeId, prev, data)) {
      first = prev;
      i--;
    } else break;
  }
  return first;
}

// Cheap challenged check without recomputing firstFlaggedMonth (avoids recursion).
function isChallengedQuiet(storeId: string, month: string, data: DataSet): boolean {
  const idx = getIndex(data);
  const rows = idx.metricsByStore.get(storeId) ?? [];
  const months = data.months;

  const t3 = trailingRevenuePct(rows, months, month, 3);
  if (t3 !== null && t3 < THRESHOLDS.t3RevenuePctOfPlan) return true;
  const t12 = trailingRevenuePct(rows, months, month, 12);
  if (t12 !== null && t12 < THRESHOLDS.t12RevenuePctOfPlan) return true;

  const shares = clientShares(rows, months, month);
  const material = [...shares.entries()].filter(([, s]) => s > THRESHOLDS.materialClientSharePct).map(([c]) => c);

  const vols = idx.volByStore.get(storeId) ?? [];
  for (const clientId of material) {
    const cv = vols.find((v) => v.clientId === clientId && v.month === month);
    if (cv && cv.assignmentForecast > 0 && (cv.assignmentActual / cv.assignmentForecast) * 100 < THRESHOLDS.drpVolumePctOfForecast) return true;
  }
  const scs = idx.scByStore.get(storeId) ?? [];
  for (const clientId of material) {
    const sc = scs.find((s) => s.clientId === clientId && s.month === month);
    if (sc && (THRESHOLDS.watchTiers as readonly string[]).includes(sc.tier)) return true;
  }
  const capNow = storeCaptureRate(rows, month);
  const capPrev = storeCaptureRate(rows, addMonths(month, -1));
  if (capNow !== null && capPrev !== null && capNow < THRESHOLDS.captureRatePct && capPrev < THRESHOLDS.captureRatePct) return true;

  return false;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
