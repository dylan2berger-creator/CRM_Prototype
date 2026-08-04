// Variance cell — signed percentage with an arrow and color, but the sign and
// arrow carry the meaning so it never depends on color alone.

import { pctSigned } from '@/utils/format';

export function Variance({
  pct,
  good,
  className = '',
}: {
  pct: number | null;
  good?: boolean; // is this variance in the good direction? drives color
  className?: string;
}) {
  if (pct == null || !Number.isFinite(pct)) return <span className="text-muted">—</span>;
  const isGood = good ?? pct >= 0;
  const arrow = pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : '·';
  const color = Math.abs(pct) < 0.05 ? 'text-muted' : isGood ? 'text-good-text' : 'text-bad-text';
  return (
    <span className={`tnum ${color} ${className}`}>
      <span aria-hidden className="text-[0.7em]">{arrow}</span> {pctSigned(pct)}
    </span>
  );
}

// Percentage-of-plan cell, e.g. "88.2%" colored by whether it clears a threshold.
export function PctOfPlan({ value, threshold = 100 }: { value: number | null; threshold?: number }) {
  if (value == null) return <span className="text-muted">—</span>;
  const tone = value >= threshold ? 'text-good-text' : value >= threshold - 5 ? 'text-warn-text' : 'text-bad-text';
  return <span className={`tnum ${tone}`}>{value.toFixed(1)}%</span>;
}
