// Small shared UI primitives used across screens.

import { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
  bodyClass = '',
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || right) && (
        <header className="flex items-start justify-between gap-3 border-b border-line px-3 py-2">
          <div>
            {title && <h2 className="text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-2xs text-muted">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={`p-3 ${bodyClass}`}>{children}</div>
    </section>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Select({
  value,
  onChange,
  options,
  className = '',
  'aria-label': ariaLabel,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <select aria-label={ariaLabel} className={`field ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// Segmented toggle — used for the analysis pivot control and metric toggles.
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  size?: 'sm' | 'md';
}) {
  const pad = size === 'sm' ? 'px-2 py-1 text-2xs' : 'px-3 py-1.5 text-sm';
  return (
    <div className="inline-flex flex-wrap rounded border border-line-strong bg-panel p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`${pad} rounded font-medium transition-colors ${
            value === o.value ? 'bg-accent text-white shadow-sm' : 'text-muted hover:text-ink'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded border border-dashed border-line-strong bg-panel px-6 py-10 text-center">
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="max-w-md text-xs text-muted">{children}</div>}
    </div>
  );
}

// A placeholder / open-question callout — used to surface the spec's unresolved
// questions in the UI where they bite.
export function OpenQuestion({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded border border-warn/40 bg-warn-soft px-2.5 py-1.5 text-2xs text-warn-text">
      <span aria-hidden className="mt-px font-bold">?</span>
      <span>{children}</span>
    </div>
  );
}

export function Stat({ label, value, sub, tone = 'default' }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' }) {
  const toneClass =
    tone === 'good' ? 'text-good-text' : tone === 'warn' ? 'text-warn-text' : tone === 'bad' ? 'text-bad-text' : 'text-ink';
  return (
    <div className="rounded border border-line bg-surface px-3 py-2">
      <div className="text-2xs font-medium uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tnum ${toneClass}`}>{value}</div>
      {sub && <div className="text-2xs text-muted">{sub}</div>}
    </div>
  );
}

export function TbdTag() {
  return <span className="chip bg-neutral-soft text-neutral-text ring-1 ring-inset ring-line-strong">TBD</span>;
}
