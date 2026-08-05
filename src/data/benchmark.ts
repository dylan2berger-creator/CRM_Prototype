// Benchmarking: does a task move what it was meant to move? We compare the
// target metric in the 3 months before a task's startedOn to the 3 months
// after. This is CORRELATION, not proof - the app shows what happened after the
// task, not that the task caused it. Every consumer must label it that way.

import { ActionStep, DataSet, TargetMetric } from '@/types';
import { METRICS, scopeMetricValue, storeMetricValue } from '@/data/metrics';
import { addMonths } from '@/utils/dates';

export interface BeforeAfter {
  before: number | null;
  after: number | null;
  delta: number | null; // after - before
  improved: boolean | null; // in the metric's good direction
}

function windowAvg(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

// Before/after for a single store metric around a benchmark month.
export function beforeAfterStore(data: DataSet, storeId: string, metric: TargetMetric, startedOn: string): BeforeAfter {
  const startMonth = startedOn.slice(0, 7);
  const before = windowAvg([3, 2, 1].map((k) => valueOrNull(data, storeId, metric, addMonths(startMonth, -k))));
  const after = windowAvg([1, 2, 3].map((k) => valueOrNull(data, storeId, metric, addMonths(startMonth, k))));
  return finish(metric, before, after);
}

// Before/after across a set of stores (scope).
export function beforeAfterScope(data: DataSet, storeIds: string[], metric: TargetMetric, startMonth: string): BeforeAfter {
  const before = windowAvg([3, 2, 1].map((k) => scopeValueOrNull(data, storeIds, metric, addMonths(startMonth, -k))));
  const after = windowAvg([1, 2, 3].map((k) => scopeValueOrNull(data, storeIds, metric, addMonths(startMonth, k))));
  return finish(metric, before, after);
}

function finish(metric: TargetMetric, before: number | null, after: number | null): BeforeAfter {
  if (before == null || after == null) return { before, after, delta: null, improved: null };
  const delta = after - before;
  const improved = METRICS[metric].higherIsBetter ? delta > 0 : delta < 0;
  return { before, after, delta, improved };
}

function valueOrNull(data: DataSet, storeId: string, metric: TargetMetric, month: string): number | null {
  if (!data.months.includes(month)) return null;
  const v = storeMetricValue(data, storeId, metric, month);
  return Number.isFinite(v) ? v : null;
}
function scopeValueOrNull(data: DataSet, storeIds: string[], metric: TargetMetric, month: string): number | null {
  if (!data.months.includes(month)) return null;
  const v = scopeMetricValue(data, storeIds, metric, month);
  return Number.isFinite(v) ? v : null;
}

// A task marker for the performance / benchmarking chart: only tasks whose
// targetMetrics include the displayed metric appear.
export interface TaskMarker {
  step: ActionStep;
  storeId: string;
  startedOn: string;
  ba: BeforeAfter;
}
export function taskMarkersForStore(data: DataSet, storeId: string, metric: TargetMetric): TaskMarker[] {
  const plan = data.actionPlans.find((p) => p.storeId === storeId);
  if (!plan) return [];
  return plan.steps
    .filter((s) => s.startedOn && s.targetMetrics.includes(metric))
    .map((s) => ({ step: s, storeId, startedOn: s.startedOn!, ba: beforeAfterStore(data, storeId, metric, s.startedOn!) }))
    .sort((a, b) => (a.startedOn < b.startedOn ? -1 : 1));
}

// All task markers for a metric across a set of stores (benchmarking scope).
export function taskMarkersForScope(data: DataSet, storeIds: string[], metric: TargetMetric): TaskMarker[] {
  const set = new Set(storeIds);
  const markers: TaskMarker[] = [];
  for (const plan of data.actionPlans) {
    if (!set.has(plan.storeId)) continue;
    for (const s of plan.steps) {
      if (s.startedOn && s.targetMetrics.includes(metric)) {
        markers.push({ step: s, storeId: plan.storeId, startedOn: s.startedOn, ba: beforeAfterStore(data, plan.storeId, metric, s.startedOn) });
      }
    }
  }
  return markers.sort((a, b) => (a.startedOn < b.startedOn ? -1 : 1));
}

// Aggregate outcome by task type: across all stores, what happened to each
// task's target metrics after startedOn. This is the view that tells the VP
// which kinds of intervention are worth repeating.
export interface TaskTypeAggregate {
  type: string;
  count: number; // task-metric pairs measured
  improved: number;
  worse: number;
  flat: number;
  avgDeltaPct: number; // average normalized delta, positive = moved the good way
}
export function aggregateByTaskType(data: DataSet, metricFilter?: TargetMetric): TaskTypeAggregate[] {
  const byType = new Map<string, { improved: number; worse: number; flat: number; deltas: number[]; count: number }>();
  for (const plan of data.actionPlans) {
    for (const step of plan.steps) {
      if (!step.startedOn) continue;
      for (const metric of step.targetMetrics) {
        if (metricFilter && metric !== metricFilter) continue;
        const ba = beforeAfterStore(data, plan.storeId, metric, step.startedOn);
        if (ba.before == null || ba.after == null || ba.before === 0) continue;
        const normDelta = ((ba.after - ba.before) / Math.abs(ba.before)) * 100 * (METRICS[metric].higherIsBetter ? 1 : -1);
        const bucket = byType.get(step.type) ?? { improved: 0, worse: 0, flat: 0, deltas: [], count: 0 };
        bucket.count++;
        bucket.deltas.push(normDelta);
        if (Math.abs(normDelta) < 1) bucket.flat++;
        else if (normDelta > 0) bucket.improved++;
        else bucket.worse++;
        byType.set(step.type, bucket);
      }
    }
  }
  return [...byType.entries()]
    .map(([type, b]) => ({
      type,
      count: b.count,
      improved: b.improved,
      worse: b.worse,
      flat: b.flat,
      avgDeltaPct: b.deltas.length ? b.deltas.reduce((a, c) => a + c, 0) / b.deltas.length : 0,
    }))
    .sort((a, b) => b.avgDeltaPct - a.avgDeltaPct);
}
