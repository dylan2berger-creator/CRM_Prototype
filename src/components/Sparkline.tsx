// Tiny inline-SVG sparkline for table cells. No axis, no animation.

export function Sparkline({
  values,
  width = 90,
  height = 22,
  tone = 'neutral',
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: 'neutral' | 'good' | 'bad' | 'warn';
}) {
  if (!values.length) return <span className="text-2xs text-muted">-</span>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / Math.max(1, values.length - 1);
  const pts = values.map((v, i) => `${(i * stepX).toFixed(1)},${(height - ((v - min) / span) * height).toFixed(1)}`);
  const stroke =
    tone === 'good' ? '#24B47E' : tone === 'bad' ? '#F0616D' : tone === 'warn' ? '#F5A623' : '#7C828D';
  const last = values[values.length - 1];
  const lx = (values.length - 1) * stepX;
  const ly = height - ((last - min) / span) * height;
  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="trend">
      <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={1.75} fill={stroke} />
    </svg>
  );
}
