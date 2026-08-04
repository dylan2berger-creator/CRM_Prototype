// Status chips. Status is NEVER encoded in color alone — each variant pairs a
// color with a shape (dot glyph) and always a text label, so it reads for color
// vision deficiency and in grayscale.

import { ActionPlanStatus, DrpTier, SalesAskStatus, StepStatus } from '@/types';

type Variant = 'good' | 'warn' | 'bad' | 'neutral' | 'accent';

const STYLES: Record<Variant, string> = {
  good: 'bg-good-soft text-good-text ring-1 ring-inset ring-good/30',
  warn: 'bg-warn-soft text-warn-text ring-1 ring-inset ring-warn/30',
  bad: 'bg-bad-soft text-bad-text ring-1 ring-inset ring-bad/30',
  neutral: 'bg-neutral-soft text-neutral-text ring-1 ring-inset ring-line-strong',
  accent: 'bg-accent-soft text-accent-hover ring-1 ring-inset ring-accent-ring',
};

// Distinct shapes reinforce the status without relying on hue.
const GLYPH: Record<Variant, string> = {
  good: '●',
  warn: '◆',
  bad: '▲',
  neutral: '○',
  accent: '■',
};

export function Badge({ variant, children, title }: { variant: Variant; children: React.ReactNode; title?: string }) {
  return (
    <span className={`chip ${STYLES[variant]}`} title={title}>
      <span aria-hidden className="text-[0.6em] leading-none">{GLYPH[variant]}</span>
      {children}
    </span>
  );
}

const TIER_VARIANT: Record<DrpTier, Variant> = {
  Preferred: 'good',
  Standard: 'neutral',
  Watch: 'warn',
  'At risk': 'bad',
};
export function TierBadge({ tier }: { tier: DrpTier | null }) {
  if (!tier) return <span className="text-2xs text-muted">No DRP</span>;
  return <Badge variant={TIER_VARIANT[tier]}>{tier}</Badge>;
}

const PLAN_VARIANT: Record<ActionPlanStatus, Variant> = {
  Draft: 'neutral',
  Active: 'accent',
  Monitoring: 'warn',
  Closed: 'good',
};
export function PlanStatusBadge({ status }: { status: ActionPlanStatus }) {
  return <Badge variant={PLAN_VARIANT[status]}>{status}</Badge>;
}

const STEP_VARIANT: Record<StepStatus, Variant> = {
  'Not started': 'neutral',
  'In progress': 'accent',
  Blocked: 'bad',
  Done: 'good',
};
export function StepStatusBadge({ status }: { status: StepStatus }) {
  return <Badge variant={STEP_VARIANT[status]}>{status}</Badge>;
}

const ASK_VARIANT: Record<SalesAskStatus, Variant> = {
  Open: 'warn',
  Accepted: 'accent',
  Contacted: 'good',
  Closed: 'neutral',
};
export function SalesAskBadge({ status }: { status: SalesAskStatus }) {
  return <Badge variant={ASK_VARIANT[status]}>{status}</Badge>;
}

export function ChallengedBadge({ months }: { months: number }) {
  return (
    <Badge variant="bad" title={`Challenged for ${months} month${months === 1 ? '' : 's'}`}>
      Challenged · {months} mo
    </Badge>
  );
}

export function RecoveredBadge() {
  return <Badge variant="good">Recovered this month</Badge>;
}

export function SeverityBadge({ severity }: { severity: 'Low' | 'Medium' | 'High' }) {
  const v: Variant = severity === 'High' ? 'bad' : severity === 'Medium' ? 'warn' : 'neutral';
  return <Badge variant={v}>{severity}</Badge>;
}
