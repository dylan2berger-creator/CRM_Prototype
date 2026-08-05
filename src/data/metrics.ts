// Metric registry - the single source of truth for every benchmarkable metric:
// its label, unit, direction, source dataset (for provenance), and how to read
// a store/scope value for a month. Charts, the diagnosis panel, the metric
// toggle, and the benchmarking screen all read from here so they stay in sync.

import { DataSet, MetricPeriod, TargetMetric } from '@/types';
import { mByStoreMonth, sByStoreMonth, vByStoreMonth } from '@/data/dataIndex';

export type Unit = 'money' | 'pct' | 'count' | 'days' | 'ratio' | 'score';

export interface MetricMeta {
  key: TargetMetric;
  label: string;
  short: string;
  unit: Unit;
  higherIsBetter: boolean;
  source: string; // dataset name for the provenance tag / freshness lookup
  carrierSpecific: boolean; // shown per carrier where it matters
  hasForecast: boolean; // has a plan/forecast baseline (vs peer-median compare)
  forecastLabel?: string; // "plan" | "forecast"
}

export const METRICS: Record<TargetMetric, MetricMeta> = {
  revenueActual: { key: 'revenueActual', label: 'Revenue', short: 'Revenue', unit: 'money', higherIsBetter: true, source: 'DOMO Exec Dashboard - Revenue', carrierSpecific: false, hasForecast: true, forecastLabel: 'plan' },
  roCount: { key: 'roCount', label: 'RO count', short: 'RO count', unit: 'count', higherIsBetter: true, source: 'CCCone - Repair Orders', carrierSpecific: false, hasForecast: true, forecastLabel: 'plan' },
  drpScore: { key: 'drpScore', label: 'DRP score', short: 'DRP score', unit: 'score', higherIsBetter: true, source: 'DOMO - DRP Scorecards', carrierSpecific: true, hasForecast: false },
  assignmentActual: { key: 'assignmentActual', label: 'DRP assignment volume', short: 'DRP volume', unit: 'count', higherIsBetter: true, source: 'BDAP - DRP Assignments', carrierSpecific: true, hasForecast: true, forecastLabel: 'forecast' },
  estimateAccuracyPct: { key: 'estimateAccuracyPct', label: 'Estimate accuracy', short: 'Est. accuracy', unit: 'pct', higherIsBetter: true, source: 'BDAP - Estimate Accuracy', carrierSpecific: false, hasForecast: false },
  internalRulesAdherencePct: { key: 'internalRulesAdherencePct', label: 'Internal rules adherence', short: 'Internal rules', unit: 'pct', higherIsBetter: true, source: 'DOMO - Rules Adherence', carrierSpecific: false, hasForecast: false },
  externalRulesAdherencePct: { key: 'externalRulesAdherencePct', label: 'External rules adherence', short: 'External rules', unit: 'pct', higherIsBetter: true, source: 'DOMO - Rules Adherence', carrierSpecific: true, hasForecast: false },
  centralReviewPassPct: { key: 'centralReviewPassPct', label: 'Central review pass rate', short: 'Central review', unit: 'pct', higherIsBetter: true, source: 'DOMO - Rules Adherence', carrierSpecific: false, hasForecast: false },
  qualityRecAcceptedPct: { key: 'qualityRecAcceptedPct', label: 'Quality recommendation accepted', short: 'Quality recs', unit: 'pct', higherIsBetter: true, source: 'DOMO - Rules Adherence', carrierSpecific: false, hasForecast: false },
  supplementsPerRo: { key: 'supplementsPerRo', label: 'Supplements per RO', short: 'Supp./RO', unit: 'ratio', higherIsBetter: false, source: 'CCCone - Repair Orders', carrierSpecific: false, hasForecast: false },
  rentalDays: { key: 'rentalDays', label: 'Rental days', short: 'Rental days', unit: 'days', higherIsBetter: false, source: 'CCCone - Repair Orders', carrierSpecific: false, hasForecast: false },
  totalCostOfRepair: { key: 'totalCostOfRepair', label: 'Total cost of repair', short: 'Cost/repair', unit: 'money', higherIsBetter: false, source: 'CCCone - Repair Orders', carrierSpecific: false, hasForecast: false },
  captureRatePct: { key: 'captureRatePct', label: 'Capture rate', short: 'Capture rate', unit: 'pct', higherIsBetter: true, source: 'CCCone - Repair Orders', carrierSpecific: false, hasForecast: false },
};

// Order for the performance-chart metric toggle and the benchmarking picker.
export const METRIC_ORDER: TargetMetric[] = [
  'revenueActual',
  'roCount',
  'drpScore',
  'assignmentActual',
  'estimateAccuracyPct',
  'internalRulesAdherencePct',
  'externalRulesAdherencePct',
  'centralReviewPassPct',
  'qualityRecAcceptedPct',
  'supplementsPerRo',
  'rentalDays',
  'totalCostOfRepair',
  'captureRatePct',
];

// The diagnostic-panel metric set (spec: the "why is this shop missing" set).
export const DIAGNOSTIC_METRICS: TargetMetric[] = [
  'revenueActual',
  'roCount',
  'assignmentActual',
  'estimateAccuracyPct',
  'internalRulesAdherencePct',
  'externalRulesAdherencePct',
  'centralReviewPassPct',
  'qualityRecAcceptedPct',
  'supplementsPerRo',
  'rentalDays',
  'totalCostOfRepair',
];

export interface SeriesPoint {
  month: string;
  value: number;
  baseline: number | null; // plan/forecast where the metric has one
}

const weightedAvg = (rows: MetricPeriod[], val: (r: MetricPeriod) => number, w: (r: MetricPeriod) => number): number => {
  let ws = 0;
  let sw = 0;
  for (const r of rows) {
    ws += val(r) * w(r);
    sw += w(r);
  }
  return sw > 0 ? ws / sw : 0;
};
const rev = (r: MetricPeriod) => r.revenueActual;
const ro = (r: MetricPeriod) => r.roCount;

// Store-level value for a metric in one month (aggregating across clients).
export function storeMetricValue(data: DataSet, storeId: string, metric: TargetMetric, month: string): number {
  const rows = mByStoreMonth(data, storeId, month);
  switch (metric) {
    case 'revenueActual':
      return rows.reduce((s, r) => s + r.revenueActual, 0);
    case 'roCount':
      return rows.reduce((s, r) => s + r.roCount, 0);
    case 'assignmentActual':
      return vByStoreMonth(data, storeId, month).reduce((s, v) => s + v.assignmentActual, 0);
    case 'drpScore': {
      const scs = sByStoreMonth(data, storeId, month);
      return scs.length ? scs.reduce((s, x) => s + x.score, 0) / scs.length : 0;
    }
    case 'supplementsPerRo':
      return weightedAvg(rows, (r) => r.supplementsPerRo, ro);
    case 'rentalDays':
      return weightedAvg(rows, (r) => r.rentalDays, ro);
    case 'totalCostOfRepair':
      return weightedAvg(rows, (r) => r.totalCostOfRepair, ro);
    default:
      // percentage metrics, revenue-weighted
      return weightedAvg(rows, (r) => r[metric] as number, rev);
  }
}

// Store-level baseline (plan/forecast) for a metric in one month, or null.
export function storeMetricBaseline(data: DataSet, storeId: string, metric: TargetMetric, month: string): number | null {
  if (metric === 'revenueActual') return mByStoreMonth(data, storeId, month).reduce((s, r) => s + r.revenuePlan, 0);
  if (metric === 'roCount') {
    const bc = data.businessCases.find((b) => b.storeId === storeId);
    return bc && bc.annualRoPlan > 0 ? bc.annualRoPlan / 12 : null;
  }
  if (metric === 'assignmentActual') {
    return vByStoreMonth(data, storeId, month).reduce((s, v) => s + v.assignmentForecast, 0);
  }
  return null;
}

// Full monthly series for a store metric across all history months.
export function storeMetricSeries(data: DataSet, storeId: string, metric: TargetMetric): SeriesPoint[] {
  return data.months.map((month) => ({
    month,
    value: storeMetricValue(data, storeId, metric, month),
    baseline: storeMetricBaseline(data, storeId, metric, month),
  }));
}

// Aggregate a metric across a set of stores for one month (for benchmarking scope).
export function scopeMetricValue(data: DataSet, storeIds: string[], metric: TargetMetric, month: string): number {
  const set = new Set(storeIds);
  if (metric === 'revenueActual')
    return data.metrics.filter((m) => set.has(m.storeId) && m.month === month).reduce((s, r) => s + r.revenueActual, 0);
  if (metric === 'roCount')
    return data.metrics.filter((m) => set.has(m.storeId) && m.month === month).reduce((s, r) => s + r.roCount, 0);
  if (metric === 'assignmentActual')
    return data.carrierVolumes.filter((v) => set.has(v.storeId) && v.month === month).reduce((s, v) => s + v.assignmentActual, 0);
  if (metric === 'drpScore') {
    const scs = data.scorecards.filter((s) => set.has(s.storeId) && s.month === month);
    return scs.length ? scs.reduce((s, x) => s + x.score, 0) / scs.length : 0;
  }
  const rows = data.metrics.filter((m) => set.has(m.storeId) && m.month === month);
  if (metric === 'supplementsPerRo') return weightedAvg(rows, (r) => r.supplementsPerRo, ro);
  if (metric === 'rentalDays') return weightedAvg(rows, (r) => r.rentalDays, ro);
  if (metric === 'totalCostOfRepair') return weightedAvg(rows, (r) => r.totalCostOfRepair, ro);
  return weightedAvg(rows, (r) => r[metric] as number, rev);
}

export function scopeMetricSeries(data: DataSet, storeIds: string[], metric: TargetMetric): number[] {
  return data.months.map((month) => scopeMetricValue(data, storeIds, metric, month));
}

// Value formatting for a metric (used by axes, tables, tooltips).
export function formatMetric(metric: TargetMetric, value: number): string {
  const meta = METRICS[metric];
  switch (meta.unit) {
    case 'money':
      return value >= 100_000 ? `$${(value / 1000).toFixed(0)}K` : `$${Math.round(value).toLocaleString('en-US')}`;
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return value.toFixed(2);
    case 'days':
      return `${value.toFixed(1)}d`;
    case 'score':
      return value.toFixed(1);
    case 'count':
      return Math.round(value).toLocaleString('en-US');
  }
}
