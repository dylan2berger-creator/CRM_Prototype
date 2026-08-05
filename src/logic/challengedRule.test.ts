import { describe, expect, it } from 'vitest';
import { evaluateStore, RULE_VERSION, THRESHOLDS } from './challengedRule';
import {
  Cbsa,
  Client,
  DataSet,
  DrpScorecard,
  DrpTier,
  MetricPeriod,
  Region,
  Store,
} from '@/types';
import { monthsEndingAt } from '@/utils/dates';

// Minimal hand-built dataset so the rule is tested in isolation from the
// generator. One store, one or two clients, controllable revenue/tier/capture.

const MONTHS = monthsEndingAt('2026-06', 24);
const CUR = MONTHS[MONTHS.length - 1];

function baseStore(): Store {
  return {
    id: 'S-0001',
    name: 'Boyd Collision - Testville',
    brand: 'Boyd',
    regionId: 'R-01',
    cbsaId: 'CBSA-01',
    gmName: 'Test GM',
    cpmId: 'U-001',
    assignedOn: '2024-01-01',
    previousCpmId: '',
    openedOn: '2015-01-01',
    acquiredOn: null,
  };
}

interface Opts {
  actualPctOfPlan?: number; // uniform actual/plan ratio across all months
  recentPctOfPlan?: number; // override for the last 3 months
  captureRate?: number; // uniform capture rate
  recentCapture?: number; // override last 2 months
  tier?: DrpTier; // scorecard tier on the dominant client at CUR
  volumePctOfForecast?: number; // dominant-client DRP volume vs forecast at CUR
}

function buildData(opts: Opts): DataSet {
  const store = baseStore();
  const region: Region = { id: 'R-01', name: 'Test Region', rvpName: 'RVP' };
  const cbsa: Cbsa = { id: 'CBSA-01', name: 'Testville', state: 'IL' };
  const clients: Client[] = [{ id: 'C-01', name: 'Test Carrier', isDrp: true }];
  const metrics: MetricPeriod[] = [];
  MONTHS.forEach((month, i) => {
    const isRecent3 = i >= MONTHS.length - 3;
    const isRecent2 = i >= MONTHS.length - 2;
    const ratio = (isRecent3 && opts.recentPctOfPlan != null ? opts.recentPctOfPlan : opts.actualPctOfPlan ?? 100) / 100;
    const cap = isRecent2 && opts.recentCapture != null ? opts.recentCapture : opts.captureRate ?? 75;
    const plan = 100_000;
    metrics.push({
      storeId: store.id,
      clientId: 'C-01',
      month,
      revenueActual: plan * ratio,
      revenuePlan: plan,
      roCount: 30,
      averageRo: 3300,
      cycleTimeDays: 8,
      captureRatePct: cap,
      estimateAccuracyPct: 95,
      internalRulesAdherencePct: 96,
      externalRulesAdherencePct: 96,
      centralReviewPassPct: 94,
      qualityRecAcceptedPct: 90,
      supplementsPerRo: 1.2,
      supplementRatePct: 28,
      rentalDays: 9,
      totalCostOfRepair: 3600,
    });
  });

  const scorecards: DrpScorecard[] = opts.tier
    ? [
        {
          storeId: store.id,
          clientId: 'C-01',
          month: CUR,
          score: opts.tier === 'At risk' ? 55 : opts.tier === 'Watch' ? 65 : 80,
          rankInCbsa: 3,
          competitorsInCbsa: 8,
          tier: opts.tier,
          drivers: [],
        },
      ]
    : [];

  const carrierVolumes =
    opts.volumePctOfForecast != null
      ? [
          {
            clientId: 'C-01',
            storeId: store.id,
            month: CUR,
            assignmentActual: opts.volumePctOfForecast,
            assignmentForecast: 100,
            isAnomaly: false,
            anomalyNote: null,
          },
        ]
      : [];

  return {
    months: MONTHS,
    currentMonth: CUR,
    regions: [region],
    cbsas: [cbsa],
    clients,
    stores: [store],
    cpms: [{ id: 'U-001', name: 'CPM', role: 'cpm' }],
    metrics,
    businessCases: [],
    scorecards,
    carrierVolumes,
    cbsaMarkets: [],
    salesActivities: [],
    actionPlans: [],
    alerts: [],
    freshness: [],
  };
}

describe('evaluateStore', () => {
  it('exposes the rule version', () => {
    expect(RULE_VERSION).toBe('v2.1');
    expect(evaluateStore('S-0001', CUR, buildData({})).ruleVersion).toBe('v2.1');
  });

  it('does not flag a healthy store', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 101 }));
    expect(ev.isChallenged).toBe(false);
    expect(ev.reasons).toHaveLength(0);
    expect(ev.firstFlaggedMonth).toBeNull();
  });

  it('flags on T3 revenue below 90% of plan', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 100, recentPctOfPlan: 82 }));
    expect(ev.isChallenged).toBe(true);
    const r = ev.reasons.find((x) => x.metric === 'revenueVsPlan');
    expect(r).toBeTruthy();
    expect(r!.threshold).toBe(THRESHOLDS.t3RevenuePctOfPlan);
    expect(r!.actual).toBeLessThan(90);
  });

  it('flags on T12 revenue below 95% of plan even when T3 is fine', () => {
    // Every month at 93% => T3 also < 90, so isolate: recent 3 at 100, rest low.
    const data = buildData({ actualPctOfPlan: 92, recentPctOfPlan: 99 });
    const ev = evaluateStore('S-0001', CUR, data);
    expect(ev.isChallenged).toBe(true);
    expect(ev.reasons.some((r) => r.label.includes('T12'))).toBe(true);
  });

  it('flags on a Watch DRP tier for a material client', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 101, tier: 'Watch' }));
    expect(ev.isChallenged).toBe(true);
    expect(ev.reasons.some((r) => r.metric === 'drpTier')).toBe(true);
  });

  it('does not flag a Standard DRP tier', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 101, tier: 'Standard' }));
    expect(ev.isChallenged).toBe(false);
  });

  it('flags on DRP volume below 90% of forecast for a material client', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 101, volumePctOfForecast: 80 }));
    expect(ev.isChallenged).toBe(true);
    expect(ev.reasons.some((r) => r.metric === 'drpVolumeVsForecast')).toBe(true);
  });

  it('does not flag DRP volume at 95% of forecast', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 101, volumePctOfForecast: 95 }));
    expect(ev.isChallenged).toBe(false);
  });

  it('flags on capture rate below 60% for two consecutive months', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 101, captureRate: 75, recentCapture: 55 }));
    expect(ev.isChallenged).toBe(true);
    expect(ev.reasons.some((r) => r.metric === 'captureRate')).toBe(true);
  });

  it('records every reason that fires', () => {
    const ev = evaluateStore(
      'S-0001',
      CUR,
      buildData({ actualPctOfPlan: 100, recentPctOfPlan: 80, tier: 'At risk', volumePctOfForecast: 70 }),
    );
    const metrics = ev.reasons.map((r) => r.metric);
    expect(metrics).toContain('revenueVsPlan');
    expect(metrics).toContain('drpTier');
    expect(metrics).toContain('drpVolumeVsForecast');
  });

  it('computes a first-flagged month at or before the evaluated month', () => {
    const ev = evaluateStore('S-0001', CUR, buildData({ actualPctOfPlan: 80 }));
    expect(ev.isChallenged).toBe(true);
    expect(ev.firstFlaggedMonth).toBeTruthy();
    expect(MONTHS.indexOf(ev.firstFlaggedMonth!)).toBeLessThanOrEqual(MONTHS.indexOf(CUR));
  });
});
