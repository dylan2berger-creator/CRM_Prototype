// Formatting helpers. Money in whole dollars with thousands separators;
// percentages to one decimal; tabular figures everywhere numbers line up.

export const money = (n: number): string =>
  n < 0
    ? `-$${Math.round(Math.abs(n)).toLocaleString('en-US')}`
    : `$${Math.round(n).toLocaleString('en-US')}`;

// Compact money for big roll-up figures, e.g. $1.2M, $980K.
export function moneyCompact(n: number): string {
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString('en-US')}K`;
  return money(n);
}

export const int = (n: number): string => Math.round(n).toLocaleString('en-US');

export const pct = (n: number, digits = 1): string => `${n.toFixed(digits)}%`;

// Signed percentage, for variances. Positive shows a leading +.
export const pctSigned = (n: number, digits = 1): string =>
  `${n >= 0 ? '+' : ''}${n.toFixed(digits)}%`;

export const num1 = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const num2 = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// "2026-06" -> "Jun 2026"
export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function monthShort(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) + " '" + String(y).slice(2);
}

// ISO date "2026-06-14" -> "Jun 14, 2026"
export function dateLabel(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00Z' : ''));
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// ISO datetime -> "Aug 4, 2026, 6:15 AM"
export function dateTimeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  });
}
