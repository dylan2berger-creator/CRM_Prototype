// 5. /benchmarking - KPI improvement vs action plan activity.
// The screen that answers whether the plans are working. It charts a target
// metric over a scope of stores, marks every task meant to move it, and shows
// before/after around each task and an aggregate by task type. Everything here
// is CORRELATION, not proof: it shows what happened after a task, not that the
// task caused it - every section says so.

import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { TargetMetric, TaskType } from '@/types';
import { useData } from '@/data/DataContext';
import { METRICS, METRIC_ORDER, formatMetric, scopeMetricValue } from '@/data/metrics';
import { aggregateByTaskType, taskMarkersForScope } from '@/data/benchmark';
import { regionName, storeById } from '@/data/selectors';
import { PerformanceChart, ChartMarker } from '@/components/PerformanceChart';
import { Panel, Field, Select, Segmented, EmptyState, Stat } from '@/components/ui';
import { Variance } from '@/components/Variance';
import { SourceTag } from '@/components/Provenance';
import { dateLabel } from '@/utils/format';

type ScopeType = 'all' | 'region' | 'carrier' | 'store';

const TASK_ABBREV: Record<TaskType, string> = {
  'Central review rule change': 'Rule',
  Training: 'Train',
  'Metric monitoring': 'Monitor',
  'Carrier outreach': 'Outreach',
  Staffing: 'Staff',
  'Estimating process': 'Estimate',
  'Parts or supply': 'Parts',
  Other: 'Other',
};

function toneFor(improved: boolean | null): 'good' | 'bad' | 'neutral' {
  return improved === true ? 'good' : improved === false ? 'bad' : 'neutral';
}

// Normalized signed percentage change, for the variance cell (color is driven
// separately by whether the change was in the metric's good direction).
function deltaPct(before: number | null, after: number | null): number | null {
  if (before == null || after == null || before === 0) return null;
  return ((after - before) / Math.abs(before)) * 100;
}

export function Benchmarking() {
  const { data } = useData();
  const [params] = useSearchParams();

  const storesWithPlans = useMemo(() => {
    const seen = new Set<string>();
    const ids: string[] = [];
    for (const p of data.actionPlans) {
      if (!seen.has(p.storeId)) {
        seen.add(p.storeId);
        ids.push(p.storeId);
      }
    }
    return ids;
  }, [data]);

  // Carriers (clients) that at least one plan-store trades with - the carrier
  // scope options. Also the store-id list per carrier.
  const carrierStoreIds = useMemo(() => {
    const planSet = new Set(storesWithPlans);
    const map = new Map<string, Set<string>>();
    for (const m of data.metrics) {
      if (!planSet.has(m.storeId)) continue;
      let set = map.get(m.clientId);
      if (!set) map.set(m.clientId, (set = new Set()));
      set.add(m.storeId);
    }
    return map;
  }, [data, storesWithPlans]);

  const regionsWithPlans = useMemo(() => {
    const ids = new Set<string>();
    for (const sid of storesWithPlans) {
      const s = storeById(data, sid);
      if (s) ids.add(s.regionId);
    }
    return data.regions.filter((r) => ids.has(r.id));
  }, [data, storesWithPlans]);

  // Preselect from ?store & ?metric.
  const paramMetric = params.get('metric');
  const paramStore = params.get('store');
  const initialMetric: TargetMetric =
    paramMetric && (METRIC_ORDER as string[]).includes(paramMetric) ? (paramMetric as TargetMetric) : 'drpScore';

  const [metric, setMetric] = useState<TargetMetric>(initialMetric);
  const [scopeType, setScopeType] = useState<ScopeType>(paramStore ? 'store' : 'all');
  const [regionId, setRegionId] = useState<string>(regionsWithPlans[0]?.id ?? '');
  const [clientId, setClientId] = useState<string>([...carrierStoreIds.keys()][0] ?? '');
  const [storeId, setStoreId] = useState<string>(
    paramStore && storesWithPlans.includes(paramStore) ? paramStore : storesWithPlans[0] ?? '',
  );

  const meta = METRICS[metric];

  // The store-id list for the current scope.
  const storeIds = useMemo(() => {
    switch (scopeType) {
      case 'all':
        return storesWithPlans;
      case 'region':
        return storesWithPlans.filter((sid) => storeById(data, sid)?.regionId === regionId);
      case 'carrier':
        return [...(carrierStoreIds.get(clientId) ?? [])];
      case 'store':
        return storeId ? [storeId] : [];
    }
  }, [scopeType, storesWithPlans, data, regionId, carrierStoreIds, clientId, storeId]);

  const scopeLabel =
    scopeType === 'all'
      ? 'All stores with plans'
      : scopeType === 'region'
        ? `Region - ${regionName(data, regionId)}`
        : scopeType === 'carrier'
          ? `Carrier - ${data.clients.find((c) => c.id === clientId)?.name ?? clientId}`
          : `Store - ${storeById(data, storeId)?.name ?? storeId}`;

  const chartData = useMemo(
    () => data.months.map((month) => ({ month, value: scopeMetricValue(data, storeIds, metric, month), baseline: null })),
    [data, storeIds, metric],
  );

  const markers = useMemo(() => taskMarkersForScope(data, storeIds, metric), [data, storeIds, metric]);
  const chartMarkers: ChartMarker[] = markers.map((m) => ({
    month: m.startedOn.slice(0, 7),
    label: TASK_ABBREV[m.step.type],
    full: `${m.step.title} - ${m.step.type}, started ${dateLabel(m.startedOn)}`,
    kind: 'task',
    tone: toneFor(m.ba.improved),
  }));

  // Aggregate by task type - the VP view. Optionally scoped to the chosen metric.
  const [aggScope, setAggScope] = useState<'metric' | 'all'>('metric');
  const aggregate = useMemo(
    () => aggregateByTaskType(data, aggScope === 'metric' ? metric : undefined),
    [data, aggScope, metric],
  );
  const maxAbsDelta = Math.max(1, ...aggregate.map((a) => Math.abs(a.avgDeltaPct)));

  const improvedCount = markers.filter((m) => m.ba.improved === true).length;
  const worseCount = markers.filter((m) => m.ba.improved === false).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">KPI improvement vs action plan activity</h1>
        <p className="mt-0.5 text-sm text-muted">
          Track a target metric over time against the tasks meant to move it, and see which kinds of intervention tend to
          be followed by improvement.
        </p>
      </div>

      <Panel
        title="Metric and scope"
        subtitle={`${scopeLabel} · ${storeIds.length} ${storeIds.length === 1 ? 'store' : 'stores'}`}
        right={<SourceTag dataset={meta.source} />}
      >
        <div className="flex flex-wrap items-end gap-4">
          <Field label="Metric">
            <Select
              aria-label="Target metric"
              value={metric}
              onChange={(v) => setMetric(v as TargetMetric)}
              options={METRIC_ORDER.map((m) => ({ value: m, label: METRICS[m].label }))}
            />
          </Field>
          <Field label="Scope">
            <Segmented<ScopeType>
              value={scopeType}
              onChange={setScopeType}
              size="sm"
              options={[
                { value: 'all', label: 'All plans' },
                { value: 'region', label: 'By region' },
                { value: 'carrier', label: 'By carrier' },
                { value: 'store', label: 'Single store' },
              ]}
            />
          </Field>
          {scopeType === 'region' && (
            <Field label="Region">
              <Select
                aria-label="Region"
                value={regionId}
                onChange={setRegionId}
                options={regionsWithPlans.map((r) => ({ value: r.id, label: r.name }))}
              />
            </Field>
          )}
          {scopeType === 'carrier' && (
            <Field label="Carrier">
              <Select
                aria-label="Carrier"
                value={clientId}
                onChange={setClientId}
                options={[...carrierStoreIds.keys()].map((cid) => ({
                  value: cid,
                  label: data.clients.find((c) => c.id === cid)?.name ?? cid,
                }))}
              />
            </Field>
          )}
          {scopeType === 'store' && (
            <Field label="Store">
              <Select
                aria-label="Store"
                value={storeId}
                onChange={setStoreId}
                options={storesWithPlans.map((sid) => ({ value: sid, label: storeById(data, sid)?.name ?? sid }))}
              />
            </Field>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <Stat label="Tasks targeting this metric" value={markers.length} />
        <Stat label="Followed by improvement" value={improvedCount} tone={improvedCount ? 'good' : 'default'} />
        <Stat label="Followed by decline or flat" value={markers.length - improvedCount} tone={worseCount ? 'bad' : 'default'} />
        <Stat label="Stores in scope" value={storeIds.length} />
      </div>

      <Panel title={`${meta.label} over time`} subtitle="Line is the scope value each month; markers sit on each task's start month.">
        {storeIds.length === 0 ? (
          <EmptyState title="No stores in scope">Pick a different scope - this one has no stores with action plans.</EmptyState>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <PerformanceChart metric={metric} data={chartData} markers={chartMarkers} height={300} />
              </div>
            </div>
            <p className="mt-2 text-2xs text-muted">
              This shows what happened after the task, not that the task caused it. Blue markers were followed by movement in
              the metric&apos;s good direction; red markers were followed by decline or no change.
            </p>
          </>
        )}
      </Panel>

      <Panel
        title="Before and after each task"
        subtitle="Metric averaged over the 3 months before the task start vs the 3 months after."
      >
        <div className="mb-2 rounded border border-warn/40 bg-warn-soft px-2.5 py-1.5 text-2xs text-warn-text">
          This shows what happened after the task, not that the task caused it. Read it as correlation, not proof.
        </div>
        {markers.length === 0 ? (
          <EmptyState title="No tasks target this metric in scope">
            No started task in this scope lists {meta.label} among its target metrics.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Type</th>
                  <th>Store</th>
                  <th>Started</th>
                  <th className="text-right">Before</th>
                  <th className="text-right">After</th>
                  <th className="text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {markers.map((m, i) => {
                  const worsened = m.ba.improved === false;
                  const store = storeById(data, m.storeId);
                  return (
                    <tr key={`${m.step.id}-${i}`} className={worsened ? 'bg-bad-soft' : undefined}>
                      <td className="max-w-[280px]">
                        <span className="text-ink">{m.step.title}</span>
                      </td>
                      <td className="whitespace-nowrap text-muted">{m.step.type}</td>
                      <td className="whitespace-nowrap">
                        <Link to={`/store/${m.storeId}`} className="text-accent hover:underline">
                          {store?.name ?? m.storeId}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap tnum text-muted">{dateLabel(m.startedOn)}</td>
                      <td className="num">{m.ba.before == null ? '-' : formatMetric(metric, m.ba.before)}</td>
                      <td className="num">{m.ba.after == null ? '-' : formatMetric(metric, m.ba.after)}</td>
                      <td className="num">
                        <Variance pct={deltaPct(m.ba.before, m.ba.after)} good={m.ba.improved ?? undefined} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel
        title="Which kinds of intervention move the metric"
        subtitle="Across all stores with plans - task-metric pairs grouped by task type, sorted by average change."
        right={
          <Segmented<'metric' | 'all'>
            value={aggScope}
            onChange={setAggScope}
            size="sm"
            options={[
              { value: 'metric', label: meta.short },
              { value: 'all', label: 'All metrics' },
            ]}
          />
        }
      >
        <p className="mb-2 text-2xs text-muted">
          Average change is normalized to each metric&apos;s good direction: positive means the metric moved the right way
          after the task. This is correlation across many stores, not proof that a task type works.
        </p>
        {aggregate.length === 0 ? (
          <EmptyState title="No measured tasks">
            No started tasks with a measurable before/after window {aggScope === 'metric' ? `target ${meta.label}` : 'exist'}.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[760px]">
              <thead>
                <tr>
                  <th>Task type</th>
                  <th className="text-right">Measured</th>
                  <th className="text-right">Improved</th>
                  <th className="text-right">Worse</th>
                  <th className="text-right">Flat</th>
                  <th className="text-right">Avg change</th>
                  <th className="w-[200px]">Avg change vs peers</th>
                </tr>
              </thead>
              <tbody>
                {aggregate.map((a) => {
                  const w = (Math.abs(a.avgDeltaPct) / maxAbsDelta) * 50; // half-width percentage
                  const positive = a.avgDeltaPct >= 0;
                  return (
                    <tr key={a.type}>
                      <td className="whitespace-nowrap font-medium text-ink">{a.type}</td>
                      <td className="num">{a.count}</td>
                      <td className="num text-good-text">{a.improved}</td>
                      <td className="num text-bad-text">{a.worse}</td>
                      <td className="num text-muted">{a.flat}</td>
                      <td className="num">
                        <Variance pct={a.avgDeltaPct} />
                      </td>
                      <td>
                        {/* diverging bar centered at zero */}
                        <div className="relative h-3 w-full">
                          <div className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
                          <div
                            className={`absolute inset-y-0 ${positive ? 'bg-good' : 'bg-bad'}`}
                            style={{
                              left: positive ? '50%' : `${50 - w}%`,
                              width: `${w}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-2xs text-muted">
              Worse and flat outcomes are kept in view on purpose - the point is to see which intervention types are worth
              repeating and which are not.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
