// Seeded, deterministic mock-data generator for Rebound (shop performance recovery).
//
// Everything derives from SEED so screenshots reproduce across reloads and
// machines. The generator's job is not just volume but *shape*: it plants the
// specific patterns the demo has to be able to find (see the "Mock data rules"
// in the spec) and records them under `landmarks` so the README and tests can
// point at them.
//
// Data is generated raw here; the real challenged-store rule
// (src/logic/challengedRule.ts) is then run over it to decide which stores are
// challenged, so "challenged" has a single definition. Plans and alerts are
// seeded from that computed set.

import {
  ActionPlan,
  ActionStep,
  Alert,
  BusinessCase,
  CarrierVolume,
  Cbsa,
  CbsaMarket,
  Client,
  DataFreshness,
  DataSet,
  DrpScorecard,
  DrpTier,
  MetricPeriod,
  Region,
  Risk,
  SalesActivity,
  SalesAsk,
  ScorecardDriver,
  Store,
  TargetMetric,
  TaskType,
} from '@/types';
import { evaluateStore } from '@/logic/challengedRule';
import {
  addMonths,
  currentMonth,
  dayInMonthIso,
  isoDate,
  monthDiff,
  monthsEndingAt,
  monthStartIso,
} from '@/utils/dates';
import {
  CITIES,
  CLIENT_NAMES,
  DIVISIONS,
  FIRST_NAMES,
  LAST_NAMES,
  REGIONS,
} from '@/mock/names';
import { makeRng, pick, rfloat, rint, Rng, shuffle } from '@/seed';
import { SEED } from '@/seed';

const HISTORY_MONTHS = 36;
const STORE_COUNT = 345;
const BOYD_COUNT = 205; // remaining 140 are JHCC (205 + 140 = 345)
const REGION_COUNT = 12;
const CBSA_COUNT = 60;
const CLIENT_COUNT = 14;
const DRP_COUNT = 9;

type Archetype = 'healthy' | 'newly' | 'chronic' | 'recovered';
type Cause =
  | 'none'
  | 'estimate'
  | 'rules-internal'
  | 'rules-external'
  | 'market'
  | 'volume-drp'
  | 'mixed';
type PlanHealth = 'none' | 'healthy' | 'overdue' | 'monitoring-up' | 'monitoring-down';

interface StoreProfile {
  archetype: Archetype;
  cause: Cause;
  divergeIdx: number; // month index where actual breaks from plan
  turnIdx: number; // month index of recovery/decline inflection (-1 if none)
  turnDir: 'up' | 'down' | 'none';
  depth: number; // worst factor reached (e.g. 0.82)
  flagVia: 'revenue' | 'capture' | 'tier' | 'volume';
  drpShort: boolean; // DRP assignment volume falls short of forecast
  revenueOkDrpShort: boolean; // hits revenue forecast but DRP volume short
  drpOkRevenueShort: boolean; // hits DRP volume but revenue short
  marketShrinking: boolean | null;
  baselineGap: boolean; // annualRoPlan not loaded
  planHealth: PlanHealth;
  clientIds: string[];
  clientShares: number[]; // parallel to clientIds, sums to 1
  seasonAmp: number;
  slope: number;
  baseAnnualRevenue: number;
  averageRo: number;
}

export interface Landmarks {
  primaryCpmId: string;
  gmStoreId: string;
  challengedNoPlan: string;
  estimateCause: string;
  rulesInternalWeak: string; // strong internal, weak external
  rulesExternalWeak: string; // weak internal, strong external
  marketCauseShrinking: string; // failing in a shrinking market
  executionCauseGrowing: string; // failing in a growing market
  revenueOkDrpShort: string;
  drpOkRevenueShort: string;
  anomalyStoreId: string;
  anomalyClientId: string;
  twoCarrierDisagreeStoreId: string;
  underforecastClientId: string; // one carrier under forecast across many stores
  underperformingRegionId: string; // one region under across many carriers
  jhccBaselineGap: string;
  interventionWorkedStoreId: string;
  interventionFailedStoreId: string;
}

export interface GeneratedData extends DataSet {
  landmarks: Landmarks;
}

const SCORECARD_DRIVERS = [
  'Cycle time',
  'Estimate accuracy',
  'Repair quality',
  'Customer satisfaction',
  'DRP rules adherence',
  'Cost control',
] as const;

// Per-carrier weighting of scorecard drivers (percent, sums ~100). Different
// carriers weight different things, so the same store gets different advice.
const CARRIER_WEIGHTS: Record<number, number[]> = {
  // index by DRP client index 0..8; order matches SCORECARD_DRIVERS
  0: [30, 15, 15, 15, 15, 10], // cycle-time led
  1: [10, 30, 20, 10, 20, 10], // estimate-accuracy led
  2: [15, 10, 15, 30, 20, 10], // CSAT led
  3: [10, 20, 15, 10, 35, 10], // rules-adherence led
  4: [20, 15, 25, 15, 15, 10], // repair-quality led
  5: [15, 15, 10, 15, 15, 30], // cost-control led
  6: [25, 20, 15, 15, 15, 10],
  7: [12, 25, 18, 12, 23, 10],
  8: [18, 12, 22, 20, 18, 10],
};

function seasonal(month: string, amp: number): number {
  const m = Number(month.split('-')[1]);
  // Collision work peaks in winter; trough mid-summer.
  return amp * Math.cos((2 * Math.PI * (m - 1)) / 12);
}

// Deterministic per-series noise stream from a string key.
function hashStr(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function generate(): GeneratedData {
  const rng = makeRng(SEED);

  const months = monthsEndingAt(currentMonth(), HISTORY_MONTHS);
  const cur = months[months.length - 1];
  const curIdx = months.length - 1;

  // --- People ---------------------------------------------------------------
  const usedNames = new Set<string>();
  const personName = (): string => {
    for (let attempt = 0; attempt < 200; attempt++) {
      const n = `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
      if (!usedNames.has(n)) {
        usedNames.add(n);
        return n;
      }
    }
    return `${pick(rng, FIRST_NAMES)} ${pick(rng, LAST_NAMES)}`;
  };

  // --- Regions --------------------------------------------------------------
  const regions: Region[] = [];
  for (let i = 0; i < REGION_COUNT; i++) {
    regions.push({
      id: `R-${String(i + 1).padStart(2, '0')}`,
      name: REGIONS[i].name,
      rvpName: personName(),
      division: REGIONS[i].division,
    });
  }
  const underperformingRegionId = regions.find((r) => r.name === 'Gulf Region')!.id;

  // --- CBSAs ----------------------------------------------------------------
  const cbsas: Cbsa[] = [];
  for (let i = 0; i < CBSA_COUNT; i++) {
    const c = CITIES[i % CITIES.length];
    cbsas.push({ id: `CBSA-${String(i + 1).padStart(2, '0')}`, name: c.cbsa, state: c.state });
  }
  // Mark some CBSAs as structurally shrinking / growing for the market view.
  const shrinkingCbsas = new Set(cbsas.slice(0, 10).map((c) => c.id));
  const growingCbsas = new Set(cbsas.slice(10, 24).map((c) => c.id));

  // --- Clients --------------------------------------------------------------
  const clients: Client[] = [];
  for (let i = 0; i < CLIENT_COUNT; i++) {
    clients.push({ id: `C-${String(i + 1).padStart(2, '0')}`, name: CLIENT_NAMES[i], isDrp: i < DRP_COUNT });
  }
  const drpClients = clients.filter((c) => c.isDrp);
  const underforecastClientId = drpClients[2].id; // Progressive under forecast broadly

  // --- CPMs -----------------------------------------------------------------
  // A Client Performance Manager owns one DRP carrier within one division
  // (9 DRP carriers x 3 divisions = 27 slots). A few slots are left vacant so
  // the "percent of shops with an assigned CPM" metric has something to show.
  const cpms: DataSet['cpms'] = [];
  const cpmByCarrierDiv = new Map<string, string>(); // `${carrierId}|${division}` -> cpmId
  let cpmSeq = 0;
  for (const carrier of drpClients) {
    for (const division of DIVISIONS) {
      cpmSeq++;
      const key = `${carrier.id}|${division}`;
      const isPrimarySlot = carrier.id === drpClients[2].id && division === 'South Division';
      const vacant = !isPrimarySlot && hashStr('cpm' + key) % 9 === 0; // ~3 of 27 vacant
      if (vacant) continue;
      const id = `U-${String(cpmSeq).padStart(3, '0')}`;
      cpms.push({ id, name: personName(), role: 'cpm', carrierId: carrier.id, division });
      cpmByCarrierDiv.set(key, id);
    }
  }
  // The primary demo CPM owns Progressive in the South Division - a carrier that
  // runs under forecast broadly, in the division that carries the Gulf Region.
  const primaryCpmId = cpmByCarrierDiv.get(`${drpClients[2].id}|South Division`)!;

  // --- Stores + profiles ----------------------------------------------------
  const stores: Store[] = [];
  const profiles = new Map<string, StoreProfile>();

  // Decide which store indices are challenged and assign causes/archetypes.
  const idxs = Array.from({ length: STORE_COUNT }, (_, i) => i);
  const shuffledIdx = shuffle(rng, idxs);
  const challengedTarget = Math.round(STORE_COUNT * 0.18); // ~62
  const recoveredTarget = 10;
  const challengedSet = new Set(shuffledIdx.slice(0, challengedTarget));
  const recoveredSet = new Set(shuffledIdx.slice(challengedTarget, challengedTarget + recoveredTarget));

  // Landmark store indices - chosen from the challenged set so the demo
  // findings are guaranteed present. Take from the front of the challenged slice.
  const chArr = shuffledIdx.slice(0, challengedTarget);
  const L = {
    estimate: chArr[0],
    rulesInternalWeak: chArr[1],
    rulesExternalWeak: chArr[2],
    marketShrink: chArr[3],
    executionGrow: chArr[4],
    revenueOkDrpShort: chArr[5],
    drpOkRevenueShort: chArr[6],
    anomaly: chArr[7],
    twoCarrier: chArr[8],
    noPlan: chArr[9],
    worked: chArr[10],
    failed: chArr[11],
    jhccGap: -1, // set later among JHCC stores
    gm: -1,
  };

  // Cause assignment for the remaining challenged stores.
  const causeCycle: Cause[] = [
    'estimate', 'rules-internal', 'rules-external', 'market', 'volume-drp', 'mixed',
  ];

  const namesLeft = () => personName();

  for (let i = 0; i < STORE_COUNT; i++) {
    const brand: Store['brand'] = i < BOYD_COUNT ? 'Boyd' : 'JHCC';
    const region = regions[i % REGION_COUNT];
    const cbsa = cbsas[i % CBSA_COUNT];
    const id = `S-${String(i + 1).padStart(4, '0')}`;

    const openedYearsAgo = rint(rng, 2, 22);
    const openedOn = isoDate(
      new Date(Date.UTC(new Date().getUTCFullYear() - openedYearsAgo, rint(rng, 0, 11), rint(rng, 1, 28))),
    );
    const acquiredOn =
      brand === 'JHCC'
        ? monthStartIso(addMonths(cur, -rint(rng, 1, 30)))
        : null;

    // Client mix: 3-6 clients, DRP-weighted so most stores have a major DRP.
    const nClients = rint(rng, 3, 6);
    const clientPool = shuffle(rng, clients.slice());
    // ensure at least 2 DRP clients present
    const chosen: Client[] = [];
    for (const c of clientPool) {
      if (chosen.length >= nClients) break;
      chosen.push(c);
    }
    // Guarantee at least 2 distinct DRP clients without ever duplicating a
    // client (a store must never trade the same carrier twice).
    if (chosen.filter((c) => c.isDrp).length < 2) {
      const chosenIds = new Set(chosen.map((c) => c.id));
      for (const c of drpClients) {
        if (chosen.filter((x) => x.isDrp).length >= 2) break;
        if (chosenIds.has(c.id)) continue;
        // replace a non-DRP client if full, else append
        const nonDrpIdx = chosen.findIndex((x) => !x.isDrp);
        if (chosen.length >= nClients && nonDrpIdx >= 0) {
          chosenIds.delete(chosen[nonDrpIdx].id);
          chosen[nonDrpIdx] = c;
        } else if (chosen.length < nClients) {
          chosen.push(c);
        } else {
          break;
        }
        chosenIds.add(c.id);
      }
    }
    const clientIds = [...new Set(chosen.map((c) => c.id))]; // defensive de-dupe
    // Shares: one dominant client (>20% guaranteed) then the rest.
    const rawShares = clientIds.map(() => rfloat(rng, 0.5, 1));
    // Boost the first to be dominant.
    rawShares[0] *= 2.2;
    const shareSum = rawShares.reduce((a, b) => a + b, 0);
    const clientShares = rawShares.map((s) => s / shareSum);

    // CPM: a store's owner is the CPM for its dominant DRP carrier within the
    // store's division. Empty when that carrier x division slot is vacant.
    const division = region.division;
    let dominantDrp = '';
    let dominantShare = -1;
    for (let k = 0; k < clientIds.length; k++) {
      const cl = clients.find((c) => c.id === clientIds[k])!;
      if (cl.isDrp && clientShares[k] > dominantShare) {
        dominantShare = clientShares[k];
        dominantDrp = cl.id;
      }
    }
    const cpmId = dominantDrp ? cpmByCarrierDiv.get(`${dominantDrp}|${division}`) ?? '' : '';

    // Ownership history: when the current owner took the book and who held it
    // before. Turnover is common, so most stores carry a prior owner - the
    // continuity view exists so a handoff never loses the plan or reasoning.
    const assignedOn = monthStartIso(addMonths(cur, -rint(rng, 2, 34)));
    let previousCpmId = cpms.length && rint(rng, 1, 100) <= 60 ? cpms[hashStr('prev' + id) % cpms.length].id : '';
    if (previousCpmId === cpmId) previousCpmId = '';

    const isCh = challengedSet.has(i);
    const isRec = recoveredSet.has(i);

    let archetype: Archetype = 'healthy';
    let cause: Cause = 'none';
    let flagVia: StoreProfile['flagVia'] = 'revenue';
    let planHealth: PlanHealth = 'none';

    if (isCh) {
      // Newly vs chronic split.
      archetype = i % 5 === 0 ? 'newly' : 'chronic';
      cause = causeCycle[i % causeCycle.length];
    } else if (isRec) {
      archetype = 'recovered';
      cause = causeCycle[(i + 3) % causeCycle.length];
    }

    // Landmark-specific overrides.
    if (i === L.estimate) { archetype = 'chronic'; cause = 'estimate'; }
    if (i === L.rulesInternalWeak) { archetype = 'chronic'; cause = 'rules-external'; } // strong internal, weak external
    if (i === L.rulesExternalWeak) { archetype = 'chronic'; cause = 'rules-internal'; } // weak internal, strong external
    if (i === L.marketShrink) { archetype = 'chronic'; cause = 'market'; }
    if (i === L.executionGrow) { archetype = 'chronic'; cause = 'estimate'; }
    if (i === L.revenueOkDrpShort) { archetype = 'chronic'; cause = 'volume-drp'; flagVia = 'volume'; }
    if (i === L.drpOkRevenueShort) { archetype = 'chronic'; cause = 'market'; }
    if (i === L.twoCarrier) { archetype = 'chronic'; cause = 'mixed'; }

    // Flag mechanism variety for newly-flagged stores.
    if (archetype === 'newly') {
      const mech = i % 3;
      flagVia = mech === 0 ? 'capture' : mech === 1 ? 'tier' : 'revenue';
    }

    // Plan health - assigned later once we know challenged set precisely; seed
    // an intention here so ~60% of challenged get a plan with varied health.
    if (isCh) {
      const roll = i % 5;
      planHealth = roll === 0 ? 'none' : roll === 1 ? 'healthy' : roll === 2 ? 'overdue' : roll === 3 ? 'monitoring-up' : 'monitoring-down';
    }
    if (i === L.noPlan) planHealth = 'none';
    if (i === L.worked) { planHealth = 'monitoring-up'; }
    if (i === L.failed) { planHealth = 'monitoring-down'; }

    const divergeIdx =
      archetype === 'chronic'
        ? curIdx - rint(rng, 8, 16)
        : archetype === 'newly'
          ? curIdx - 2
          : archetype === 'recovered'
            ? curIdx - rint(rng, 15, 20) // older dip so it rolls out of the T12 window
            : 0;

    let turnIdx = -1;
    let turnDir: StoreProfile['turnDir'] = 'none';
    if (archetype === 'recovered') {
      turnIdx = curIdx - rint(rng, 8, 12); // recovered a while ago; T12 back above 95%
      turnDir = 'up';
    } else if (planHealth === 'monitoring-up') {
      turnIdx = curIdx - rint(rng, 4, 7);
      turnDir = 'up';
    } else if (planHealth === 'monitoring-down') {
      turnIdx = curIdx - rint(rng, 4, 6);
      turnDir = 'down';
    }

    // Recovered stores dip shallower so they cleanly clear the rule now.
    const depth =
      archetype === 'healthy' ? 1 : archetype === 'recovered' ? rfloat(rng, 0.9, 0.94) : rfloat(rng, 0.78, 0.87);

    // Market direction for the shop-vs-market view.
    let marketShrinking: boolean | null = null;
    if (cause === 'market') marketShrinking = true;
    if (i === L.executionGrow) marketShrinking = false;

    const drpShort = cause === 'volume-drp' || i === L.revenueOkDrpShort;
    const revenueOkDrpShort = i === L.revenueOkDrpShort;
    const drpOkRevenueShort = i === L.drpOkRevenueShort;

    const store: Store = {
      id,
      name: `${brand === 'Boyd' ? 'Boyd Collision' : 'JHCC Collision'} - ${CITIES[i % CITIES.length].city}`,
      brand,
      regionId: region.id,
      cbsaId: cbsa.id,
      gmName: namesLeft(),
      cpmId,
      assignedOn,
      previousCpmId,
      openedOn,
      acquiredOn,
    };

    stores.push(store);
    profiles.set(id, {
      archetype,
      cause,
      divergeIdx,
      turnIdx,
      turnDir,
      depth,
      flagVia,
      drpShort,
      revenueOkDrpShort,
      drpOkRevenueShort,
      marketShrinking,
      baselineGap: false,
      planHealth,
      clientIds,
      clientShares,
      seasonAmp: rfloat(rng, 0.03, 0.08),
      slope: rfloat(rng, -0.02, 0.05),
      baseAnnualRevenue: rfloat(rng, 2_400_000, 6_200_000),
      averageRo: rfloat(rng, 2_800, 4_200),
    });
  }

  // Region-wide underperformance: nudge many stores in the target region below
  // forecast - enough to show at the region-rollup level, but mostly ABOVE the
  // challenged threshold so it doesn't flag the whole region. The pattern is
  // meant to be *found on the analysis screen*, not to mass-flag stores.
  const regionStores = stores.filter((s) => s.regionId === underperformingRegionId);
  for (const s of regionStores.slice(0, Math.ceil(regionStores.length * 0.6))) {
    const p = profiles.get(s.id)!;
    if (p.archetype === 'healthy') {
      p.archetype = 'chronic';
      p.cause = 'mixed';
      p.divergeIdx = curIdx - rint(rng, 6, 12);
      // Mix of soft and hard: about a third dip below the flag (so Gulf Region
      // carries visibly more challenged stores), the rest just drag the rollup.
      p.depth = rfloat(rng, 0.87, 0.985);
    }
  }
  // And drag the region's DRP assignment volume harder than revenue, so the
  // "carrier within region" pivot shows the Gulf Region short across carriers.
  // (applied in the carrier-volume loop via underperformingRegionId)

  // JHCC baseline gap: pick 8-12 JHCC stores whose RO plan never loaded.
  const jhccStores = stores.filter((s) => s.brand === 'JHCC');
  const gapStores = shuffle(rng, jhccStores).slice(0, rint(rng, 8, 12));
  for (const s of gapStores) profiles.get(s.id)!.baselineGap = true;
  const jhccGapStore = gapStores[0];
  L.jhccGap = stores.indexOf(jhccGapStore);

  // Pick a GM-role landmark store (one the Shop GM role lands on): the estimate
  // landmark works well because it has a clear diagnosis.
  const gmStore = stores[L.estimate];
  L.gm = L.estimate;

  // --- Revenue factor per store per month -----------------------------------
  const revFactor = (p: StoreProfile, t: number, month: string): number => {
    let base = 1 + p.slope * ((t - curIdx) / HISTORY_MONTHS) * -1; // gentle drift
    base += seasonal(month, p.seasonAmp);
    if (p.archetype === 'chronic' && t >= p.divergeIdx) {
      const span = Math.max(1, curIdx - p.divergeIdx);
      const prog = Math.min(1, (t - p.divergeIdx) / span);
      base = base * (1 - (1 - p.depth) * prog);
      // recovery / further decline after the turn
      if (p.turnDir === 'up' && p.turnIdx >= 0 && t >= p.turnIdx) {
        const rspan = Math.max(1, curIdx - p.turnIdx);
        const rprog = Math.min(1, (t - p.turnIdx) / rspan);
        base += (0.9 - p.depth) * rprog * 0.9; // climbs back but not all the way
      }
      if (p.turnDir === 'down' && p.turnIdx >= 0 && t >= p.turnIdx) {
        const dspan = Math.max(1, curIdx - p.turnIdx);
        const dprog = Math.min(1, (t - p.turnIdx) / dspan);
        base -= 0.06 * dprog; // keeps sliding
      }
    } else if (p.archetype === 'newly' && t >= p.divergeIdx) {
      const prog = Math.min(1, (t - p.divergeIdx) / 2);
      // Revenue-flagged newly stores dip on revenue; others stay near plan.
      if (p.flagVia === 'revenue') base = base * (1 - (1 - p.depth) * prog);
    } else if (p.archetype === 'recovered') {
      if (t >= p.divergeIdx && t < p.turnIdx) {
        const span = Math.max(1, p.turnIdx - p.divergeIdx);
        const prog = Math.min(1, (t - p.divergeIdx) / span);
        base = base * (1 - (1 - p.depth) * prog);
      } else if (t >= p.turnIdx) {
        const rspan = Math.max(1, curIdx - p.turnIdx);
        const rprog = Math.min(1, (t - p.turnIdx) / rspan);
        base = base * (p.depth + (1.0 - p.depth) * rprog);
      }
    }
    // stores that hit revenue but miss DRP volume: keep revenue at/above plan
    if (p.drpOkRevenueShort) {
      // this store misses revenue but hits DRP - handled by leaving revenue low
    }
    if (p.revenueOkDrpShort) base = Math.max(base, 0.99);
    return base;
  };

  // --- Metrics fact table ---------------------------------------------------
  const metrics: MetricPeriod[] = [];
  for (const store of stores) {
    const p = profiles.get(store.id)!;
    const storePlanMonthly = p.baseAnnualRevenue / 12;
    const noiseRng = makeRng(SEED ^ hashStr(store.id));
    // per client-month noise
    for (let ci = 0; ci < p.clientIds.length; ci++) {
      const clientId = p.clientIds[ci];
      const share = p.clientShares[ci];
      const cNoise = makeRng(SEED ^ hashStr(store.id + clientId));
      for (let t = 0; t < months.length; t++) {
        const month = months[t];
        const factor = revFactor(p, t, month);
        const noise = 1 + (cNoise() - 0.5) * 0.06;
        const revenuePlan = storePlanMonthly * share;
        const revenueActual = revenuePlan * factor * noise;
        const averageRo = p.averageRo * (1 + (noiseRng() - 0.5) * 0.05);
        // volume tracks revenue except for market/volume causes where volume leads
        let volFactor = factor;
        if (p.cause === 'market' || p.cause === 'volume-drp') volFactor = factor * 0.98;
        const roCount = Math.max(4, Math.round((revenuePlan * volFactor) / averageRo));

        // Diagnostic metrics - healthy baseline, then push the cause's outlier.
        const healthy = {
          estimateAccuracyPct: rfloatN(cNoise, 92, 97),
          internalRulesAdherencePct: rfloatN(cNoise, 93, 98),
          externalRulesAdherencePct: rfloatN(cNoise, 92, 98),
          centralReviewPassPct: rfloatN(cNoise, 90, 97),
          qualityRecAcceptedPct: rfloatN(cNoise, 85, 95),
          supplementsPerRo: rfloatN(cNoise, 0.9, 1.6),
          supplementRatePct: rfloatN(cNoise, 22, 34),
          rentalDays: rfloatN(cNoise, 8, 12),
          totalCostOfRepair: rfloatN(cNoise, 3200, 4200),
          cycleTimeDays: rfloatN(cNoise, 6, 10),
          captureRatePct: rfloatN(cNoise, 62, 78),
        };

        const afterDiverge = t >= p.divergeIdx;
        const improving = p.turnDir === 'up' && p.turnIdx >= 0 && t >= p.turnIdx;
        // how strongly to express the outlier (fades after a successful turn)
        const sev = afterDiverge ? (improving ? 0.4 : 1) : 0;

        if (p.cause === 'estimate' && sev > 0) {
          healthy.estimateAccuracyPct -= 14 * sev;
          healthy.supplementRatePct += 22 * sev;
          healthy.supplementsPerRo += 1.4 * sev;
          healthy.totalCostOfRepair += 700 * sev;
        }
        if (p.cause === 'rules-internal' && sev > 0) {
          healthy.internalRulesAdherencePct -= 16 * sev;
          healthy.centralReviewPassPct -= 12 * sev;
        }
        if (p.cause === 'rules-external' && sev > 0) {
          // weak on the dominant carrier's external rules specifically
          if (ci === 0) healthy.externalRulesAdherencePct -= 18 * sev;
          healthy.qualityRecAcceptedPct -= 10 * sev;
        }
        if (p.cause === 'market' && sev > 0) {
          // operating metrics stay healthy; it's a volume/market problem
          healthy.captureRatePct -= 3 * sev;
        }
        if (p.cause === 'mixed' && sev > 0) {
          healthy.estimateAccuracyPct -= 7 * sev;
          healthy.externalRulesAdherencePct -= 8 * sev;
          healthy.rentalDays += 3 * sev;
        }
        // capture-rate flagged stores breach <60% for the last two months
        if (p.flagVia === 'capture' && t >= curIdx - 1) healthy.captureRatePct = rfloatN(cNoise, 52, 58);

        metrics.push({
          storeId: store.id,
          clientId,
          month,
          revenueActual: Math.round(revenueActual),
          revenuePlan: Math.round(revenuePlan),
          roCount,
          averageRo: Math.round(averageRo),
          cycleTimeDays: round1(healthy.cycleTimeDays),
          captureRatePct: round1(clamp(healthy.captureRatePct, 30, 95)),
          estimateAccuracyPct: round1(clamp(healthy.estimateAccuracyPct, 60, 99)),
          internalRulesAdherencePct: round1(clamp(healthy.internalRulesAdherencePct, 60, 99.5)),
          externalRulesAdherencePct: round1(clamp(healthy.externalRulesAdherencePct, 55, 99.5)),
          centralReviewPassPct: round1(clamp(healthy.centralReviewPassPct, 60, 99)),
          qualityRecAcceptedPct: round1(clamp(healthy.qualityRecAcceptedPct, 55, 99)),
          supplementsPerRo: round2(clamp(healthy.supplementsPerRo, 0.4, 4)),
          supplementRatePct: round1(clamp(healthy.supplementRatePct, 12, 72)),
          rentalDays: round1(clamp(healthy.rentalDays, 5, 22)),
          totalCostOfRepair: Math.round(clamp(healthy.totalCostOfRepair, 2400, 6500)),
        });
      }
    }
  }

  // --- Business cases -------------------------------------------------------
  const businessCases: BusinessCase[] = stores.map((store, i) => {
    const p = profiles.get(store.id)!;
    const source: BusinessCase['source'] = i % 3 === 0 ? 'Model workbook' : 'Investment committee memo';
    const docNum = 1000 + (i % 900);
    return {
      storeId: store.id,
      approvedOn: monthStartIso(addMonths(cur, -rint(rng, 12, 34))),
      annualRevenuePlan: Math.round(p.baseAnnualRevenue),
      annualRoPlan: p.baselineGap ? 0 : Math.round(p.baseAnnualRevenue / p.averageRo),
      source,
      loadedFrom:
        source === 'Model workbook' ? `Model_${store.id}.xlsx` : `IC-${2023 + (i % 3)}-${String(docNum).padStart(4, '0')}.pdf`,
    };
  });

  // --- DRP scorecards -------------------------------------------------------
  const scorecards: DrpScorecard[] = [];
  const tierFromScore = (s: number): DrpTier =>
    s >= 85 ? 'Preferred' : s >= 72 ? 'Standard' : s >= 60 ? 'Watch' : 'At risk';

  for (const store of stores) {
    const p = profiles.get(store.id)!;
    const storeMetricsByClientMonth = new Map<string, MetricPeriod>();
    for (const m of metrics) if (m.storeId === store.id) storeMetricsByClientMonth.set(m.clientId + m.month, m);

    for (let ci = 0; ci < p.clientIds.length; ci++) {
      const clientId = p.clientIds[ci];
      const client = clients.find((c) => c.id === clientId)!;
      if (!client.isDrp) continue;
      const drpIdx = drpClients.findIndex((c) => c.id === clientId);
      const weights = CARRIER_WEIGHTS[drpIdx] ?? CARRIER_WEIGHTS[0];
      const competitors = rint(rng, 6, 14);
      const sRng = makeRng(SEED ^ hashStr(store.id + clientId + 'sc'));

      for (let t = 0; t < months.length; t++) {
        const month = months[t];
        const mp = storeMetricsByClientMonth.get(clientId + month);
        if (!mp) continue;
        // driver values pulled from the store's real metrics where sensible
        const driverVals: Record<(typeof SCORECARD_DRIVERS)[number], number> = {
          'Cycle time': clamp(100 - (mp.cycleTimeDays - 6) * 6, 40, 98),
          'Estimate accuracy': mp.estimateAccuracyPct,
          'Repair quality': mp.qualityRecAcceptedPct,
          'Customer satisfaction': clamp(mp.captureRatePct + 20, 50, 98),
          'DRP rules adherence': mp.externalRulesAdherencePct,
          'Cost control': clamp(100 - (mp.totalCostOfRepair - 3200) / 40, 40, 98),
        };
        const drivers: ScorecardDriver[] = SCORECARD_DRIVERS.map((name, k) => ({
          name,
          weightPct: weights[k],
          storeValue: round1(driverVals[name]),
          carrierTarget: round1(clamp(driverVals[name] + rfloat(sRng, 2, 9), 60, 99)),
        }));
        let score = drivers.reduce((acc, d) => acc + (d.weightPct / 100) * d.storeValue, 0);
        score = clamp(score + (sRng() - 0.5) * 3, 20, 99);
        let tier = tierFromScore(score);
        // tier-flagged stores: force Watch/At risk on the dominant carrier now
        if (p.flagVia === 'tier' && ci === 0 && t >= curIdx - 2) {
          score = Math.min(score, rfloat(sRng, 52, 63));
          tier = tierFromScore(score);
        }
        const rankInCbsa = Math.max(1, Math.round((1 - score / 100) * competitors) + 1);
        scorecards.push({
          storeId: store.id,
          clientId,
          month,
          score: round1(score),
          rankInCbsa: Math.min(rankInCbsa, competitors),
          competitorsInCbsa: competitors,
          tier,
          drivers,
        });
      }
    }
  }

  // --- Carrier volumes ------------------------------------------------------
  const carrierVolumes: CarrierVolume[] = [];
  const anomalyRecords: { storeId: string; clientId: string; month: string }[] = [];
  let anomaliesSeeded = 0;
  const anomalyStore = stores[L.anomaly];
  const anomalyClientId = profiles.get(anomalyStore.id)!.clientIds.find((cid) => clients.find((c) => c.id === cid)!.isDrp)!;

  for (const store of stores) {
    const p = profiles.get(store.id)!;
    const vRngBase = makeRng(SEED ^ hashStr(store.id + 'vol'));
    const baseAssign = rint(rng, 40, 140);
    for (let ci = 0; ci < p.clientIds.length; ci++) {
      const clientId = p.clientIds[ci];
      const client = clients.find((c) => c.id === clientId)!;
      if (!client.isDrp) continue;
      const vRng = makeRng(SEED ^ hashStr(store.id + clientId + 'v'));
      const clientBase = baseAssign * p.clientShares[ci] * 2.4;
      for (let t = 0; t < months.length; t++) {
        const month = months[t];
        // forecast has its own shape: seasonal + slope, independent of revenue
        const fSeason = 1 + seasonal(month, 0.05);
        const fSlope = 1 + (t - curIdx) * -0.001;
        const assignmentForecast = Math.max(3, Math.round(clientBase * fSeason * fSlope));
        let vol = 1 + (vRng() - 0.5) * 0.08;
        // store-level DRP shortfall
        if (p.drpShort && ci === 0 && t >= p.divergeIdx) vol *= rfloat(vRng, 0.72, 0.85);
        // store hits revenue but misses DRP volume
        if (p.revenueOkDrpShort && ci === 0 && t >= curIdx - 6) vol *= 0.8;
        // store hits DRP but misses revenue - keep volume near/over forecast
        if (p.drpOkRevenueShort && ci === 0) vol = Math.max(vol, 1.02);
        // carrier under forecast across many stores - soft, so the carrier
        // rollup reads under forecast without flagging every store on volume.
        if (clientId === underforecastClientId && t >= curIdx - 9) vol *= rfloat(vRng, 0.93, 0.98);
        // region-wide underperformance drags volume across carriers so the
        // carrier-in-region pivot shows the Gulf Region short of forecast broadly
        if (store.regionId === underperformingRegionId && t >= curIdx - 8) vol *= rfloat(vRng, 0.86, 0.94);

        let assignmentActual = Math.max(0, Math.round(assignmentForecast * vol));
        let isAnomaly = false;
        let anomalyNote: string | null = null;

        // Seed a sharp single-carrier drop at the anomaly store.
        if (store.id === anomalyStore.id && clientId === anomalyClientId && t === curIdx - 1) {
          assignmentActual = Math.round(assignmentForecast * 0.35);
          isAnomaly = true;
          anomalyNote = `Assignments from ${client.name} fell 65% month-over-month while other carriers at this store held steady.`;
          anomalyRecords.push({ storeId: store.id, clientId, month });
          anomaliesSeeded++;
        }
        // A few more scattered anomalies.
        else if (anomaliesSeeded < 7 && ci === 0 && t === curIdx - rint(vRngBase, 1, 4) && vRngBase() < 0.02) {
          assignmentActual = Math.round(assignmentForecast * 0.4);
          isAnomaly = true;
          anomalyNote = `Sharp assignment drop from ${client.name}; other carriers at this store unchanged.`;
          anomalyRecords.push({ storeId: store.id, clientId, month });
          anomaliesSeeded++;
        }

        carrierVolumes.push({
          clientId,
          storeId: store.id,
          month,
          assignmentActual,
          assignmentForecast,
          isAnomaly,
          anomalyNote,
        });
      }
    }
  }
  // Guarantee at least 5 anomalies.
  if (anomaliesSeeded < 5) {
    let need = 5 - anomaliesSeeded;
    for (const cv of carrierVolumes) {
      if (need <= 0) break;
      if (cv.month === months[curIdx - 2] && !cv.isAnomaly && cv.assignmentForecast > 20) {
        cv.assignmentActual = Math.round(cv.assignmentForecast * 0.38);
        cv.isAnomaly = true;
        const cl = clients.find((c) => c.id === cv.clientId)!;
        cv.anomalyNote = `Sharp assignment drop from ${cl.name}; other carriers at this store unchanged.`;
        anomalyRecords.push({ storeId: cv.storeId, clientId: cv.clientId, month: cv.month });
        need--;
      }
    }
  }

  // --- CBSA market (PIF + Boyd share) ---------------------------------------
  const cbsaMarkets: CbsaMarket[] = [];
  for (const cbsa of cbsas) {
    const repClient = drpClients[hashStr(cbsa.id) % drpClients.length];
    const basePif = rint(rng, 8_000, 42_000);
    const baseShare = rfloat(rng, 6, 22);
    const shrinking = shrinkingCbsas.has(cbsa.id);
    const growing = growingCbsas.has(cbsa.id);
    const mRng = makeRng(SEED ^ hashStr(cbsa.id + 'mkt'));
    for (let t = 0; t < months.length; t++) {
      const month = months[t];
      const drift = shrinking ? (t - curIdx) * 0.004 * -1 : growing ? (t - curIdx) * 0.004 : 0;
      // drift is relative to current; shrinking => past higher, now lower
      const trend = shrinking ? 1 + (curIdx - t) * 0.006 : growing ? 1 - (curIdx - t) * 0.006 : 1;
      const pifCount = Math.round(basePif * trend * (1 + (mRng() - 0.5) * 0.03));
      const boydSharePct = round1(clamp(baseShare * (1 + drift) * (1 + (mRng() - 0.5) * 0.04), 2, 40));
      cbsaMarkets.push({ cbsaId: cbsa.id, clientId: repClient.id, month, pifCount, boydSharePct });
    }
  }

  // --- Run the real challenged rule over history ----------------------------
  // Build a partial dataset the rule can read.
  const partial: DataSet = {
    months, currentMonth: cur, regions, cbsas, clients, stores, cpms, metrics,
    businessCases, scorecards, carrierVolumes, cbsaMarkets,
    salesActivities: [], actionPlans: [], alerts: [], freshness: [],
  };

  const firstFlagged = new Map<string, string | null>();
  const challengedNow = new Set<string>();
  const monthsChallenged = new Map<string, number>();
  for (const store of stores) {
    let first: string | null = null;
    let consecutive = 0;
    for (const month of months) {
      const ev = evaluateStore(store.id, month, partial);
      if (ev.isChallenged) {
        if (!first) first = month;
        consecutive++;
      } else {
        consecutive = 0;
        first = null; // reset run; firstFlagged is start of the current unbroken run
      }
    }
    const curEv = evaluateStore(store.id, cur, partial);
    if (curEv.isChallenged) {
      challengedNow.add(store.id);
      monthsChallenged.set(store.id, consecutive);
    }
    firstFlagged.set(store.id, first);
  }

  // --- Sales activities (historical, read-only) -----------------------------
  const salesActivities: SalesActivity[] = [];
  const actTypes: SalesActivity['type'][] = ['Call', 'Visit', 'Carrier meeting', 'Email'];
  const actSummaries = [
    'Reviewed quarterly assignment trend and flagged the cycle-time gap.',
    'Site visit; walked the estimating desk on supplement discipline.',
    'Carrier meeting on scorecard drivers and rules adherence.',
    'Follow-up on parts procurement delays affecting cycle time.',
    'Discussed capture-rate slippage and front-office scheduling.',
    'Quarterly business review with the carrier account team.',
  ];
  for (const store of stores) {
    const p = profiles.get(store.id)!;
    const n = challengedNow.has(store.id) ? rint(rng, 4, 8) : rint(rng, 0, 3);
    for (let k = 0; k < n; k++) {
      const clientId = pick(rng, p.clientIds);
      salesActivities.push({
        id: `SA-${store.id}-${k}`,
        storeId: store.id,
        clientId,
        occurredOn: dayInMonthIso(months[curIdx - rint(rng, 0, 14)], rint(rng, 1, 28)),
        type: pick(rng, actTypes),
        summary: pick(rng, actSummaries),
        by: pick(rng, cpms).name,
      });
    }
    salesActivities.sort((a, b) => (a.occurredOn < b.occurredOn ? 1 : -1));
  }

  // --- Action plans ---------------------------------------------------------
  const actionPlans: ActionPlan[] = [];
  const namePool = cpms.map((c) => c.name);
  const namTags = [personName(), personName(), personName()]; // National Account Managers

  // Assign plans against the ACTUAL computed challenged set so coverage lands
  // near 60%. Landmark stores keep their forced health (no-plan / worked /
  // failed); everyone else is decided deterministically by store id.
  const forcedNoPlan = new Set([stores[L.noPlan].id]);
  const forcedHealth = new Map<string, PlanHealth>([
    [stores[L.worked].id, 'monitoring-up'],
    [stores[L.failed].id, 'monitoring-down'],
  ]);
  const healthOptions: PlanHealth[] = ['healthy', 'overdue', 'monitoring-up', 'monitoring-down'];
  const challengedList = stores.filter((s) => challengedNow.has(s.id));
  for (const store of challengedList) {
    const p = profiles.get(store.id)!;
    const h = hashStr(store.id);
    if (forcedNoPlan.has(store.id)) {
      p.planHealth = 'none';
    } else if (forcedHealth.has(store.id)) {
      p.planHealth = forcedHealth.get(store.id)!;
    } else if (h % 100 < 60) {
      p.planHealth = healthOptions[h % healthOptions.length];
    } else {
      p.planHealth = 'none'; // the "no plan yet" case (~40%)
    }
    if (p.planHealth === 'none') continue;
    actionPlans.push(buildPlan(store, p, {
      rng, cur, curIdx, months, cpms: namePool, namTags, clients, firstFlagged, monthsChallenged,
    }));
  }
  // A few plans on recovered / no-longer-challenged stores too, in Monitoring -
  // this is the "metric turned up after the action date" case.
  for (const store of stores.filter((s) => recoveredSet.has(stores.indexOf(s)) && !challengedNow.has(s.id))) {
    const p = profiles.get(store.id)!;
    if (hashStr(store.id) % 2 === 0) {
      p.planHealth = 'monitoring-up';
      actionPlans.push(buildPlan(store, p, {
        rng, cur, curIdx, months, cpms: namePool, namTags, clients, firstFlagged, monthsChallenged,
        forceStatus: 'Monitoring',
      }));
    }
  }

  // --- Alerts ---------------------------------------------------------------
  const alerts: Alert[] = [];
  let alertN = 0;
  const newAlert = (a: Omit<Alert, 'id' | 'acknowledged'> & { acknowledged?: boolean }) => {
    alerts.push({ id: `AL-${String(++alertN).padStart(4, '0')}`, acknowledged: a.acknowledged ?? false, ...a });
  };
  for (const store of stores) {
    const ff = firstFlagged.get(store.id);
    if (ff && monthDiff(cur, ff) <= 1 && challengedNow.has(store.id)) {
      const ev = evaluateStore(store.id, cur, partial);
      const r = ev.reasons[0];
      newAlert({
        storeId: store.id,
        raisedOn: dayInMonthIso(cur, 2),
        kind: 'New flag',
        message: `${store.name} newly flagged as challenged. ${r ? r.label : ''} (rule ${ev.ruleVersion}).`,
      });
    }
  }
  // Slippage + overdue from plans.
  for (const plan of actionPlans) {
    const store = stores.find((s) => s.id === plan.storeId)!;
    if (profiles.get(store.id)!.planHealth === 'monitoring-down') {
      newAlert({
        storeId: store.id,
        raisedOn: dayInMonthIso(cur, 6),
        kind: 'Slippage',
        message: `${store.name} revenue is still sliding after plan actions; T3 revenue down a further 4.1% vs the month the plan started.`,
      });
    }
    for (const step of plan.steps) {
      if (step.status !== 'Done' && step.dueOn < monthStartIso(cur)) {
        newAlert({
          storeId: store.id,
          raisedOn: dayInMonthIso(cur, 4),
          kind: 'Overdue step',
          message: `Step "${step.title}" was due ${step.dueOn} and is ${step.status}.`,
        });
        break;
      }
    }
  }
  // Tier drops.
  for (const store of stores) {
    if (profiles.get(store.id)!.flagVia === 'tier' && challengedNow.has(store.id)) {
      newAlert({
        storeId: store.id,
        raisedOn: dayInMonthIso(cur, 3),
        kind: 'DRP tier drop',
        message: `${store.name} dropped to Watch on its dominant carrier's DRP scorecard this month.`,
      });
    }
  }
  // Carrier volume + scorecard anomalies.
  for (const rec of anomalyRecords) {
    const store = stores.find((s) => s.id === rec.storeId)!;
    const client = clients.find((c) => c.id === rec.clientId)!;
    newAlert({
      storeId: rec.storeId,
      clientId: rec.clientId,
      raisedOn: dayInMonthIso(rec.month, 12),
      kind: 'Carrier volume anomaly',
      message: `${client.name} assignments at ${store.name} dropped sharply in ${rec.month} while other carriers held steady.`,
    });
  }
  // A scorecard anomaly for the anomaly store.
  newAlert({
    storeId: anomalyStore.id,
    clientId: anomalyClientId,
    raisedOn: dayInMonthIso(cur, 5),
    kind: 'Scorecard anomaly',
    message: `${clients.find((c) => c.id === anomalyClientId)!.name} scorecard for ${anomalyStore.name} moved outside its 12-month range.`,
  });

  // --- Data freshness -------------------------------------------------------
  const nowIso = new Date().toISOString();
  const hoursAgo = (h: number) => new Date(Date.parse(nowIso) - h * 3600_000).toISOString();
  const freshness: DataFreshness[] = [
    { dataset: 'DOMO Exec Dashboard - Revenue', lastRefreshed: hoursAgo(6), certified: true },
    { dataset: 'BDAP - DRP Assignments', lastRefreshed: hoursAgo(9), certified: true },
    { dataset: 'CCCone - Repair Orders', lastRefreshed: hoursAgo(4), certified: true },
    { dataset: 'DOMO - DRP Scorecards', lastRefreshed: hoursAgo(27), certified: false },
    { dataset: 'BDAP - Estimate Accuracy', lastRefreshed: hoursAgo(30), certified: false },
    { dataset: 'DOMO - Rules Adherence', lastRefreshed: hoursAgo(12), certified: true },
    { dataset: 'Market - PIF & Boyd Share', lastRefreshed: hoursAgo(52), certified: false },
    { dataset: 'Business case baseline (IC memos & workbooks)', lastRefreshed: hoursAgo(720), certified: true },
  ];

  const landmarks: Landmarks = {
    primaryCpmId,
    gmStoreId: gmStore.id,
    challengedNoPlan: stores[L.noPlan].id,
    estimateCause: stores[L.estimate].id,
    rulesInternalWeak: stores[L.rulesInternalWeak].id,
    rulesExternalWeak: stores[L.rulesExternalWeak].id,
    marketCauseShrinking: stores[L.marketShrink].id,
    executionCauseGrowing: stores[L.executionGrow].id,
    revenueOkDrpShort: stores[L.revenueOkDrpShort].id,
    drpOkRevenueShort: stores[L.drpOkRevenueShort].id,
    anomalyStoreId: anomalyStore.id,
    anomalyClientId,
    twoCarrierDisagreeStoreId: stores[L.twoCarrier].id,
    underforecastClientId,
    underperformingRegionId,
    jhccBaselineGap: jhccGapStore.id,
    interventionWorkedStoreId: stores[L.worked].id,
    interventionFailedStoreId: stores[L.failed].id,
  };

  return {
    ...partial,
    salesActivities,
    actionPlans,
    alerts,
    freshness,
    landmarks,
  };
}

// --- helpers ----------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function rfloatN(rng: Rng, min: number, max: number): number {
  return rng() * (max - min) + min;
}

interface PlanCtx {
  rng: Rng;
  cur: string;
  curIdx: number;
  months: string[];
  cpms: string[];
  namTags: string[];
  clients: Client[];
  firstFlagged: Map<string, string | null>;
  monthsChallenged: Map<string, number>;
  forceStatus?: ActionPlan['status'];
}

// Task templates keyed by cause so the plan reads as a relevant response.
const TASK_LIBRARY: Record<Cause, { title: string; type: TaskType; metrics: TargetMetric[] }[]> = {
  estimate: [
    { title: 'Retrain estimators on photo/supplement discipline', type: 'Training', metrics: ['estimateAccuracyPct', 'supplementsPerRo'] },
    { title: 'Tighten central review rules on supplement thresholds', type: 'Central review rule change', metrics: ['supplementsPerRo', 'totalCostOfRepair'] },
    { title: 'Monitor estimate accuracy weekly', type: 'Metric monitoring', metrics: ['estimateAccuracyPct'] },
  ],
  'rules-internal': [
    { title: 'Update central review rule set to Boyd standard', type: 'Central review rule change', metrics: ['internalRulesAdherencePct', 'centralReviewPassPct'] },
    { title: 'Train front office on internal rules adherence', type: 'Training', metrics: ['internalRulesAdherencePct'] },
    { title: 'Monitor central review pass rate', type: 'Metric monitoring', metrics: ['centralReviewPassPct'] },
  ],
  'rules-external': [
    { title: 'Carrier compliance training on DRP rule pack', type: 'Training', metrics: ['externalRulesAdherencePct'] },
    { title: 'Reach out to carrier on rules interpretation', type: 'Carrier outreach', metrics: ['externalRulesAdherencePct', 'drpScore'] },
    { title: 'Monitor external rules adherence by carrier', type: 'Metric monitoring', metrics: ['externalRulesAdherencePct'] },
  ],
  market: [
    { title: 'Carrier outreach to lift DRP assignment volume', type: 'Carrier outreach', metrics: ['assignmentActual', 'revenueActual'] },
    { title: 'Staffing review to protect capture rate', type: 'Staffing', metrics: ['captureRatePct', 'roCount'] },
    { title: 'Monitor revenue and RO count vs plan', type: 'Metric monitoring', metrics: ['revenueActual', 'roCount'] },
  ],
  'volume-drp': [
    { title: 'Carrier outreach on assignment shortfall', type: 'Carrier outreach', metrics: ['assignmentActual'] },
    { title: 'Improve DRP scorecard drivers', type: 'Estimating process', metrics: ['drpScore', 'externalRulesAdherencePct'] },
    { title: 'Monitor assignment volume vs forecast', type: 'Metric monitoring', metrics: ['assignmentActual'] },
  ],
  mixed: [
    { title: 'Estimating process review', type: 'Estimating process', metrics: ['estimateAccuracyPct', 'totalCostOfRepair'] },
    { title: 'Parts procurement fix for cycle time', type: 'Parts or supply', metrics: ['rentalDays', 'totalCostOfRepair'] },
    { title: 'Carrier outreach on scorecard', type: 'Carrier outreach', metrics: ['drpScore', 'externalRulesAdherencePct'] },
  ],
  none: [
    { title: 'Monitor performance vs plan', type: 'Metric monitoring', metrics: ['revenueActual'] },
    { title: 'General staffing review', type: 'Staffing', metrics: ['captureRatePct'] },
  ],
};

function buildPlan(store: Store, p: StoreProfile, ctx: PlanCtx): ActionPlan {
  const { rng, curIdx, months, cpms, namTags, clients, forceStatus } = ctx;
  const createdIdx = curIdx - rint(rng, 3, 8);
  const createdOn = dayInMonthIso(months[createdIdx], rint(rng, 1, 20));
  const templates = TASK_LIBRARY[p.cause] ?? TASK_LIBRARY.none;
  const dominantDrp = p.clientIds.find((cid) => clients.find((c) => c.id === cid)!.isDrp) ?? null;

  const steps: ActionStep[] = templates.map((tpl, k) => {
    // startedOn aligned to the store's turn so benchmarking has signal.
    const startIdx = p.turnIdx >= 0 ? p.turnIdx - 1 + k : createdIdx + k;
    const startedOn = k < 2 ? dayInMonthIso(months[clamp(startIdx, 0, curIdx)], 8) : null;
    let status: ActionStep['status'];
    if (p.planHealth === 'overdue') status = k === 0 ? 'In progress' : k === 1 ? 'Blocked' : 'Not started';
    else if (p.planHealth === 'healthy') status = k === 0 ? 'Done' : k === 1 ? 'In progress' : 'Not started';
    else status = k === 0 ? 'Done' : k === 1 ? 'In progress' : 'Not started';
    const dueIdx = p.planHealth === 'overdue' && k < 2 ? curIdx - 1 : curIdx + (k === 2 ? 1 : 0);
    const carrierSpecific = tpl.type === 'Carrier outreach' || tpl.metrics.includes('externalRulesAdherencePct');

    const tagged =
      tpl.type === 'Carrier outreach'
        ? [{ name: pick(rng, namTags), role: 'National Account Manager' as const, reason: `Ask ${clients.find((c) => c.id === dominantDrp)?.name ?? 'the carrier'} for an assignment review.` }]
        : [];

    return {
      id: `${store.id}-ST-${k + 1}`,
      title: tpl.title,
      type: tpl.type,
      targetMetrics: tpl.metrics,
      clientId: carrierSpecific ? dominantDrp : null,
      owner: pick(rng, cpms),
      ownerRole: k === 1 ? 'gm' : 'cpm',
      dueOn: dayInMonthIso(months[clamp(dueIdx, 0, curIdx + 1 < months.length ? curIdx + 1 : curIdx)], 15),
      startedOn,
      status,
      completedOn: status === 'Done' && startedOn ? dayInMonthIso(months[clamp((p.turnIdx >= 0 ? p.turnIdx : createdIdx) + 1, 0, curIdx)], 20) : null,
      note:
        p.planHealth === 'monitoring-down' && k === 0
          ? 'Completed, but the target metric has not responded - revisit approach.'
          : p.planHealth === 'overdue' && k === 1
            ? 'Blocked on carrier response.'
            : '',
      taggedPeople: tagged,
    };
  });

  const risks: Risk[] = [
    {
      id: `${store.id}-RK-1`,
      description:
        p.cause === 'market'
          ? 'Market volume decline may cap revenue recovery regardless of execution.'
          : 'Staff turnover at the estimating desk could stall the plan.',
      severity: p.planHealth === 'monitoring-down' ? 'High' : 'Medium',
      owner: pick(rng, cpms),
      mitigation: 'Weekly check-in and a backup owner named for each open step.',
    },
  ];

  const salesAsks: SalesAsk[] = dominantDrp
    ? [
        {
          id: `${store.id}-SK-1`,
          clientId: dominantDrp,
          request: `Request a carrier account review for ${store.name} to address the assignment shortfall.`,
          raisedOn: dayInMonthIso(months[createdIdx], 12),
          raisedBy: pick(rng, cpms),
          status: pick(rng, ['Open', 'Accepted', 'Contacted'] as SalesAsk['status'][]),
          outcome: null,
        },
      ]
    : [];

  const status: ActionPlan['status'] =
    forceStatus ??
    (p.planHealth === 'monitoring-up' || p.planHealth === 'monitoring-down'
      ? 'Monitoring'
      : 'Active');

  return {
    id: `AP-${store.id}`,
    storeId: store.id,
    createdOn,
    createdBy: pick(rng, cpms),
    status,
    summary: planSummary(p.cause, store.name),
    steps,
    risks,
    salesAsks,
  };
}

function planSummary(cause: Cause, storeName: string): string {
  switch (cause) {
    case 'estimate':
      return `${storeName} is missing plan on estimate accuracy and supplement discipline. Plan targets estimating process and central review rules.`;
    case 'rules-internal':
      return `${storeName} is off on internal (Boyd) rules adherence and central review. Plan targets rule set and training.`;
    case 'rules-external':
      return `${storeName} is compliant internally but weak on one carrier's DRP rules. Plan targets carrier compliance.`;
    case 'market':
      return `${storeName} shows healthy operating metrics but revenue and volume are down - likely a market/volume problem. Plan targets carrier volume and capture.`;
    case 'volume-drp':
      return `${storeName} is short of DRP assignment forecast on its dominant carrier. Plan targets scorecard drivers and carrier outreach.`;
    case 'mixed':
      return `${storeName} shows several diagnostic gaps. Plan targets estimating, parts, and carrier scorecard together.`;
    default:
      return `Recovery plan for ${storeName}.`;
  }
}
