// 2. Store record - the core screen. Everything about one store on one page, in
// the spec's order. Continuity is a design requirement: whoever inherits this
// store should be able to read the plan, history, and reasoning here.

import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useData } from '@/data/DataContext';
import {
  cbsaById,
  clientById,
  cpmForCarrierDivision,
  divisionOfStore,
  spmName,
  planForStore,
  regionName,
  storeById,
  storeClientMix,
  worstDrpTier,
  challengedInfo,
} from '@/data/selectors';
import { evaluateStore } from '@/logic/challengedRule';
import {
  DIAGNOSTIC_METRICS,
  formatMetric,
  METRIC_ORDER,
  METRICS,
  storeMetricSeries,
} from '@/data/metrics';
import { carrierBreakdown, diagnose } from '@/data/diagnosis';
import { taskMarkersForStore } from '@/data/benchmark';
import { PerformanceChart, ChartMarker } from '@/components/PerformanceChart';
import { Panel, EmptyState, OpenQuestion, Stat } from '@/components/ui';
import { ChallengedBadge, RecoveredBadge, SalesAskBadge, SeverityBadge, TierBadge } from '@/components/status';
import { ActionPlanBoard } from '@/components/ActionPlanBoard';
import { Variance } from '@/components/Variance';
import { SourceTag } from '@/components/Provenance';
import { dateLabel, money, moneyCompact, int, num2, monthLabel } from '@/utils/format';
import { trailing, monthDiff } from '@/utils/dates';
import { ActionPlan, Store, TargetMetric } from '@/types';

export function StoreRecord() {
  const { id = '' } = useParams();
  const { data } = useData();
  const store = storeById(data, id);
  const [metric, setMetric] = useState<TargetMetric>('revenueActual');

  if (!store) return <EmptyState title="Store not found">Return to the portfolio and pick a store from the list.</EmptyState>;

  const ev = evaluateStore(store.id, data.currentMonth, data);
  const ci = challengedInfo(data, store.id);
  const bc = data.businessCases.find((b) => b.storeId === store.id);
  const cbsa = cbsaById(data, store.cbsaId);
  const plan = planForStore(data, store.id);
  const mix = storeClientMix(data, store.id);
  const storeDivision = divisionOfStore(data, store.id);
  const diag = diagnose(data, store.id);
  const worstAdverse = diag.find((d) => d.adverse);

  const series = useMemo(() => storeMetricSeries(data, store.id, metric).slice(-24), [data, store.id, metric]);
  const markers = useMemo<ChartMarker[]>(() => {
    const list: ChartMarker[] = [];
    if (plan) {
      const planMonth = plan.createdOn.slice(0, 7);
      if (series.some((s) => s.month === planMonth)) {
        list.push({ month: planMonth, label: 'Plan start', full: `Plan created ${dateLabel(plan.createdOn)}`, kind: 'plan' });
      }
    }
    for (const tm of taskMarkersForStore(data, store.id, metric)) {
      const month = tm.startedOn.slice(0, 7);
      if (!series.some((s) => s.month === month)) continue;
      list.push({
        month,
        label: shortType(tm.step.type),
        full: `${tm.step.title} - started ${dateLabel(tm.startedOn)} (${tm.step.type})`,
        kind: 'task',
        tone: tm.ba.improved == null ? 'neutral' : tm.ba.improved ? 'good' : 'bad',
      });
    }
    return list;
  }, [data, store.id, metric, plan, series]);

  const meta = METRICS[metric];

  return (
    <div className="space-y-3">
      {/* Header */}
      <header className="card p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Link to="/" className="text-2xs text-muted hover:underline">
                ← Portfolio
              </Link>
            </div>
            <h1 className="text-lg font-semibold text-ink">{store.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <span>{store.id}</span>
              <span>GM {store.gmName}</span>
              <span>{regionName(data, store.regionId)}{storeDivision ? ` · ${storeDivision}` : ''}</span>
              <span>{cbsa ? `${cbsa.name}, ${cbsa.state}` : store.cbsaId}</span>
              <span title="Shop Performance Manager who owns this shop. CPMs are assigned per carrier - see the breakdown below.">
                SPM {store.spmId ? spmName(data, store.spmId) : <span className="text-bad-text">unassigned</span>}
              </span>
              <span className={`chip ${store.brand === 'JHCC' ? 'bg-neutral-soft text-neutral-text' : 'bg-panel text-muted'}`}>{store.brand}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            {ci.isChallenged ? <ChallengedBadge months={ci.monthsChallenged} /> : ci.recoveredRecently ? <RecoveredBadge /> : <span className="chip bg-good-soft text-good-text"><span aria-hidden className="h-1.5 w-1.5 rounded-full bg-good" /> On track</span>}
            <TierBadge tier={worstDrpTier(data, store.id)} />
          </div>
        </div>
      </header>

      {/* Ownership & continuity - who owns the book, prior owner, rationale */}
      <OwnershipPanel data={data} store={store} plan={plan} />

      {/* Baseline strip */}
      <Panel title="Business case baseline" subtitle="The investment committee plan everything is measured against" right={<SourceTag dataset="Business case baseline (IC memos & workbooks)" />}>
        {bc ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Annual revenue plan" value={moneyCompact(bc.annualRevenuePlan)} sub={money(bc.annualRevenuePlan)} />
            <div className="rounded border border-line bg-surface px-3 py-2">
              <div className="text-2xs font-medium uppercase tracking-wide text-muted">Annual RO plan</div>
              {bc.annualRoPlan > 0 ? (
                <div className="mt-0.5 text-lg font-semibold tnum text-ink">{int(bc.annualRoPlan)}</div>
              ) : (
                <div className="mt-0.5 text-sm font-semibold text-bad-text">Not loaded</div>
              )}
              {bc.annualRoPlan === 0 && <div className="text-2xs text-muted">No RO baseline in the source document</div>}
            </div>
            <Stat label="Approved" value={dateLabel(bc.approvedOn)} />
            <div className="rounded border border-line bg-surface px-3 py-2">
              <div className="text-2xs font-medium uppercase tracking-wide text-muted">Source document</div>
              <div className="mt-0.5 text-sm font-medium text-ink">{bc.loadedFrom}</div>
              <div className="text-2xs text-muted">{bc.source}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-bad-text">No business case is loaded for this store. The baseline was never captured - this gap is the point, not an error.</p>
        )}
        {bc && bc.annualRoPlan === 0 && (
          <div className="mt-2">
            <OpenQuestion>Business case numbers may live only in memos and workbooks. This store's RO plan was never loaded - a deliberate "Not loaded" state pending baseline capture.</OpenQuestion>
          </div>
        )}
      </Panel>

      {/* Performance chart */}
      <Panel
        title="Performance"
        subtitle={`Monthly ${meta.label.toLowerCase()} over 24 months. Markers show the plan start and each task's start date - only tasks meant to move this metric appear.`}
        right={<SourceTag dataset={meta.source} />}
      >
        <div className="mb-2 flex flex-wrap gap-1">
          {METRIC_ORDER.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              aria-pressed={metric === m}
              className={`rounded px-2 py-1 text-2xs font-medium ${metric === m ? 'bg-accent text-white' : 'bg-panel text-muted hover:text-ink'}`}
            >
              {METRICS[m].short}
            </button>
          ))}
        </div>
        <PerformanceChart metric={metric} data={series} markers={markers} height={280} />
        {markers.length === 0 && (
          <p className="mt-1 text-2xs text-muted">No task on this store's plan targets {meta.label.toLowerCase()} yet. Switch metric or add a task in the plan editor to see its marker here.</p>
        )}
      </Panel>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* Why flagged */}
        <Panel title="Why this store is flagged" subtitle={`Rule ${ev.ruleVersion}`}>
          {ev.isChallenged ? (
            <div className="space-y-2">
              <ul className="space-y-1.5">
                {ev.reasons.map((r, i) => (
                  <li key={i} className="rounded border border-bad/30 bg-bad-soft px-2.5 py-1.5">
                    <div className="text-sm font-medium text-bad-text">{r.label}</div>
                    <div className="text-2xs text-muted">
                      actual <span className="tnum font-medium text-ink">{r.actual}</span> · threshold{' '}
                      <span className="tnum font-medium text-ink">{r.threshold}</span> · metric {r.metric}
                    </div>
                  </li>
                ))}
              </ul>
              {ci.firstFlaggedMonth && <p className="text-2xs text-muted">First flagged {monthLabel(ci.firstFlaggedMonth)}.</p>}
              <OpenQuestion>Challenged-rule thresholds are placeholders pending sign-off from Finance and Client Performance Management.</OpenQuestion>
            </div>
          ) : (
            <p className="text-sm text-muted">This store clears the challenged-store rule ({ev.ruleVersion}) this month. {ci.recoveredRecently && 'It recovered within the last month.'}</p>
          )}
        </Panel>

        {/* Diagnosis */}
        <Panel
          title="Diagnosis - what is causing this"
          subtitle="Diagnostic metrics ranked by how far off they are. Internal and external rules adherence stay separate - they point at different fixes."
          right={<SourceTag dataset="DOMO - Rules Adherence" />}
        >
          {worstAdverse && (
            <p className="mb-2 rounded bg-panel px-2.5 py-1.5 text-xs text-ink">
              Likely cause: <span className="font-semibold">{METRICS[worstAdverse.metric].label}</span> is the worst variance ({worstAdverse.offBy.toFixed(1)}% off {worstAdverse.comparatorLabel}).
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th className="text-right">Store</th>
                  <th className="text-right">Vs {'{'}plan/peer{'}'}</th>
                  <th className="text-right">Variance</th>
                </tr>
              </thead>
              <tbody>
                {diag.map((d) => (
                  <tr key={d.metric} className={d.adverse && d.offBy > 5 ? 'bg-bad-soft/40' : ''}>
                    <td className="text-xs font-medium">
                      {METRICS[d.metric].label}
                      {METRICS[d.metric].carrierSpecific && <span className="ml-1 text-2xs text-muted">per carrier</span>}
                    </td>
                    <td className="num text-xs">{formatMetric(d.metric, d.value)}</td>
                    <td className="num text-xs text-muted">
                      {formatMetric(d.metric, d.comparator)} <span className="text-2xs">({d.comparatorLabel})</span>
                    </td>
                    <td className="num text-xs">
                      <Variance pct={d.variancePct} good={!d.adverse} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <CarrierSpecificDiag data={data} storeId={store.id} />
        </Panel>
      </div>

      {/* Client & DRP breakdown */}
      <Panel title="Client and DRP breakdown" subtitle="A store can be compliant with one DRP and failing another." right={<SourceTag dataset="DOMO - DRP Scorecards" />}>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Client</th>
                <th>CPM</th>
                <th className="text-right">T12 revenue</th>
                <th className="text-right">Share of store</th>
                <th>DRP tier</th>
                <th className="text-right">Rank in CBSA</th>
                <th className="text-right">PIF trend (CBSA)</th>
                <th className="text-right">Boyd share</th>
              </tr>
            </thead>
            <tbody>
              {mix.map((m) => {
                const sc = data.scorecards.find((s) => s.storeId === store.id && s.clientId === m.client.id && s.month === data.currentMonth);
                const mkt = cbsaMarketTrend(data, store.cbsaId, m.client.id);
                return (
                  <tr key={m.client.id}>
                    <td className="text-xs font-medium">
                      {m.client.name}
                      {m.client.drpProgram && (
                        <div className="text-2xs font-normal text-muted">{m.client.drpProgram}</div>
                      )}
                    </td>
                    <td className="text-xs">
                      {m.client.isDrp ? (
                        storeDivision ? (
                          cpmForCarrierDivision(data, m.client.id, storeDivision) ? (
                            cpmForCarrierDivision(data, m.client.id, storeDivision)!.name
                          ) : (
                            <span className="text-bad-text">Unassigned</span>
                          )
                        ) : (
                          <span className="text-muted">-</span>
                        )
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="num text-xs">{moneyCompact(m.revenueT12)}</td>
                    <td className="num text-xs">{m.sharePct.toFixed(1)}%</td>
                    <td>{sc ? <TierBadge tier={sc.tier} /> : <span className="text-2xs text-muted">-</span>}</td>
                    <td className="num text-xs">{sc ? `${sc.rankInCbsa} / ${sc.competitorsInCbsa}` : '-'}</td>
                    <td className="num text-xs">{mkt ? <Variance pct={mkt.pifChangePct} good={mkt.pifChangePct >= 0} /> : '-'}</td>
                    <td className="num text-xs">{mkt ? `${mkt.boydSharePct.toFixed(1)}%` : '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-2">
          <OpenQuestion>DRP program names are real; the tier, CBSA rank, and competitor counts are illustrative - the carrier scorecard feed at competitor granularity is carrier-proprietary and not yet in BDAP.</OpenQuestion>
        </div>
      </Panel>

      {/* Action plan */}
      <Panel
        title="Action plan"
        subtitle={plan ? `Created ${dateLabel(plan.createdOn)} by ${plan.createdBy}` : 'No plan yet'}
        right={
          <Link to={`/store/${store.id}/plan`} className="btn-accent">
            {plan ? 'Open plan editor' : 'Create action plan'}
          </Link>
        }
      >
        {plan ? (
          <div className="space-y-3">
            <ActionPlanBoard plan={plan} storeId={store.id} />

            {plan.risks.length > 0 && (
              <div>
                <h3 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">Risks</h3>
                <ul className="space-y-1">
                  {plan.risks.map((rk) => (
                    <li key={rk.id} className="flex items-start gap-2 rounded border border-line px-2.5 py-1.5 text-xs">
                      <SeverityBadge severity={rk.severity} />
                      <div>
                        <div className="text-ink">{rk.description}</div>
                        <div className="text-2xs text-muted">Mitigation: {rk.mitigation} · owner {rk.owner}</div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.salesAsks.length > 0 && (
              <div>
                <h3 className="mb-1 text-2xs font-semibold uppercase tracking-wide text-muted">Sales asks</h3>
                <ul className="space-y-1">
                  {plan.salesAsks.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 rounded border border-line px-2.5 py-1.5 text-xs">
                      <SalesAskBadge status={a.status} />
                      <div>
                        <div className="text-ink">{a.request}</div>
                        <div className="text-2xs text-muted">
                          {clientById(data, a.clientId)?.name} · raised {dateLabel(a.raisedOn)} by {a.raisedBy}
                          {a.outcome && ` · ${a.outcome}`}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="No action plan yet">
            {ci.isChallenged
              ? 'This challenged store has no plan. Open the plan editor to log steps, tag owners, add risks, and raise a sales ask.'
              : 'This store is on track. Create a plan if you want to run a proactive intervention.'}
          </EmptyState>
        )}
      </Panel>
    </div>
  );
}

function OwnershipPanel({ data, store, plan }: { data: ReturnType<typeof useData>['data']; store: Store; plan?: ActionPlan }) {
  const region = data.regions.find((r) => r.id === store.regionId);
  const prev = store.previousSpmId ? spmName(data, store.previousSpmId) : null;
  const tenure = monthDiff(data.currentMonth, store.assignedOn.slice(0, 7));
  const prevSub = store.spmId ? (prev ? `handed off ${dateLabel(store.assignedOn)}` : 'first owner') : 'book now vacant';
  return (
    <Panel title="Ownership &amp; continuity" subtitle="Who owns this book now, who held it before, and the plan reasoning - so a handoff loses nothing.">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded border border-line bg-surface px-3 py-2">
          <div className="text-2xs font-medium uppercase tracking-wide text-muted">Current owner (SPM)</div>
          {store.spmId ? (
            <>
              <div className="mt-0.5 text-sm font-semibold text-ink">{spmName(data, store.spmId)}</div>
              <div className="text-2xs text-muted">{tenure} mo on book · since {dateLabel(store.assignedOn)}</div>
            </>
          ) : (
            <div className="mt-0.5 text-sm font-semibold text-bad-text">Unassigned</div>
          )}
        </div>
        <Stat label="Previous owner" value={prev ?? '-'} sub={prevSub} />
        <Stat label="RVP" value={region?.rvpName ?? '-'} sub={region?.name} />
        <Stat label="GM" value={store.gmName} />
      </div>
      <div className="mt-3 rounded border border-line bg-panel px-3 py-2">
        <div className="text-2xs font-semibold uppercase tracking-wide text-muted">Plan rationale</div>
        <p className="mt-0.5 text-xs text-ink">
          {plan ? plan.summary : 'No action plan yet - the reasoning will live here once a plan is created.'}
        </p>
      </div>
    </Panel>
  );
}

function CarrierSpecificDiag({ data, storeId }: { data: ReturnType<typeof useData>['data']; storeId: string }) {
  // Show external rules adherence per carrier - internal is a Boyd process
  // problem, external is a carrier compliance problem; a store can pass one DRP
  // and fail another.
  const rows = carrierBreakdown(data, storeId, 'externalRulesAdherencePct');
  if (rows.length < 2) return null;
  const worst = Math.min(...rows.map((r) => r.value));
  return (
    <div className="mt-2 rounded border border-line bg-panel p-2">
      <div className="text-2xs font-semibold uppercase tracking-wide text-muted">External rules adherence by carrier</div>
      <div className="mt-1 flex flex-wrap gap-2">
        {rows.map((r) => (
          <span key={r.clientId} className={`chip ${r.value === worst && r.value < 85 ? 'bg-bad-soft text-bad-text' : 'bg-surface text-ink ring-1 ring-inset ring-line'}`}>
            {r.clientName}: {r.value.toFixed(1)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function shortType(type: string): string {
  const map: Record<string, string> = {
    'Central review rule change': 'Central review',
    Training: 'Training',
    'Metric monitoring': 'Monitor',
    'Carrier outreach': 'Outreach',
    Staffing: 'Staffing',
    'Estimating process': 'Estimating',
    'Parts or supply': 'Parts',
    Other: 'Other',
  };
  return map[type] ?? type;
}

// CBSA PIF trend + latest Boyd share for a client, for the breakdown table.
function cbsaMarketTrend(data: ReturnType<typeof useData>['data'], cbsaId: string, clientId: string) {
  const rows = data.cbsaMarkets.filter((m) => m.cbsaId === cbsaId && m.clientId === clientId);
  if (!rows.length) return null;
  const window = trailing(data.months, data.currentMonth, 4);
  const inWindow = rows.filter((r) => window.includes(r.month)).sort((a, b) => (a.month < b.month ? -1 : 1));
  if (inWindow.length < 2) {
    const latest = rows[rows.length - 1];
    return { pifChangePct: 0, boydSharePct: latest.boydSharePct };
  }
  const first = inWindow[0];
  const last = inWindow[inWindow.length - 1];
  const pifChangePct = first.pifCount ? ((last.pifCount - first.pifCount) / first.pifCount) * 100 : 0;
  return { pifChangePct, boydSharePct: last.boydSharePct };
}

// silence unused-import guard for DIAGNOSTIC_METRICS / num2 if tree-shaken
void DIAGNOSTIC_METRICS;
void num2;
