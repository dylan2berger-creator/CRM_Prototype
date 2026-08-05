// Action-plan kanban board — drag a card between columns to update its status.
// Board and List views. Status changes commit through the DataContext (moving a
// card to In progress sets its startedOn benchmark date; Done sets completedOn).
// Detailed editing (target metrics, tagging, carrier) lives in the plan editor;
// the card's edit pencil links there.

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ActionPlan, ActionStep, StepStatus } from '@/types';
import { useData } from '@/data/DataContext';
import { METRICS } from '@/data/metrics';
import { PlanStatusBadge, StepStatusBadge } from '@/components/status';
import { dateLabel } from '@/utils/format';

const COLUMNS: { status: StepStatus; dot: string; bar: string; border: string }[] = [
  { status: 'Not started', dot: 'bg-neutral', bar: 'border-t-neutral', border: 'border-l-neutral' },
  { status: 'In progress', dot: 'bg-accent', bar: 'border-t-accent', border: 'border-l-accent' },
  { status: 'Blocked', dot: 'bg-bad', bar: 'border-t-bad', border: 'border-l-bad' },
  { status: 'Done', dot: 'bg-good', bar: 'border-t-good', border: 'border-l-good' },
];

const today = () => new Date().toISOString().slice(0, 10);

// tiny inline icons (no external assets)
const UserIcon = () => (
  <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden>
    <circle cx="8" cy="5" r="3" /><path d="M2 14c0-3 2.7-5 6-5s6 2 6 5v1H2z" />
  </svg>
);
const CalIcon = () => (
  <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <rect x="2" y="3" width="12" height="11" rx="1.5" /><path d="M2 6h12M5 2v2M11 2v2" />
  </svg>
);
const PencilIcon = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M11 2.5 13.5 5 6 12.5 3 13l.5-3z" />
  </svg>
);
const TrashIcon = () => (
  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M3 4h10M6 4V2.5h4V4M4.5 4l.5 9h6l.5-9M7 6.5v5M9 6.5v5" />
  </svg>
);

function planHealth(plan: ActionPlan): { label: string; tone: 'good' | 'warn' | 'bad' } {
  const overdue = plan.steps.some((s) => s.status !== 'Done' && s.dueOn < today());
  const blocked = plan.steps.some((s) => s.status === 'Blocked');
  if (overdue) return { label: 'Overdue steps', tone: 'bad' };
  if (blocked) return { label: 'Blocked', tone: 'warn' };
  return { label: 'On track', tone: 'good' };
}

export function ActionPlanBoard({ plan, storeId }: { plan: ActionPlan; storeId: string }) {
  const d = useData();
  const [view, setView] = useState<'board' | 'list'>('board');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<StepStatus | null>(null);
  const health = planHealth(plan);

  const moveTo = (stepId: string, status: StepStatus) => {
    const step = plan.steps.find((s) => s.id === stepId);
    if (!step || step.status === status) return;
    const patch: Partial<ActionStep> = { status };
    if (status === 'In progress' && !step.startedOn) patch.startedOn = today();
    if (status === 'Done') patch.completedOn = today();
    d.updateStep(plan.id, stepId, patch);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PlanStatusBadge status={plan.status} />
          <span
            className={`chip ${
              health.tone === 'good' ? 'bg-good-soft text-good-text' : health.tone === 'warn' ? 'bg-warn-soft text-warn-text' : 'bg-bad-soft text-bad-text'
            }`}
          >
            {health.tone === 'good' ? '●' : health.tone === 'warn' ? '◆' : '▲'} {health.label}
          </span>
          <span className="text-2xs text-muted">Drag a card between columns to update its status.</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded border border-line-strong bg-panel p-0.5">
            {(['board', 'list'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded px-2 py-1 text-2xs font-medium capitalize ${view === v ? 'bg-accent text-white' : 'text-muted hover:text-ink'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <Link to={`/store/${storeId}/plan`} className="btn-accent text-2xs">
            + Add step
          </Link>
        </div>
      </div>

      {plan.summary && <p className="mb-3 text-sm text-ink">{plan.summary}</p>}

      {view === 'board' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = plan.steps.filter((s) => s.status === col.status);
            return (
              <div
                key={col.status}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverCol(col.status);
                }}
                onDragLeave={() => setOverCol((c) => (c === col.status ? null : c))}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = dragId ?? e.dataTransfer.getData('text/plain');
                  if (id) moveTo(id, col.status);
                  setDragId(null);
                  setOverCol(null);
                }}
                className={`rounded-lg border bg-panel ${overCol === col.status ? 'border-accent ring-1 ring-accent-ring' : 'border-line'}`}
              >
                <div className={`flex items-center justify-between rounded-t-lg border-t-2 ${col.bar} bg-surface px-2.5 py-1.5`}>
                  <div className="flex items-center gap-1.5">
                    <span className={`inline-block h-2 w-2 rounded-full ${col.dot}`} aria-hidden />
                    <span className="text-2xs font-semibold uppercase tracking-wide text-ink">{col.status}</span>
                  </div>
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-panel px-1 text-2xs text-muted">{items.length}</span>
                </div>
                <div className="min-h-[72px] space-y-2 p-2">
                  {items.map((s) => (
                    <Card key={s.id} step={s} storeId={storeId} border={col.border} onDragStart={(id) => setDragId(id)} onDelete={() => d.deleteStep(plan.id, s.id)} />
                  ))}
                  {items.length === 0 && (
                    <div className="grid h-16 place-items-center rounded border border-dashed border-line-strong text-2xs text-muted">
                      {overCol === col.status ? 'Release to move here' : 'Drop here'}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListView plan={plan} storeId={storeId} />
      )}
    </div>
  );
}

function Card({
  step,
  storeId,
  border,
  onDragStart,
  onDelete,
}: {
  step: ActionStep;
  storeId: string;
  border: string;
  onDragStart: (id: string) => void;
  onDelete: () => void;
}) {
  const overdue = step.status !== 'Done' && step.dueOn < today();
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', step.id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart(step.id);
      }}
      className={`group cursor-grab rounded border border-line border-l-4 ${border} bg-surface p-2 shadow-sm active:cursor-grabbing`}
    >
      <div className="flex items-start justify-between gap-1">
        <div className="text-xs font-medium leading-snug text-ink">{step.title}</div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Link to={`/store/${storeId}/plan`} className="text-muted hover:text-accent-hover" title="Edit in plan editor">
            <PencilIcon />
          </Link>
          <button onClick={onDelete} className="text-muted hover:text-bad-text" title="Delete step">
            <TrashIcon />
          </button>
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1 text-2xs text-muted">
        <UserIcon />
        <span className="truncate">{step.owner || 'Unassigned'}</span>
      </div>
      <div className={`mt-0.5 flex items-center gap-1 text-2xs ${overdue ? 'text-bad-text' : 'text-muted'}`}>
        <CalIcon />
        <span>{dateLabel(step.dueOn)}</span>
        {overdue && <span className="font-medium">· overdue</span>}
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span className="chip bg-panel text-muted ring-1 ring-inset ring-line">{step.type}</span>
        {step.targetMetrics.slice(0, 2).map((m) => (
          <span key={m} className="chip bg-accent-soft text-accent-hover">
            {METRICS[m].short}
          </span>
        ))}
        {step.targetMetrics.length > 2 && <span className="text-2xs text-muted">+{step.targetMetrics.length - 2}</span>}
      </div>
    </div>
  );
}

function ListView({ plan, storeId }: { plan: ActionPlan; storeId: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Step</th>
            <th>Type</th>
            <th>Targets</th>
            <th>Owner</th>
            <th>Due</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {plan.steps.map((s) => (
            <tr key={s.id}>
              <td className="text-xs font-medium">{s.title}</td>
              <td className="text-2xs">{s.type}</td>
              <td className="text-2xs text-muted">{s.targetMetrics.map((m) => METRICS[m].short).join(', ')}</td>
              <td className="text-xs">{s.owner}</td>
              <td className="text-xs">{dateLabel(s.dueOn)}</td>
              <td><StepStatusBadge status={s.status} /></td>
              <td>
                <Link to={`/store/${storeId}/plan`} className="text-2xs text-accent-hover hover:underline">
                  Edit
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
