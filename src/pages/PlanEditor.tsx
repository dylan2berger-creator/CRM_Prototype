// 3. Plan editor - structured, not a generic to-do list. Every task carries a
// type and the metrics it is meant to move, so the benchmarking view can show
// whether the task moved what it was supposed to move.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '@/data/DataContext';
import { clientById, planForStore, storeById, storeClientMix } from '@/data/selectors';
import { worstDiagnostic } from '@/data/diagnosis';
import { METRIC_ORDER, METRICS } from '@/data/metrics';
import { EmptyState, Field, OpenQuestion, Panel, Select } from '@/components/ui';
import { SalesAskBadge, StepStatusBadge } from '@/components/status';
import {
  ActionPlanStatus,
  ActionStep,
  Risk,
  Role,
  SalesAsk,
  SalesAskStatus,
  StepStatus,
  TaggedRole,
  TargetMetric,
  TASK_TYPES,
  TaskType,
} from '@/types';
import { dateLabel } from '@/utils/format';

const STEP_STATUSES: StepStatus[] = ['Not started', 'In progress', 'Blocked', 'Done'];
const PLAN_STATUSES: ActionPlanStatus[] = ['Draft', 'Active', 'Monitoring', 'Closed'];
const today = () => new Date().toISOString().slice(0, 10);

export function PlanEditor() {
  const { id = '' } = useParams();
  const d = useData();
  const { data } = d;
  const store = storeById(data, id);
  const plan = store ? planForStore(data, store.id) : undefined;

  if (!store) return <EmptyState title="Store not found">Return to the portfolio and pick a store.</EmptyState>;

  if (!plan) {
    return (
      <div className="space-y-3">
        <PlanHeader storeName={store.name} storeId={store.id} />
        <EmptyState title="No action plan yet">
          This store has no plan. Create one to log steps, tag owners, add risks, and raise a sales ask.
          <div className="mt-3">
            <button className="btn-accent" onClick={() => d.createPlan(store.id, 'You (SPM)')}>
              Create action plan
            </button>
          </div>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PlanHeader storeName={store.name} storeId={store.id} />

      <Panel title="Plan overview">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Status">
            <Select
              value={plan.status}
              onChange={(v) => d.updatePlan(plan.id, { status: v as ActionPlanStatus })}
              options={PLAN_STATUSES.map((s) => ({ value: s, label: s }))}
              aria-label="Plan status"
            />
          </Field>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-2xs font-medium uppercase tracking-wide text-muted">Summary</span>
            <textarea
              className="field min-h-[42px]"
              value={plan.summary}
              placeholder="One or two sentences: what is wrong and what the plan targets."
              onChange={(e) => d.updatePlan(plan.id, { summary: e.target.value })}
            />
          </label>
        </div>
        <p className="mt-2 text-2xs text-muted">Created {dateLabel(plan.createdOn)} by {plan.createdBy}. Edits save immediately - this is the single source of truth for the plan.</p>
      </Panel>

      <StepsSection storeId={store.id} planId={plan.id} steps={plan.steps} />
      <RisksSection planId={plan.id} risks={plan.risks} />
      <SalesAsksSection planId={plan.id} storeId={store.id} asks={plan.salesAsks} />
    </div>
  );
}

function PlanHeader({ storeName, storeId }: { storeName: string; storeId: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <Link to={`/store/${storeId}`} className="text-2xs text-muted hover:underline">
          ← {storeName}
        </Link>
        <h1 className="text-lg font-semibold text-ink">Action plan editor</h1>
        <p className="text-xs text-muted">Every task needs a type and at least one metric it is meant to move.</p>
      </div>
      <Link to={`/benchmarking?store=${storeId}`} className="btn">
        View benchmarking
      </Link>
    </header>
  );
}

// --- Steps ------------------------------------------------------------------

function StepsSection({ storeId, planId, steps }: { storeId: string; planId: string; steps: ActionStep[] }) {
  const d = useData();
  const { data } = d;
  const suggested = worstDiagnostic(data, storeId);
  const contacts = useContacts(storeId);
  const clientOptions = useMemo(
    () => storeClientMix(data, storeId).filter((m) => m.client.isDrp).map((m) => ({ value: m.client.id, label: m.client.name })),
    [data, storeId],
  );

  return (
    <Panel
      title="Steps"
      subtitle="Central review rule changes, training, monitoring, carrier outreach, staffing, estimating, parts. Type and target metrics are required."
    >
      <div className="space-y-2">
        {steps.map((step, i) => (
          <StepRow
            key={step.id}
            step={step}
            index={i}
            total={steps.length}
            planId={planId}
            contacts={contacts}
            clientOptions={clientOptions}
          />
        ))}
        {steps.length === 0 && <p className="text-sm text-muted">No steps yet. Add the first task below.</p>}
      </div>
      <AddStepForm planId={planId} suggested={suggested} contacts={contacts} clientOptions={clientOptions} />
    </Panel>
  );
}

function StepRow({
  step,
  index,
  total,
  planId,
  contacts,
  clientOptions,
}: {
  step: ActionStep;
  index: number;
  total: number;
  planId: string;
  contacts: Contact[];
  clientOptions: { value: string; label: string }[];
}) {
  const d = useData();
  const { data } = d;

  const setStatus = (status: StepStatus) => {
    const patch: Partial<ActionStep> = { status };
    // startedOn is set when the task moves to In progress - the benchmark date.
    if (status === 'In progress' && !step.startedOn) patch.startedOn = today();
    if (status === 'Done') patch.completedOn = today();
    d.updateStep(planId, step.id, patch);
  };

  const toggleMetric = (m: TargetMetric) => {
    const has = step.targetMetrics.includes(m);
    if (has && step.targetMetrics.length === 1) return; // keep at least one
    const next = has ? step.targetMetrics.filter((x) => x !== m) : [...step.targetMetrics, m];
    d.updateStep(planId, step.id, { targetMetrics: next });
  };

  const move = (dir: -1 | 1) => {
    const ids = data.actionPlans.find((p) => p.id === planId)!.steps.map((s) => s.id);
    const j = index + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[index], ids[j]] = [ids[j], ids[index]];
    d.reorderSteps(planId, ids);
  };

  return (
    <div className="rounded border border-line bg-surface p-2.5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex flex-col pt-1">
          <button className="text-muted hover:text-ink disabled:opacity-30" onClick={() => move(-1)} disabled={index === 0} aria-label="Move up">▲</button>
          <button className="text-muted hover:text-ink disabled:opacity-30" onClick={() => move(1)} disabled={index === total - 1} aria-label="Move down">▼</button>
        </div>
        <input
          className="field flex-1 font-medium"
          value={step.title}
          onChange={(e) => d.updateStep(planId, step.id, { title: e.target.value })}
        />
        <StepStatusBadge status={step.status} />
        <button className="btn text-bad-text" onClick={() => d.deleteStep(planId, step.id)}>Delete</button>
      </div>

      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <Field label="Type">
          <Select value={step.type} onChange={(v) => d.updateStep(planId, step.id, { type: v as TaskType })} options={TASK_TYPES.map((t) => ({ value: t, label: t }))} aria-label="Task type" />
        </Field>
        <Field label="Owner">
          <Select
            value={step.owner}
            onChange={(v) => {
              const c = contacts.find((x) => x.name === v);
              d.updateStep(planId, step.id, { owner: v, ownerRole: (c?.role as Role) ?? 'spm' });
            }}
            options={contacts.filter((c) => c.role !== 'National Account Manager').map((c) => ({ value: c.name, label: `${c.name} (${c.role})` }))}
            aria-label="Owner"
          />
        </Field>
        <Field label="Due">
          <input type="date" className="field" value={step.dueOn} onChange={(e) => d.updateStep(planId, step.id, { dueOn: e.target.value })} />
        </Field>
        <Field label="Status">
          <Select value={step.status} onChange={(v) => setStatus(v as StepStatus)} options={STEP_STATUSES.map((s) => ({ value: s, label: s }))} aria-label="Step status" />
        </Field>
      </div>

      {/* Carrier-specific */}
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Field label="Carrier (optional - for a carrier-specific task)">
          <Select
            value={step.clientId ?? ''}
            onChange={(v) => d.updateStep(planId, step.id, { clientId: v || null })}
            options={[{ value: '', label: 'Not carrier-specific' }, ...clientOptions]}
            aria-label="Carrier"
          />
        </Field>
        <div>
          <span className="text-2xs font-medium uppercase tracking-wide text-muted">Started (benchmark date)</span>
          <div className="mt-1 text-sm text-ink">{step.startedOn ? dateLabel(step.startedOn) : <span className="text-muted">Set when moved to In progress</span>}</div>
        </div>
      </div>

      {/* Target metrics */}
      <div className="mt-2">
        <span className="text-2xs font-medium uppercase tracking-wide text-muted">Target metrics (at least one - drives the chart markers)</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {METRIC_ORDER.map((m) => {
            const on = step.targetMetrics.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleMetric(m)}
                className={`rounded px-2 py-1 text-2xs font-medium ${on ? 'bg-accent text-white' : 'bg-panel text-muted hover:text-ink'}`}
                title={on && step.targetMetrics.length === 1 ? 'A task must keep at least one target metric' : METRICS[m].label}
              >
                {METRICS[m].short}
              </button>
            );
          })}
        </div>
      </div>

      {/* Note */}
      <div className="mt-2">
        <input className="field w-full text-xs" placeholder="Note (optional)" value={step.note} onChange={(e) => d.updateStep(planId, step.id, { note: e.target.value })} />
      </div>

      {/* Tagged people */}
      <TaggedPeople planId={planId} step={step} contacts={contacts} />
    </div>
  );
}

function TaggedPeople({ planId, step, contacts }: { planId: string; step: ActionStep; contacts: Contact[] }) {
  const d = useData();
  const [name, setName] = useState(contacts[0]?.name ?? '');
  const [reason, setReason] = useState('');

  const add = () => {
    const c = contacts.find((x) => x.name === name);
    if (!c || !reason.trim()) return;
    const tagged = [...step.taggedPeople, { name: c.name, role: c.role, reason: reason.trim() }];
    d.updateStep(planId, step.id, { taggedPeople: tagged });
    setReason('');
  };

  return (
    <div className="mt-2 rounded border border-line bg-panel p-2">
      <span className="text-2xs font-medium uppercase tracking-wide text-muted">Tagged for outreach</span>
      {step.taggedPeople.length > 0 && (
        <ul className="mt-1 space-y-1">
          {step.taggedPeople.map((t, i) => (
            <li key={i} className="flex items-center gap-2 text-xs">
              <span className="chip bg-surface ring-1 ring-inset ring-line">{t.name}</span>
              <span className="text-2xs text-muted">{t.role}</span>
              <span className="text-ink">{t.reason}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1 flex flex-wrap items-end gap-2">
        <Select value={name} onChange={setName} options={contacts.map((c) => ({ value: c.name, label: `${c.name} (${c.role})` }))} aria-label="Tag person" />
        <input className="field flex-1" placeholder="Reason for outreach" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn" onClick={add} disabled={!reason.trim()}>Tag person</button>
      </div>
    </div>
  );
}

function AddStepForm({
  planId,
  suggested,
  contacts,
  clientOptions,
}: {
  planId: string;
  suggested: TargetMetric | null;
  contacts: Contact[];
  clientOptions: { value: string; label: string }[];
}) {
  const d = useData();
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('Training');
  // Suggest, do not force: the diagnosis suggestion is a one-click chip below,
  // not a pre-filled default. The CPM consciously picks what the task targets.
  const [metrics, setMetrics] = useState<TargetMetric[]>([]);
  const [owner, setOwner] = useState(contacts[0]?.name ?? '');
  const [due, setDue] = useState('');
  const [clientId, setClientId] = useState('');

  const canAdd = title.trim() && metrics.length > 0;

  const add = () => {
    if (!canAdd) return;
    const c = contacts.find((x) => x.name === owner);
    const step: ActionStep = {
      id: d.newId('ST'),
      title: title.trim(),
      type,
      targetMetrics: metrics,
      clientId: clientId || null,
      owner,
      ownerRole: (c?.role as Role) ?? 'spm',
      dueOn: due || today(),
      startedOn: null,
      status: 'Not started',
      completedOn: null,
      note: '',
      taggedPeople: [],
    };
    d.addStep(planId, step);
    setTitle('');
    setMetrics([]);
    setDue('');
    setClientId('');
  };

  const toggle = (m: TargetMetric) => setMetrics((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  return (
    <div className="mt-3 rounded border border-dashed border-line-strong bg-panel p-3">
      <h3 className="text-sm font-semibold text-ink">Add a step</h3>
      <div className="mt-2 grid gap-2 md:grid-cols-4">
        <label className="md:col-span-2 flex flex-col gap-1">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted">Title</span>
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Retrain estimators on supplement discipline" />
        </label>
        <Field label="Type">
          <Select value={type} onChange={(v) => setType(v as TaskType)} options={TASK_TYPES.map((t) => ({ value: t, label: t }))} aria-label="New task type" />
        </Field>
        <Field label="Owner">
          <Select value={owner} onChange={setOwner} options={contacts.filter((c) => c.role !== 'National Account Manager').map((c) => ({ value: c.name, label: `${c.name} (${c.role})` }))} aria-label="New task owner" />
        </Field>
      </div>
      <div className="mt-2 grid gap-2 md:grid-cols-2">
        <Field label="Due">
          <input type="date" className="field" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
        <Field label="Carrier (optional)">
          <Select value={clientId} onChange={setClientId} options={[{ value: '', label: 'Not carrier-specific' }, ...clientOptions]} aria-label="New task carrier" />
        </Field>
      </div>
      <div className="mt-2">
        <div className="flex items-center gap-2">
          <span className="text-2xs font-medium uppercase tracking-wide text-muted">Target metrics (required)</span>
          {suggested && (
            <button className="chip bg-accent-soft text-accent-hover" onClick={() => setMetrics((m) => (m.includes(suggested) ? m : [...m, suggested]))}>
              Suggested: {METRICS[suggested].short}
            </button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {METRIC_ORDER.map((m) => {
            const on = metrics.includes(m);
            return (
              <button key={m} onClick={() => toggle(m)} className={`rounded px-2 py-1 text-2xs font-medium ${on ? 'bg-accent text-white' : 'bg-surface text-muted ring-1 ring-inset ring-line hover:text-ink'}`}>
                {METRICS[m].short}
              </button>
            );
          })}
        </div>
        {metrics.length === 0 && <p className="mt-1 text-2xs text-bad-text">Pick at least one metric this task is meant to move.</p>}
      </div>
      <div className="mt-2">
        <button className="btn-accent" onClick={add} disabled={!canAdd}>Add step</button>
      </div>
    </div>
  );
}

// --- Risks ------------------------------------------------------------------

function RisksSection({ planId, risks }: { planId: string; risks: Risk[] }) {
  const d = useData();
  const [desc, setDesc] = useState('');
  const [severity, setSeverity] = useState<Risk['severity']>('Medium');
  const [mitigation, setMitigation] = useState('');
  const [owner, setOwner] = useState('');

  const add = () => {
    if (!desc.trim()) return;
    d.addRisk(planId, { id: d.newId('RK'), description: desc.trim(), severity, owner: owner.trim() || 'You (SPM)', mitigation: mitigation.trim() });
    setDesc('');
    setMitigation('');
    setOwner('');
  };

  return (
    <Panel title="Risks">
      {risks.length > 0 ? (
        <ul className="space-y-1">
          {risks.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-2 rounded border border-line px-2.5 py-1.5 text-xs">
              <div>
                <div className="text-ink">
                  <span className="mr-2 font-medium">[{r.severity}]</span>
                  {r.description}
                </div>
                <div className="text-2xs text-muted">Mitigation: {r.mitigation || '-'} · owner {r.owner}</div>
              </div>
              <button className="btn text-bad-text" onClick={() => d.deleteRisk(planId, r.id)}>Remove</button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No risks logged.</p>
      )}
      <div className="mt-2 grid gap-2 rounded border border-dashed border-line-strong bg-panel p-2 md:grid-cols-4">
        <input className="field md:col-span-2" placeholder="Risk description" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <Select value={severity} onChange={(v) => setSeverity(v as Risk['severity'])} options={['Low', 'Medium', 'High'].map((s) => ({ value: s, label: s }))} aria-label="Risk severity" />
        <input className="field" placeholder="Owner" value={owner} onChange={(e) => setOwner(e.target.value)} />
        <input className="field md:col-span-3" placeholder="Mitigation" value={mitigation} onChange={(e) => setMitigation(e.target.value)} />
        <button className="btn-accent" onClick={add} disabled={!desc.trim()}>Add risk</button>
      </div>
    </Panel>
  );
}

// --- Sales asks -------------------------------------------------------------

const ASK_FLOW: SalesAskStatus[] = ['Open', 'Accepted', 'Contacted', 'Closed'];

function SalesAsksSection({ planId, storeId, asks }: { planId: string; storeId: string; asks: SalesAsk[] }) {
  const d = useData();
  const { data } = d;
  const clientOptions = storeClientMix(data, storeId).map((m) => ({ value: m.client.id, label: m.client.name }));
  const [clientId, setClientId] = useState(clientOptions[0]?.value ?? '');
  const [request, setRequest] = useState('');

  const add = () => {
    if (!request.trim() || !clientId) return;
    d.addSalesAsk(planId, {
      id: d.newId('SK'),
      clientId,
      request: request.trim(),
      raisedOn: today(),
      raisedBy: 'You (SPM)',
      status: 'Open',
      outcome: null,
    });
    setRequest('');
  };

  const advance = (ask: SalesAsk) => {
    const idx = ASK_FLOW.indexOf(ask.status);
    if (idx < ASK_FLOW.length - 1) d.updateSalesAsk(planId, ask.id, { status: ASK_FLOW[idx + 1] });
  };

  return (
    <Panel title="Sales asks" subtitle="A request to Sales or a National Account Manager to contact a client. Moves Open → Accepted → Contacted → Closed.">
      {asks.length > 0 ? (
        <ul className="space-y-1">
          {asks.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-2 rounded border border-line px-2.5 py-1.5 text-xs">
              <div>
                <div className="text-ink">{a.request}</div>
                <div className="text-2xs text-muted">{clientById(data, a.clientId)?.name} · raised {dateLabel(a.raisedOn)} by {a.raisedBy}</div>
              </div>
              <div className="flex items-center gap-2">
                <SalesAskBadge status={a.status} />
                {a.status !== 'Closed' && (
                  <button className="btn" onClick={() => advance(a)}>
                    Move to {ASK_FLOW[ASK_FLOW.indexOf(a.status) + 1]}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No sales asks raised.</p>
      )}
      <div className="mt-2 grid gap-2 rounded border border-dashed border-line-strong bg-panel p-2 md:grid-cols-4">
        <Select value={clientId} onChange={setClientId} options={clientOptions} aria-label="Sales ask client" />
        <input className="field md:col-span-2" placeholder="What are you asking Sales / the NAM to do?" value={request} onChange={(e) => setRequest(e.target.value)} />
        <button className="btn-accent" onClick={add} disabled={!request.trim() || !clientId}>Raise sales ask</button>
      </div>
      <div className="mt-2">
        <OpenQuestion>The task-type taxonomy is a first pass drawn from examples - validate it with the SPMs and CPMs who use them before it becomes fixed.</OpenQuestion>
      </div>
    </Panel>
  );
}

// --- contacts ---------------------------------------------------------------

interface Contact {
  name: string;
  role: TaggedRole;
}
function useContacts(storeId: string): Contact[] {
  const { data } = useData();
  return useMemo(() => {
    const store = storeById(data, storeId);
    const list: Contact[] = [];
    if (store) {
      // the shop's owner (SPM) first - the natural default plan owner
      if (store.spmId) {
        const owner = data.spms.find((s) => s.id === store.spmId);
        if (owner) list.push({ name: owner.name, role: 'spm' });
      }
      if (store.gmName) list.push({ name: store.gmName, role: 'gm' });
      const region = data.regions.find((r) => r.id === store.regionId);
      if (region) list.push({ name: region.rvpName, role: 'rvp' });
    }
    for (const s of data.spms) list.push({ name: s.name, role: 'spm' });
    for (const c of data.cpms) list.push({ name: c.name, role: c.role });
    // National Account Managers (fictional) available for tagging on outreach.
    list.push({ name: 'Dana Kirkwood', role: 'National Account Manager' });
    list.push({ name: 'Priya Anand', role: 'National Account Manager' });
    list.push({ name: 'Wes Holloway', role: 'National Account Manager' });
    // de-dupe by name
    const seen = new Set<string>();
    return list.filter((c) => (seen.has(c.name) ? false : (seen.add(c.name), true)));
  }, [data, storeId]);
}
