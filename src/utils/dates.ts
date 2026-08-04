// Month-string ("YYYY-MM") and ISO-date arithmetic used by the generator and app.

export function toMonth(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function currentMonth(): string {
  return toMonth(new Date());
}

// Build N months ending at `end` (inclusive), oldest first.
export function monthsEndingAt(end: string, count: number): string[] {
  const [y, m] = end.split('-').map(Number);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(toMonth(d));
  }
  return out;
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  return toMonth(new Date(Date.UTC(y, m - 1 + delta, 1)));
}

// Whole-month difference a - b (a later => positive).
export function monthDiff(a: string, b: string): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b.split('-').map(Number);
  return (ay - by) * 12 + (am - bm);
}

export function monthIndex(months: string[], month: string): number {
  return months.indexOf(month);
}

// Trailing window of `n` months ending at `end` (inclusive) within `months`.
export function trailing(months: string[], end: string, n: number): string[] {
  const idx = months.indexOf(end);
  if (idx < 0) return [];
  return months.slice(Math.max(0, idx - n + 1), idx + 1);
}

// ISO date helpers -----------------------------------------------------------

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// First-of-month ISO date for a "YYYY-MM".
export function monthStartIso(month: string): string {
  return `${month}-01`;
}

// A day within a month, ISO. day clamped to 28 to stay valid.
export function dayInMonthIso(month: string, day: number): string {
  return `${month}-${String(Math.min(28, Math.max(1, day))).padStart(2, '0')}`;
}
