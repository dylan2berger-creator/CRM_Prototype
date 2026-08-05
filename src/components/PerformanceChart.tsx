// The performance chart - the one element worth designing carefully, because
// "which intervention moved this" is the question the whole app exists to
// answer. Actual vs baseline over time, with a MARKER RAIL below the plot (not
// full-height picket-fence lines) carrying the plan-start date and each task's
// startedOn, labeled by task type. Only markers relevant to the displayed
// metric are passed in by the caller.

import {
  CartesianGrid,
  Customized,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TargetMetric } from '@/types';
import { formatMetric, METRICS } from '@/data/metrics';
import { monthShort, monthLabel } from '@/utils/format';

export interface ChartMarker {
  month: string;
  label: string; // short label, e.g. task type
  full: string; // full text for the title/tooltip
  kind: 'plan' | 'task';
  tone?: 'good' | 'bad' | 'warn' | 'neutral';
}

export interface PerfPoint {
  month: string;
  value: number;
  baseline: number | null;
}

const TONE_COLOR: Record<string, string> = {
  good: '#1d4ed8',
  bad: '#b91c1c',
  warn: '#b45309',
  neutral: '#0f766e',
};

export function PerformanceChart({
  metric,
  data,
  markers,
  height = 260,
  baselineLabel,
}: {
  metric: TargetMetric;
  data: PerfPoint[];
  markers: ChartMarker[];
  height?: number;
  baselineLabel?: string;
}) {
  const meta = METRICS[metric];
  const hasBaseline = data.some((d) => d.baseline != null);
  const blLabel = baselineLabel ?? (meta.forecastLabel === 'forecast' ? 'Forecast' : 'Plan');

  // The custom marker layer reads the chart's x-scale + plot offset so markers
  // land exactly under their month, in a rail inside the bottom margin.
  const MarkerLayer = (props: any) => {
    const xMap = props.xAxisMap && Object.values(props.xAxisMap)[0];
    const offset = props.offset;
    if (!xMap || !offset) return null;
    const scale = xMap.scale;
    const band = scale.bandwidth ? scale.bandwidth() : 0;
    const xOf = (month: string) => {
      const x = scale(month);
      return x == null ? null : x + band / 2;
    };
    const plotBottom = offset.top + offset.height;
    const railY = plotBottom + 8;
    // stagger labels across up to 3 rows to avoid overlap
    let row = 0;
    return (
      <g>
        {markers.map((m, i) => {
          const x = xOf(m.month);
          if (x == null) return null;
          const color = m.kind === 'plan' ? '#334155' : TONE_COLOR[m.tone ?? 'neutral'];
          const isPlan = m.kind === 'plan';
          row = (row + 1) % 3;
          const labelY = railY + 6 + row * 11;
          return (
            <g key={i}>
              <title>{m.full}</title>
              {/* subtle reference line only in the lower third of the plot */}
              <line
                x1={x}
                x2={x}
                y1={isPlan ? offset.top : plotBottom - offset.height * 0.28}
                y2={plotBottom}
                stroke={color}
                strokeWidth={isPlan ? 1.25 : 1}
                strokeDasharray={isPlan ? '4 3' : '2 2'}
                opacity={isPlan ? 0.5 : 0.45}
              />
              {/* rail marker */}
              {isPlan ? (
                <polygon points={`${x - 4},${railY} ${x + 4},${railY} ${x},${railY - 6}`} fill={color} />
              ) : (
                <circle cx={x} cy={railY} r={3.5} fill={color} />
              )}
              <text x={x} y={labelY} textAnchor="middle" fontSize={9} fill={color} className="tnum">
                {m.label}
              </text>
            </g>
          );
        })}
      </g>
    );
  };

  const bottomMargin = markers.length ? 52 : 16;

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: bottomMargin }}>
          <CartesianGrid stroke="#eef2f7" vertical={false} />
          <XAxis
            dataKey="month"
            tickFormatter={monthShort}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={{ stroke: '#cbd5e1' }}
            minTickGap={16}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatMetric(metric, v)}
            tick={{ fontSize: 10, fill: '#64748b' }}
            tickLine={false}
            axisLine={false}
            width={54}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 6, border: '1px solid #e2e8f0' }}
            labelFormatter={(m) => monthLabel(m as string)}
            formatter={(v: number, name) => [formatMetric(metric, v), name]}
          />
          <Line
            type="monotone"
            dataKey="value"
            name={meta.label}
            stroke="#0f766e"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          {hasBaseline && (
            <Line
              type="monotone"
              dataKey="baseline"
              name={blLabel}
              stroke="#94a3b8"
              strokeWidth={1.5}
              strokeDasharray="5 4"
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          )}
          <Customized component={MarkerLayer} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
