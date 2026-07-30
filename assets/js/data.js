/* =============================================================================
   Challenged Shop Turnaround Tracker — Prototype mock data
   -----------------------------------------------------------------------------
   Everything here is synthetic and generated deterministically from a fixed
   seed so the prototype looks identical on every load. In the real build these
   records are READ from certified DOMO datasets (T12 / T3 actuals + dimensions)
   and the investment-committee business cases — the app never restates the
   warehouse, it reads it. See README for the data-foundation notes.
   ========================================================================== */

/* ---- deterministic PRNG (mulberry32) so the demo is reproducible ---------- */
function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260730);
const rand = (min, max) => min + rng() * (max - min);
const randi = (min, max) => Math.floor(rand(min, max + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const round = (n, d = 0) => { const f = 10 ** d; return Math.round(n * f) / f; };

/* ---- reference dimensions (would come from DOMO dim tables) --------------- */
const REGIONS = [
  { name: "Southeast", rvp: "Marcus Whitfield" },
  { name: "Great Lakes", rvp: "Dana Kowalski" },
  { name: "Southwest", rvp: "Priya Nair" },
  { name: "Northeast", rvp: "Tomás Herrera" },
  { name: "Pacific", rvp: "Alex Chen" },
  { name: "Mountain West", rvp: "Sydney Boone" },
];

const CPMS = [
  "Renee Ortiz", "Jamal Carter", "Beth Nakamura", "Devin Pierce",
  "Carla Mendez", "Ingrid Solberg", "Nate Delacroix", "Fatima Rahim",
];

const CITIES = {
  Southeast: [["Atlanta", "GA"], ["Charlotte", "NC"], ["Orlando", "FL"], ["Nashville", "TN"], ["Birmingham", "AL"], ["Tampa", "FL"], ["Raleigh", "NC"], ["Savannah", "GA"]],
  "Great Lakes": [["Chicago", "IL"], ["Detroit", "MI"], ["Cleveland", "OH"], ["Milwaukee", "WI"], ["Indianapolis", "IN"], ["Columbus", "OH"], ["Grand Rapids", "MI"]],
  Southwest: [["Dallas", "TX"], ["Houston", "TX"], ["Phoenix", "AZ"], ["Austin", "TX"], ["San Antonio", "TX"], ["Tucson", "AZ"], ["El Paso", "TX"]],
  Northeast: [["Boston", "MA"], ["Philadelphia", "PA"], ["Pittsburgh", "PA"], ["Newark", "NJ"], ["Hartford", "CT"], ["Providence", "RI"]],
  Pacific: [["Sacramento", "CA"], ["Fresno", "CA"], ["Portland", "OR"], ["Seattle", "WA"], ["San Jose", "CA"], ["Spokane", "WA"]],
  "Mountain West": [["Denver", "CO"], ["Salt Lake City", "UT"], ["Boise", "ID"], ["Albuquerque", "NM"], ["Colorado Springs", "CO"]],
};

/* Carriers run Direct Repair Programs (DRP). A store's biggest carriers drive
   its assignment volume; scorecard standing vs area competitors drives share. */
const CARRIERS = [
  "State Farm", "GEICO", "Progressive", "Allstate", "USAA",
  "Liberty Mutual", "Farmers", "Nationwide", "Travelers", "American Family",
];

const GM_FIRST = ["Rick", "Tina", "Omar", "Grace", "Luis", "Hannah", "Derek", "Mona", "Paul", "Aisha", "Cole", "Rosa", "Vince", "Kim", "Ray"];
const GM_LAST = ["Sanders", "Mbeki", "Okafor", "Larsen", "Vega", "Cho", "Bauer", "Ellis", "Nguyen", "Frost", "Ibarra", "Doyle", "Park", "Reyes", "Hale"];

const STREETS = ["Peachtree", "Main", "Industrial", "Commerce", "Gateway", "Lakeside", "Meridian", "Sunset", "Highland", "Riverbend"];

/* ---- month axis: trailing 15 months ending Jun 2026 ---------------------- */
const MONTHS = (() => {
  const out = [];
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let y = 2025, m = 3; // Apr 2025
  for (let i = 0; i < 15; i++) {
    out.push(`${names[m]} '${String(y).slice(2)}`);
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
})();
const ACTION_MONTH_INDEX = 9; // action plans generally start ~Jan '26

/* ---- rule versioning for the challenged definition (E3) ------------------- */
const RULE = {
  version: "v2.3",
  effective: "2026-04-01",
  author: "CPM Council",
  note: "Applies Boyd's existing challenged-store definition. Versioned so a definition change does not silently restate history.",
  criteria: [
    { key: "revT3", label: "T3 revenue ≥ 8% below business-case run-rate", threshold: -0.08 },
    { key: "revT12", label: "T12 revenue ≥ 5% below business case", threshold: -0.05 },
    { key: "drpRank", label: "Slipped ≥ 2 ranks on a top-3 DRP scorecard", threshold: 2 },
    { key: "cbsa", label: "CBSA share down ≥ 1.5 pts year-over-year", threshold: -1.5 },
  ],
};

/* ---- build one store ------------------------------------------------------ */
let SEQ = 100;
function buildStore(cohort) {
  const region = pick(REGIONS);
  const [city, state] = pick(CITIES[region.name]);
  SEQ += 1;
  const id = `${state}-${SEQ}`;
  const name = `Gerber Collision — ${city} ${pick(STREETS)}`;
  const gm = `${pick(GM_FIRST)} ${pick(GM_LAST)}`;
  const cpm = pick(CPMS);

  // Business case (investment committee memo) — the baseline the app measures to
  const bcMonthly = round(rand(180, 620) * 1000, -2);           // target monthly revenue
  const bcAnnual = bcMonthly * 12;
  const bcARO = round(rand(2900, 4200), 0);
  const bcCars = Math.round((bcMonthly / bcARO));
  const icYear = cohort === "JHCC" ? 2024 : pick([2023, 2024, 2024, 2025]);
  const memoRef = `IC-${icYear}-${randi(100, 999)}`;

  // Performance posture: most stores hold their case; a minority are under it.
  const posture = rng();
  // gapFactor < 1 means under business case
  let gapFactor;
  if (posture < 0.24) gapFactor = rand(0.80, 0.93);      // challenged band (~24%)
  else if (posture < 0.42) gapFactor = rand(0.95, 1.00); // watch band, mostly above the -5% line
  else gapFactor = rand(1.00, 1.13);                     // on/above plan (~58%)

  // monthly actuals with seasonality, noise, and a trend break at action month
  const actuals = [];
  const planLine = [];
  const recovering = gapFactor < 0.94 && rng() > 0.45; // did the plan bend the curve?
  for (let i = 0; i < MONTHS.length; i++) {
    const season = 1 + 0.06 * Math.sin((i / 12) * 2 * Math.PI);
    let f = gapFactor;
    if (i >= ACTION_MONTH_INDEX && recovering) {
      const lift = (i - ACTION_MONTH_INDEX) * rand(0.008, 0.02);
      f = Math.min(gapFactor + lift, 1.05);
    } else if (i >= ACTION_MONTH_INDEX && !recovering && gapFactor < 0.94) {
      const drop = (i - ACTION_MONTH_INDEX) * rand(0.002, 0.01);
      f = gapFactor - drop;
    }
    const noise = rand(0.96, 1.04);
    actuals.push(round(bcMonthly * f * season * noise, -2));
    planLine.push(round(bcMonthly * season, -2));
  }

  const t3 = actuals.slice(-3).reduce((a, b) => a + b, 0);
  const t3Plan = planLine.slice(-3).reduce((a, b) => a + b, 0);
  const t12 = actuals.slice(-12).reduce((a, b) => a + b, 0);
  const t12Plan = planLine.slice(-12).reduce((a, b) => a + b, 0);
  const aro = round(bcARO * rand(0.9, 1.05), 0);
  const carCount = Math.round(actuals.slice(-1)[0] / aro);

  const revT3Var = (t3 - t3Plan) / t3Plan;
  const revT12Var = (t12 - t12Plan) / t12Plan;

  // Deficiency detail (E4): revenue by client/DRP, PIF, CBSA
  const shuffledCarriers = [...CARRIERS].sort(() => rng() - 0.5).slice(0, randi(5, 7));
  let remaining = t12;
  const revByDRP = shuffledCarriers.map((c, idx) => {
    const share = idx === shuffledCarriers.length - 1 ? remaining : round(remaining * rand(0.18, 0.4), -2);
    remaining -= share;
    const yoy = round(rand(-0.22, 0.15), 3);
    return { carrier: c, revenue: Math.max(share, 0), yoy };
  }).sort((a, b) => b.revenue - a.revenue);

  const revByClient = revByDRP.map((d) => ({
    client: d.carrier,
    revenue: round(d.revenue * rand(0.85, 1.0), -2), // DRP + some non-DRP
    pif: randi(40, 260),
    aro: round(aro * rand(0.9, 1.12), 0),
  }));

  const pifCount = revByClient.reduce((a, b) => a + b.pif, 0);
  const pifPrior = Math.round(pifCount * rand(0.9, 1.18));
  const cbsaShare = round(rand(4.5, 16.5), 1);
  // ~11% of stores show a flag-worthy YoY CBSA-share drop; the rest drift a little.
  const cbsaDrop = rng() < 0.11 ? rand(1.5, 3.6) : rand(-1.2, 1.1);
  const cbsaPrior = round(cbsaShare + cbsaDrop, 1);

  // DRP scorecards vs area competitors (top carriers by revenue). Drops are rare
  // (~7% per scorecard) so carrier-standing is a real, not constant, flag reason.
  const drpScorecard = revByDRP.slice(0, randi(3, 4)).map((d) => {
    const totalComp = randi(6, 12);
    const rank = randi(1, totalComp);
    const gotWorse = rng() < 0.055;
    const move = gotWorse ? randi(2, 4) : randi(-2, 1);
    const prevRank = Math.max(1, Math.min(totalComp, rank - move)); // move>0 ⇒ dropped from a better rank
    return {
      carrier: d.carrier, rank, prevRank, totalComp,
      score: round(rand(72, 96), 1),
      metric: pick(["Cycle time", "CSI", "Estimate accuracy", "Touch time"]),
    };
  });

  // Evaluate the challenged rule (E3) — auditable, per-criterion
  const reasons = [];
  if (revT3Var <= RULE.criteria[0].threshold)
    reasons.push({ key: "revT3", label: RULE.criteria[0].label, detail: `T3 ${fmtPct(revT3Var)} vs case`, period: MONTHS.slice(-3).join("–") });
  if (revT12Var <= RULE.criteria[1].threshold)
    reasons.push({ key: "revT12", label: RULE.criteria[1].label, detail: `T12 ${fmtPct(revT12Var)} vs case`, period: "Trailing 12" });
  const worstDrp = drpScorecard.reduce((w, d) => (d.rank - d.prevRank) > (w ? w.rank - w.prevRank : -99) ? d : w, null);
  if (worstDrp && worstDrp.rank - worstDrp.prevRank >= RULE.criteria[2].threshold)
    reasons.push({ key: "drpRank", label: RULE.criteria[2].label, detail: `${worstDrp.carrier}: #${worstDrp.prevRank} → #${worstDrp.rank} of ${worstDrp.totalComp}`, period: "Current cycle" });
  if (cbsaShare - cbsaPrior <= RULE.criteria[3].threshold)
    reasons.push({ key: "cbsa", label: RULE.criteria[3].label, detail: `CBSA ${cbsaPrior}% → ${cbsaShare}% YoY`, period: "YoY" });

  const challenged = reasons.length > 0;

  // Action plan (E5) — only challenged stores carry an active plan (mostly)
  const OWNERS = [gm, cpm, "Sales — " + pick(GM_FIRST), region.rvp];
  const STEP_TEMPLATES = [
    "Rebuild DRP scorecard action items with carrier",
    "Weekend capacity add: 2 techs + 1 estimator",
    "Cycle-time blitz on supplement approvals",
    "Re-engage lapsed fleet/commercial accounts",
    "Local marketing push in CBSA gap zip codes",
    "Estimator retraining on estimate accuracy",
    "Parts procurement SLA renegotiation",
    "Assignment ratio review with top-2 carriers",
  ];
  let steps = [];
  if (challenged || rng() > 0.6) {
    const n = challenged ? randi(3, 6) : randi(1, 2);
    const used = new Set();
    for (let i = 0; i < n; i++) {
      let tmpl = pick(STEP_TEMPLATES);
      while (used.has(tmpl)) tmpl = pick(STEP_TEMPLATES);
      used.add(tmpl);
      const st = pick(["Not started", "In progress", "In progress", "Blocked", "Done"]);
      const dueOffset = randi(-25, 45);
      steps.push({
        title: tmpl,
        owner: pick(OWNERS),
        due: dayOffset(dueOffset),
        overdue: dueOffset < 0 && st !== "Done",
        status: st,
        risk: pick(["Low", "Low", "Medium", "Medium", "High"]),
      });
    }
  }
  const openSteps = steps.filter((s) => s.status !== "Done");
  const overdue = steps.filter((s) => s.overdue).length;
  let planHealth;
  if (!challenged && steps.length === 0) planHealth = "None";
  else if (overdue >= 2 || steps.some((s) => s.status === "Blocked" && s.risk === "High")) planHealth = "At risk";
  else if (overdue === 1 || openSteps.length > 3) planHealth = "Watch";
  else planHealth = "On track";

  // Sales asks (E5)
  const salesAsks = [];
  const nAsk = challenged ? randi(0, 2) : (rng() > 0.8 ? 1 : 0);
  for (let i = 0; i < nAsk; i++) {
    const client = pick(shuffledCarriers);
    salesAsks.push({
      client,
      ask: pick([
        `Escalate DRP assignment ratio with ${client}`,
        `Request tier review — ${client} scorecard improved`,
        `Reinstate ${client} program after cycle-time fix`,
        `Add ${client} fleet account to store`,
      ]),
      owner: "Sales — " + pick(GM_FIRST),
      status: pick(["Open", "Open", "Routed to Sales", "In progress", "Closed — won", "Closed — no change"]),
      raised: dayOffset(-randi(5, 60)),
    });
  }

  // Past sales activity on the record (E5)
  const pastActivity = Array.from({ length: randi(2, 4) }, () => ({
    date: dayOffset(-randi(60, 400)),
    client: pick(shuffledCarriers),
    note: pick([
      "QBR held — reviewed cycle time",
      "Program tier upheld",
      "Won back overflow assignments",
      "Carrier flagged estimate accuracy",
      "Added glass program",
    ]),
  }));

  const gapDollars = t12 - t12Plan;

  return {
    id, name, cohort, city, state, region: region.name, rvp: region.rvp, cpm, gm,
    memoRef, icYear, acquired: cohort === "JHCC" ? "JHCC integration" : `${icYear}`,
    businessCase: { monthly: bcMonthly, annual: bcAnnual, aro: bcARO, cars: bcCars, planLine },
    actuals: { monthly: actuals, t3, t12, t3Plan, t12Plan, aro, carCount },
    variance: { t3: revT3Var, t12: revT12Var, gapDollars },
    deficiency: { revByClient, revByDRP, pifCount, pifPrior, cbsaShare, cbsaPrior },
    drpScorecard,
    challenged, reasons, flagDate: dayOffset(-randi(10, 90)), ruleVersion: RULE.version,
    actionPlan: { steps, health: planHealth, openSteps: openSteps.length, overdue },
    salesAsks, pastActivity,
    recovering,
  };
}

/* ---- helpers -------------------------------------------------------------- */
function fmtPct(x, d = 1) { return `${x >= 0 ? "+" : ""}${round(x * 100, d)}%`; }
function dayOffset(days) {
  // demo "today" = 2026-07-30 (matches session date). Pure arithmetic, no Date.now.
  const base = Date.UTC(2026, 6, 30);
  const d = new Date(base + days * 86400000);
  return d.toISOString().slice(0, 10);
}

/* ---- build the portfolio: ~205 IC cases + 140 JHCC ----------------------- */
const STORES = [
  ...Array.from({ length: 205 }, () => buildStore("IC-205")),
  ...Array.from({ length: 140 }, () => buildStore("JHCC")),
];

/* ---- DOMO data-foundation status (E1) ------------------------------------ */
const DOMO_DATASETS = [
  { name: "Exec Dashboard — Revenue T12", rows: "4.1M", latency: "Daily 06:00 ET", certified: true, refreshed: "2026-07-30 06:04 ET", status: "Fresh" },
  { name: "Revenue T3 (rolling)", rows: "1.0M", latency: "Daily 06:00 ET", certified: true, refreshed: "2026-07-30 06:04 ET", status: "Fresh" },
  { name: "Store / Client / DRP dimensions", rows: "12.4K", latency: "Weekly", certified: true, refreshed: "2026-07-27 02:10 ET", status: "Fresh" },
  { name: "PIF counts (CCCone → BDAP)", rows: "8.9M", latency: "Daily 07:30 ET", certified: true, refreshed: "2026-07-30 07:33 ET", status: "Fresh" },
  { name: "CBSA market share", rows: "220K", latency: "Monthly", certified: true, refreshed: "2026-07-01 12:00 ET", status: "Stale (monthly)" },
  { name: "DRP carrier scorecards", rows: "61K", latency: "Weekly (carrier feed)", certified: false, refreshed: "2026-07-28 09:15 ET", status: "Uncertified feed" },
  { name: "Investment Committee business cases", rows: "345", latency: "On load (manual)", certified: true, refreshed: "2026-06-15 (Finance load)", status: "Fresh" },
];

/* ---- portfolio-level aggregates ------------------------------------------ */
const PORTFOLIO = (() => {
  const challenged = STORES.filter((s) => s.challenged);
  const withPlan = challenged.filter((s) => s.actionPlan.steps.length > 0);
  const totalGap = STORES.reduce((a, s) => a + Math.min(0, s.variance.gapDollars), 0);
  const recovered = challenged.filter((s) => s.recovering);
  const overdueItems = STORES.reduce((a, s) => a + s.actionPlan.overdue, 0);
  return {
    totalStores: STORES.length,
    challengedCount: challenged.length,
    withPlanPct: challenged.length ? withPlan.length / challenged.length : 0,
    recoveringPct: challenged.length ? recovered.length / challenged.length : 0,
    totalGap,
    overdueItems,
    atRisk: STORES.filter((s) => s.actionPlan.health === "At risk").length,
  };
})();

window.APP_DATA = { STORES, PORTFOLIO, DOMO_DATASETS, RULE, MONTHS, ACTION_MONTH_INDEX, CARRIERS, REGIONS, fmtPct, round };
