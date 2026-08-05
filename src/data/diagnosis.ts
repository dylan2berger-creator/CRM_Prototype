// Diagnosis: rank a store's diagnostic metrics by how far off they are, so the
// panel answers "what is causing this" well enough to write a relevant plan.
// Internal and external rules adherence stay separate - they point at different
// fixes. Carrier-specific metrics are also available broken down per carrier.

import { DataSet, TargetMetric } from '@/types';
import { DIAGNOSTIC_METRICS, METRICS, storeMetricBaseline, storeMetricValue } from '@/data/metrics';
import { storeClientMix } from '@/data/selectors';

// Peer median for each diagnostic metric at the current month, memoized per data.
const medianCache = new WeakMap<DataSet, Map<string, number>>();
function peerMedians(data: DataSet): Map<string, number> {
  let cached = medianCache.get(data);
  if (cached) return cached;
  cached = new Map();
  const cur = data.currentMonth;
  for (const metric of DIAGNOSTIC_METRICS) {
    const vals = data.stores
      .map((s) => storeMetricValue(data, s.id, metric, cur))
      .filter((v) => Number.isFinite(v) && v !== 0)
      .sort((a, b) => a - b);
    cached.set(metric, vals.length ? vals[Math.floor(vals.length / 2)] : 0);
  }
  medianCache.set(data, cached);
  return cached;
}

export interface DiagnosisRow {
  metric: TargetMetric;
  value: number;
  comparator: number;
  comparatorLabel: 'plan' | 'forecast' | 'peer median';
  variancePct: number; // signed vs comparator (raw direction)
  adverse: boolean; // true if worse than comparator in the metric's good direction
  offBy: number; // magnitude of adverse gap in normalized %, used to rank
  higherIsBetter: boolean;
}

export function diagnose(data: DataSet, storeId: string): DiagnosisRow[] {
  const cur = data.currentMonth;
  const medians = peerMedians(data);
  const rows: DiagnosisRow[] = DIAGNOSTIC_METRICS.map((metric) => {
    const meta = METRICS[metric];
    const value = storeMetricValue(data, storeId, metric, cur);
    let comparator: number;
    let comparatorLabel: DiagnosisRow['comparatorLabel'];
    const baseline = meta.hasForecast ? storeMetricBaseline(data, storeId, metric, cur) : null;
    if (baseline != null && baseline > 0) {
      comparator = baseline;
      comparatorLabel = meta.forecastLabel === 'forecast' ? 'forecast' : 'plan';
    } else {
      comparator = medians.get(metric) ?? value;
      comparatorLabel = 'peer median';
    }
    const variancePct = comparator !== 0 ? ((value - comparator) / comparator) * 100 : 0;
    // adverse if the sign of variance runs against the good direction
    const adverse = meta.higherIsBetter ? variancePct < 0 : variancePct > 0;
    const offBy = adverse ? Math.abs(variancePct) : 0;
    return { metric, value, comparator, comparatorLabel, variancePct, adverse, offBy, higherIsBetter: meta.higherIsBetter };
  });
  return rows.sort((a, b) => b.offBy - a.offBy);
}

// The single worst diagnostic metric - used to suggest a task's target metric.
export function worstDiagnostic(data: DataSet, storeId: string): TargetMetric | null {
  const rows = diagnose(data, storeId).filter((r) => r.adverse);
  return rows.length ? rows[0].metric : null;
}

// Per-carrier breakdown of a carrier-specific metric at the current month.
export interface CarrierMetricRow {
  clientId: string;
  clientName: string;
  value: number;
  sharePct: number;
}
export function carrierBreakdown(data: DataSet, storeId: string, metric: TargetMetric): CarrierMetricRow[] {
  const cur = data.currentMonth;
  const mix = storeClientMix(data, storeId);
  const rows: CarrierMetricRow[] = [];
  for (const entry of mix) {
    const cid = entry.client.id;
    let value = 0;
    if (metric === 'externalRulesAdherencePct') {
      const m = data.metrics.find((x) => x.storeId === storeId && x.clientId === cid && x.month === cur);
      if (!m) continue;
      value = m.externalRulesAdherencePct;
    } else if (metric === 'drpScore') {
      const sc = data.scorecards.find((x) => x.storeId === storeId && x.clientId === cid && x.month === cur);
      if (!sc) continue;
      value = sc.score;
    } else if (metric === 'assignmentActual') {
      const v = data.carrierVolumes.find((x) => x.storeId === storeId && x.clientId === cid && x.month === cur);
      if (!v) continue;
      value = v.assignmentActual;
    } else {
      const m = data.metrics.find((x) => x.storeId === storeId && x.clientId === cid && x.month === cur);
      if (!m) continue;
      value = m[metric] as number;
    }
    rows.push({ clientId: cid, clientName: entry.client.name, value, sharePct: entry.sharePct });
  }
  return rows;
}
