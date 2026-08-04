// Pre-aggregated forecast vs actual at each level the VP needs to pivot on.
// Computed from MetricPeriod and CarrierVolume. The analysis screen's pivot
// control (carrier / region / shop / carrier-in-region) reads these.

import { DataSet, PerformanceRollup } from '@/types';
import { evaluateStore } from '@/logic/challengedRule';

export type PivotLevel = 'store' | 'carrier' | 'region' | 'carrier-in-region';

// Memoize the challenged set for the current month (used for challengedStoreCount).
const challengedCache = new WeakMap<DataSet, Set<string>>();
function challengedSet(data: DataSet): Set<string> {
  let s = challengedCache.get(data);
  if (s) return s;
  s = new Set(data.stores.filter((st) => evaluateStore(st.id, data.currentMonth, data).isChallenged).map((st) => st.id));
  challengedCache.set(data, s);
  return s;
}

interface Accum {
  keys: PerformanceRollup['keys'];
  revenueActual: number;
  revenueForecast: number;
  assignmentActual: number;
  assignmentForecast: number;
  scoreSum: number;
  scoreCount: number;
  challenged: Set<string>;
}

function keyOf(keys: PerformanceRollup['keys']): string {
  return `${keys.storeId ?? ''}|${keys.clientId ?? ''}|${keys.regionId ?? ''}`;
}

// Build rollups for a single month at the requested level.
export function rollupsForMonth(data: DataSet, level: PivotLevel, month: string): PerformanceRollup[] {
  const challenged = challengedSet(data);
  const storeRegion = new Map(data.stores.map((s) => [s.id, s.regionId]));
  const acc = new Map<string, Accum>();

  const bump = (keys: PerformanceRollup['keys'], storeId: string) => {
    const k = keyOf(keys);
    let a = acc.get(k);
    if (!a) {
      a = { keys, revenueActual: 0, revenueForecast: 0, assignmentActual: 0, assignmentForecast: 0, scoreSum: 0, scoreCount: 0, challenged: new Set() };
      acc.set(k, a);
    }
    if (challenged.has(storeId)) a.challenged.add(storeId);
    return a;
  };

  const keysFor = (storeId: string, clientId?: string): PerformanceRollup['keys'] => {
    const regionId = storeRegion.get(storeId);
    switch (level) {
      case 'store':
        return { storeId };
      case 'carrier':
        return { clientId };
      case 'region':
        return { regionId };
      case 'carrier-in-region':
        return { clientId, regionId };
    }
  };

  for (const m of data.metrics) {
    if (m.month !== month) continue;
    const a = bump(keysFor(m.storeId, m.clientId), m.storeId);
    a.revenueActual += m.revenueActual;
    a.revenueForecast += m.revenuePlan;
  }
  for (const v of data.carrierVolumes) {
    if (v.month !== month) continue;
    const a = bump(keysFor(v.storeId, v.clientId), v.storeId);
    a.assignmentActual += v.assignmentActual;
    a.assignmentForecast += v.assignmentForecast;
  }
  for (const s of data.scorecards) {
    if (s.month !== month) continue;
    const a = bump(keysFor(s.storeId, s.clientId), s.storeId);
    a.scoreSum += s.score;
    a.scoreCount++;
  }

  return [...acc.values()].map((a) => ({
    level,
    keys: a.keys,
    month,
    revenueActual: Math.round(a.revenueActual),
    revenueForecast: Math.round(a.revenueForecast),
    assignmentActual: a.assignmentActual,
    assignmentForecast: a.assignmentForecast,
    drpScoreAvg: a.scoreCount ? a.scoreSum / a.scoreCount : null,
    challengedStoreCount: a.challenged.size,
  }));
}

// Trend series across all months for one rollup key.
export function rollupTrend(
  data: DataSet,
  level: PivotLevel,
  match: (r: PerformanceRollup) => boolean,
): PerformanceRollup[] {
  return data.months.map((month) => {
    const rolls = rollupsForMonth(data, level, month).filter(match);
    // sum the matched rollups into one
    const acc: PerformanceRollup = {
      level,
      keys: rolls[0]?.keys ?? {},
      month,
      revenueActual: 0,
      revenueForecast: 0,
      assignmentActual: 0,
      assignmentForecast: 0,
      drpScoreAvg: null,
      challengedStoreCount: 0,
    };
    let scoreSum = 0;
    let scoreCount = 0;
    for (const r of rolls) {
      acc.revenueActual += r.revenueActual;
      acc.revenueForecast += r.revenueForecast;
      acc.assignmentActual += r.assignmentActual;
      acc.assignmentForecast += r.assignmentForecast;
      acc.challengedStoreCount += r.challengedStoreCount;
      if (r.drpScoreAvg != null) {
        scoreSum += r.drpScoreAvg;
        scoreCount++;
      }
    }
    acc.drpScoreAvg = scoreCount ? scoreSum / scoreCount : null;
    return acc;
  });
}

export function challengedStoreIds(data: DataSet): Set<string> {
  return challengedSet(data);
}
