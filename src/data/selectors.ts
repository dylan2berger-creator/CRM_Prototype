// Store-level derived selectors shared by the screens.

import {
  ActionPlan,
  Client,
  DataSet,
  Division,
  DrpScorecard,
  DrpTier,
  Store,
} from '@/types';
import { evaluateStore } from '@/logic/challengedRule';
import { monthDiff, trailing } from '@/utils/dates';
import { storeMetricValue } from '@/data/metrics';
import { dataIndex } from '@/data/dataIndex';

export const TIER_ORDER: DrpTier[] = ['Preferred', 'Standard', 'Watch', 'At risk'];

export function storeById(data: DataSet, id: string): Store | undefined {
  return data.stores.find((s) => s.id === id);
}
export function clientById(data: DataSet, id: string): Client | undefined {
  return data.clients.find((c) => c.id === id);
}
export function regionName(data: DataSet, id: string): string {
  return data.regions.find((r) => r.id === id)?.name ?? id;
}
export function cbsaById(data: DataSet, id: string) {
  return data.cbsas.find((c) => c.id === id);
}
export function cpmName(data: DataSet, id: string): string {
  return data.cpms.find((c) => c.id === id)?.name ?? '';
}
export function cpmById(data: DataSet, id: string) {
  return data.cpms.find((c) => c.id === id);
}

// The division a store sits in, via its region.
export function divisionOfStore(data: DataSet, storeId: string): Division | undefined {
  const s = storeById(data, storeId);
  return s ? data.regions.find((r) => r.id === s.regionId)?.division : undefined;
}

// The CPM who owns a carrier within a division, or null when the slot is vacant.
export function cpmForCarrierDivision(data: DataSet, carrierId: string, division: Division): { id: string; name: string } | null {
  const c = data.cpms.find((x) => x.carrierId === carrierId && x.division === division);
  return c ? { id: c.id, name: c.name } : null;
}

function storeTradesClient(data: DataSet, storeId: string, clientId: string): boolean {
  return (dataIndex(data).metricByStore.get(storeId) ?? []).some((m) => m.clientId === clientId);
}

// Per-carrier CPM assignment for a store: each DRP carrier it trades maps to the
// CPM for (carrier, store division), or null when that slot is vacant.
export interface StoreCpmAssignment {
  client: Client;
  sharePct: number;
  cpm: { id: string; name: string } | null;
}
export function storeCpmAssignments(data: DataSet, storeId: string): StoreCpmAssignment[] {
  const division = divisionOfStore(data, storeId);
  return storeClientMix(data, storeId)
    .filter((m) => m.client.isDrp)
    .map((m) => ({
      client: m.client,
      sharePct: m.sharePct,
      cpm: division ? cpmForCarrierDivision(data, m.client.id, division) : null,
    }));
}

// A CPM's book: stores that trade the CPM's carrier within the CPM's division.
export function storesForCpm(data: DataSet, cpmId: string): Store[] {
  const cpm = data.cpms.find((c) => c.id === cpmId);
  if (!cpm || !cpm.carrierId || !cpm.division) return [];
  return data.stores.filter(
    (s) => data.regions.find((r) => r.id === s.regionId)?.division === cpm.division && storeTradesClient(data, s.id, cpm.carrierId!),
  );
}

// Trailing revenue as a percentage of plan for a store (store-level sum).
export function trailingRevenuePctOfPlan(data: DataSet, storeId: string, n: number, end = data.currentMonth): number | null {
  const window = new Set(trailing(data.months, end, n));
  let actual = 0;
  let plan = 0;
  for (const m of dataIndex(data).metricByStore.get(storeId) ?? []) {
    if (window.has(m.month)) {
      actual += m.revenueActual;
      plan += m.revenuePlan;
    }
  }
  return plan > 0 ? (actual / plan) * 100 : null;
}

// Trailing DRP assignment volume as a percentage of forecast for a store.
export function trailingVolumePctOfForecast(data: DataSet, storeId: string, n: number, end = data.currentMonth): number | null {
  const window = new Set(trailing(data.months, end, n));
  let actual = 0;
  let forecast = 0;
  for (const v of dataIndex(data).volByStore.get(storeId) ?? []) {
    if (window.has(v.month)) {
      actual += v.assignmentActual;
      forecast += v.assignmentForecast;
    }
  }
  return forecast > 0 ? (actual / forecast) * 100 : null;
}

// Distinct clients a store trades with, with T12 revenue share, sorted by share.
export interface ClientMixEntry {
  client: Client;
  revenueT12: number;
  sharePct: number;
}
export function storeClientMix(data: DataSet, storeId: string, end = data.currentMonth): ClientMixEntry[] {
  const window = new Set(trailing(data.months, end, 12));
  const byClient = new Map<string, number>();
  for (const m of dataIndex(data).metricByStore.get(storeId) ?? []) {
    if (window.has(m.month)) {
      byClient.set(m.clientId, (byClient.get(m.clientId) ?? 0) + m.revenueActual);
    }
  }
  const total = [...byClient.values()].reduce((a, b) => a + b, 0);
  const entries: ClientMixEntry[] = [];
  for (const [cid, revenueT12] of byClient) {
    const client = clientById(data, cid);
    if (client) entries.push({ client, revenueT12, sharePct: total > 0 ? (revenueT12 / total) * 100 : 0 });
  }
  return entries.sort((a, b) => b.sharePct - a.sharePct);
}

// Worst-case (lowest-standing) current DRP tier across a store's carriers.
export function worstDrpTier(data: DataSet, storeId: string, month = data.currentMonth): DrpTier | null {
  const scs = data.scorecards.filter((s) => s.storeId === storeId && s.month === month);
  if (!scs.length) return null;
  let worst: DrpScorecard = scs[0];
  for (const s of scs) if (TIER_ORDER.indexOf(s.tier) > TIER_ORDER.indexOf(worst.tier)) worst = s;
  return worst.tier;
}

export function planForStore(data: DataSet, storeId: string): ActionPlan | undefined {
  return data.actionPlans.find((p) => p.storeId === storeId);
}

export interface ChallengedInfo {
  isChallenged: boolean;
  monthsChallenged: number; // months since firstFlagged (0 if not challenged)
  firstFlaggedMonth: string | null;
  recoveredRecently: boolean; // not challenged now, but was within the last 2 months
}
export function challengedInfo(data: DataSet, storeId: string): ChallengedInfo {
  const cur = data.currentMonth;
  const ev = evaluateStore(storeId, cur, data);
  if (ev.isChallenged) {
    return {
      isChallenged: true,
      monthsChallenged: ev.firstFlaggedMonth ? monthDiff(cur, ev.firstFlaggedMonth) + 1 : 1,
      firstFlaggedMonth: ev.firstFlaggedMonth,
      recoveredRecently: false,
    };
  }
  // recovered check
  const prev = data.months[data.months.length - 2];
  const wasPrev = prev ? evaluateStore(storeId, prev, data).isChallenged : false;
  return { isChallenged: false, monthsChallenged: 0, firstFlaggedMonth: null, recoveredRecently: wasPrev };
}

// Stores in scope for a role/user.
export function storesForScope(
  data: DataSet,
  scope: { type: 'all' } | { type: 'cpm'; cpmId: string } | { type: 'region'; regionId: string } | { type: 'store'; storeId: string },
): Store[] {
  switch (scope.type) {
    case 'all':
      return data.stores;
    case 'cpm':
      return storesForCpm(data, scope.cpmId);
    case 'region':
      return data.stores.filter((s) => s.regionId === scope.regionId);
    case 'store':
      return data.stores.filter((s) => s.id === scope.storeId);
  }
}

// Portfolio row - one per store, the list that replaces the tracker doc.
export interface PortfolioRow {
  store: Store;
  challenged: ChallengedInfo;
  t3RevenuePct: number | null;
  t3VolumePct: number | null;
  revenueSpark: number[]; // last 12 store revenue actuals
  clientMix: ClientMixEntry[];
  worstTier: DrpTier | null;
  plan: ActionPlan | undefined;
  nextStepDue: string | null;
  hasOverdueStep: boolean;
}

export function portfolioRow(data: DataSet, store: Store): PortfolioRow {
  const challenged = challengedInfo(data, store.id);
  const plan = planForStore(data, store.id);
  const last12 = trailing(data.months, data.currentMonth, 12);
  const revenueSpark = last12.map((m) => storeMetricValue(data, store.id, 'revenueActual', m));
  let nextStepDue: string | null = null;
  let hasOverdueStep = false;
  if (plan) {
    const open = plan.steps.filter((s) => s.status !== 'Done').sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1));
    nextStepDue = open[0]?.dueOn ?? null;
    hasOverdueStep = plan.steps.some((s) => s.status !== 'Done' && s.dueOn < `${data.currentMonth}-01`);
  }
  return {
    store,
    challenged,
    t3RevenuePct: trailingRevenuePctOfPlan(data, store.id, 3),
    t3VolumePct: trailingVolumePctOfForecast(data, store.id, 3),
    revenueSpark,
    clientMix: storeClientMix(data, store.id),
    worstTier: worstDrpTier(data, store.id),
    plan,
    nextStepDue,
    hasOverdueStep,
  };
}
