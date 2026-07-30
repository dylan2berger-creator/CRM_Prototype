/* =============================================================================
   Challenged Shop Turnaround Tracker — app shell, router, and views.
   Maps to the Opportunity Canvas increments E1–E6.
   ========================================================================== */
(function () {
  const { STORES, PORTFOLIO, DOMO_DATASETS, RULE, MONTHS, ACTION_MONTH_INDEX, REGIONS, fmtPct } = window.APP_DATA;
  const C = window.Charts;
  const $ = (sel, el = document) => el.querySelector(sel);
  const money = C.money;
  const bigMoney = (n) => {
    const s = n < 0 ? "-" : "";
    const a = Math.abs(n);
    if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(2)}M`;
    if (a >= 1e3) return `${s}$${Math.round(a / 1e3)}K`;
    return `${s}$${Math.round(a)}`;
  };

  /* ---- personas (Target Customers) ---------------------------------------- */
  const PERSONAS = {
    cpm: { name: "Renee Ortiz", role: "Client Performance Manager", scope: "Portfolio-wide", hint: "Primary user. Sees every store, owns the plan and the sales ask." },
    rvp: { name: "Marcus Whitfield", role: "Regional Vice President — Southeast", scope: "Southeast", hint: "Plan health across the region without asking each GM." },
    gm: { name: "Rick Sanders", role: "Shop General Manager", scope: "single store", hint: "Records steps, owners, dates and risks against their store." },
    sales: { name: "Jordan Ellis", role: "Sales", scope: "Sales asks", hint: "Receives and closes sales asks routed from CPMs." },
    finance: { name: "Priya Shah", role: "Finance", scope: "Business cases", hint: "Owns the investment-committee baseline load." },
    exec: { name: "L. Boyd", role: "Executive Leadership", scope: "All markets", hint: "Stores ranked by gap to business case; plan health across markets." },
  };

  const state = {
    view: "portfolio",
    persona: "cpm",
    storeId: null,
    filters: { q: "", cohort: "all", region: "all", status: "challenged", sort: "gap" },
  };

  // Action-plan editing (E5). planEditIndex: null = none, "new" = adding, number = editing that step.
  let planEditIndex = null;
  let planView = "board"; // "board" (kanban) | "list"
  const DEMO_TODAY = new Date("2026-07-30T00:00:00Z");
  const STATUS_OPTS = ["Not started", "In progress", "Blocked", "Done"];
  const RISK_OPTS = ["Low", "Medium", "High"];
  const STATUS_ACCENT = {
    "Not started": "var(--ink-3)", "In progress": "var(--accent)",
    Blocked: "var(--bad)", Done: "var(--good)",
  };

  /* ---- action-plan mutation + persistence --------------------------------- */
  const PLAN_KEY = "cstt_plan_overrides_v1";

  function recomputePlan(s) {
    const steps = s.actionPlan.steps;
    steps.forEach((st) => { st.overdue = st.status !== "Done" && new Date(st.due + "T00:00:00Z") < DEMO_TODAY; });
    const open = steps.filter((st) => st.status !== "Done").length;
    const overdue = steps.filter((st) => st.overdue).length;
    let health;
    if (steps.length === 0) health = "None";
    else if (overdue >= 2 || steps.some((st) => st.status === "Blocked" && st.risk === "High")) health = "At risk";
    else if (overdue === 1 || open > 3) health = "Watch";
    else health = "On track";
    s.actionPlan.health = health;
    s.actionPlan.openSteps = open;
    s.actionPlan.overdue = overdue;
  }

  function loadPlanOverrides() {
    let map = {};
    try { map = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}"); } catch (e) { /* storage blocked — stay in-memory */ }
    Object.entries(map).forEach(([id, steps]) => {
      const s = STORES.find((x) => x.id === id);
      if (s && Array.isArray(steps)) { s.actionPlan.steps = steps; recomputePlan(s); }
    });
  }

  function persistPlan(s) {
    try {
      const map = JSON.parse(localStorage.getItem(PLAN_KEY) || "{}");
      map[s.id] = s.actionPlan.steps;
      localStorage.setItem(PLAN_KEY, JSON.stringify(map));
    } catch (e) { /* storage blocked — edits persist for the session only */ }
  }

  function escapeAttr(v) { return String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }

  /* ---- navigation --------------------------------------------------------- */
  const NAV = [
    { group: "Turnaround" },
    { id: "portfolio", label: "Portfolio", ic: "▦", epic: "E6" },
    { id: "alerts", label: "Slippage alerts", ic: "◈", epic: "E6", count: () => alertsList().length },
    { id: "deficiency", label: "Deficiency analysis", ic: "◵", epic: "E4" },
    { group: "Foundation" },
    { id: "rule", label: "Challenged rule", ic: "⚖", epic: "E3" },
    { id: "data", label: "Data foundation", ic: "⛁", epic: "E1" },
  ];

  function personaScopedStores() {
    const p = state.persona;
    if (p === "rvp") return STORES.filter((s) => s.region === "Southeast");
    if (p === "gm") return STORES.filter((s) => s.gm === PERSONAS.gm.name).length
      ? STORES.filter((s) => s.gm === PERSONAS.gm.name) : [STORES.find((s) => s.challenged)];
    return STORES;
  }

  /* ---- render shell ------------------------------------------------------- */
  function render() {
    const root = $("#root");
    root.innerHTML = `
      <div class="app">
        ${sidebar()}
        <main class="main" id="main"></main>
      </div>`;
    bindSidebar();
    renderView();
  }

  function sidebar() {
    const navHtml = NAV.map((n) => {
      if (n.group) return `<div class="nav-group-label">${n.group}</div>`;
      const cnt = n.count ? n.count() : null;
      return `<button class="nav-item ${state.view === n.id ? "active" : ""}" data-nav="${n.id}">
        <span class="ic">${n.ic}</span><span>${n.label}</span>
        ${cnt ? `<span class="count">${cnt}</span>` : ""}
      </button>`;
    }).join("");
    const personaOpts = Object.entries(PERSONAS).map(([k, v]) =>
      `<option value="${k}" ${state.persona === k ? "selected" : ""}>${v.role}</option>`).join("");
    return `
      <aside class="sidebar">
        <div class="brand">
          <div class="logo">B</div>
          <div>
            <div class="title">Turnaround Tracker</div>
            <div class="subtitle">Challenged Shops</div>
          </div>
        </div>
        <nav>${navHtml}</nav>
        <div class="spacer"></div>
        <div class="persona-box">
          <label>Viewing as</label>
          <select id="persona">${personaOpts}</select>
          <div class="persona-hint" id="personaHint">${PERSONAS[state.persona].hint}</div>
        </div>
      </aside>`;
  }

  function bindSidebar() {
    document.querySelectorAll("[data-nav]").forEach((b) =>
      b.addEventListener("click", () => { planEditIndex = null; state.view = b.dataset.nav; state.storeId = null; render(); }));
    const ps = $("#persona");
    if (ps) ps.addEventListener("change", (e) => {
      planEditIndex = null;
      state.persona = e.target.value;
      // sensible landing per persona
      if (state.persona === "gm") { const s = personaScopedStores()[0]; state.view = "store"; state.storeId = s.id; }
      else if (state.persona === "sales") state.view = "alerts";
      else if (state.persona === "data" || state.persona === "finance") state.view = "data";
      else state.view = "portfolio";
      state.storeId = state.view === "store" ? state.storeId : null;
      render();
    });
  }

  function renderView() {
    const main = $("#main");
    const v = state.storeId ? "store" : state.view;
    const map = {
      portfolio: viewPortfolio, store: viewStore, deficiency: viewDeficiency,
      alerts: viewAlerts, rule: viewRule, data: viewData,
    };
    main.innerHTML = (map[v] || viewPortfolio)();
    bindView(v);
    main.scrollTo?.(0, 0);
  }

  /* =========================================================================
     VIEW: Portfolio roll-up  (E6 / E3)
     ====================================================================== */
  function viewPortfolio() {
    const scoped = personaScopedStores();
    const challenged = scoped.filter((s) => s.challenged);
    const withPlan = challenged.filter((s) => s.actionPlan.steps.length);
    const recovering = challenged.filter((s) => s.recovering);
    const gap = scoped.reduce((a, s) => a + Math.min(0, s.variance.gapDollars), 0);
    const overdue = scoped.reduce((a, s) => a + s.actionPlan.overdue, 0);
    const p = PERSONAS[state.persona];

    const kpis = [
      { label: "Challenged stores", value: challenged.length, meta: `of ${scoped.length} in scope`, cls: "bad" },
      { label: "With an active plan", value: pct(withPlan.length, challenged.length), meta: `${withPlan.length} of ${challenged.length} flagged`, bar: withPlan.length / (challenged.length || 1) },
      { label: "Returning to case", value: pct(recovering.length, challenged.length), meta: "trend bent up since action", bar: recovering.length / (challenged.length || 1), cls: "good" },
      { label: "Total gap to case (T12)", value: bigMoney(gap), meta: "sum of stores under plan", cls: "bad" },
      { label: "Overdue action items", value: overdue, meta: `${scoped.filter((s) => s.actionPlan.health === "At risk").length} plans at risk`, cls: overdue ? "bad" : "good" },
    ];

    return `
      ${topbar("Portfolio", `${p.role} · ${p.scope}. Stores ranked by gap to business case with live plan health — the roll-up that replaces the tracker doc.`, "E6")}
      <div class="grid kpi-row">${kpis.map(kpiCard).join("")}</div>

      <div class="section-title"><h3>Stores by gap to business case</h3>
        <span class="hint">Reads DOMO T12/T3 · flagged by rule ${RULE.version}</span></div>
      ${portfolioToolbar()}
      ${portfolioTable(scoped)}

      <div class="footer-note">
        Baseline = each store's investment-committee business case (E2). Actuals read from certified DOMO datasets (E1).
        Flags computed by the versioned challenged rule (E3). Click any store for its record.
      </div>`;
  }

  function portfolioToolbar() {
    const f = state.filters;
    const regionOpts = ["all", ...REGIONS.map((r) => r.name)].map((r) =>
      `<option value="${r}" ${f.region === r ? "selected" : ""}>${r === "all" ? "All regions" : r}</option>`).join("");
    return `
      <div class="toolbar">
        <input type="search" id="q" placeholder="Search store, city, GM, CPM…" value="${f.q}">
        <select id="region">${regionOpts}</select>
        <div class="seg" id="cohort">
          ${seg("cohort", "all", "All", f.cohort)}${seg("cohort", "IC-205", "IC ~205", f.cohort)}${seg("cohort", "JHCC", "JHCC", f.cohort)}
        </div>
        <div class="seg" id="status">
          ${seg("status", "challenged", "Challenged", f.status)}${seg("status", "watch", "Watch", f.status)}${seg("status", "all", "All", f.status)}
        </div>
        <div class="spacer-x"></div>
        <select id="sort">
          ${["gap", "t3", "plan", "name"].map((s) => `<option value="${s}" ${f.sort === s ? "selected" : ""}>Sort: ${({ gap: "Gap to case", t3: "T3 variance", plan: "Plan health", name: "Name" })[s]}</option>`).join("")}
        </select>
      </div>`;
  }

  function filteredStores(scoped) {
    const f = state.filters;
    let rows = scoped.slice();
    if (f.cohort !== "all") rows = rows.filter((s) => s.cohort === f.cohort);
    if (f.region !== "all") rows = rows.filter((s) => s.region === f.region);
    if (f.status === "challenged") rows = rows.filter((s) => s.challenged);
    else if (f.status === "watch") rows = rows.filter((s) => !s.challenged && s.variance.t3 < -0.02);
    if (f.q) {
      const q = f.q.toLowerCase();
      rows = rows.filter((s) => (s.name + s.city + s.state + s.gm + s.cpm + s.id).toLowerCase().includes(q));
    }
    const health = { "At risk": 0, Watch: 1, "On track": 2, None: 3 };
    rows.sort((a, b) => {
      if (f.sort === "gap") return a.variance.gapDollars - b.variance.gapDollars;
      if (f.sort === "t3") return a.variance.t3 - b.variance.t3;
      if (f.sort === "plan") return health[a.actionPlan.health] - health[b.actionPlan.health];
      return a.name.localeCompare(b.name);
    });
    return rows;
  }

  function portfolioTable(scoped) {
    const rows = filteredStores(scoped);
    if (!rows.length) return `<div class="card"><div class="empty">No stores match these filters.</div></div>`;
    const body = rows.slice(0, 120).map((s) => {
      const spark = C.spark(s.actuals.monthly.slice(-9));
      return `<tr class="clickable" data-store="${s.id}">
        <td><div class="store-name">${s.name}</div>
            <div class="store-meta">${s.city}, ${s.state} · GM ${s.gm} · ${s.id}</div></td>
        <td><span class="chip ${s.cohort === "JHCC" ? "cohort-jhcc" : ""}">${s.cohort}</span></td>
        <td>${flagBadge(s)}</td>
        <td class="num">${bigMoney(s.actuals.t12)}</td>
        <td class="num"><span class="${s.variance.t12 < 0 ? "var-neg" : "var-pos"}">${fmtPct(s.variance.t12)}</span></td>
        <td class="num"><span class="${s.variance.t3 < 0 ? "var-neg" : "var-pos"}">${fmtPct(s.variance.t3)}</span></td>
        <td class="num var-neg">${s.variance.gapDollars < 0 ? bigMoney(s.variance.gapDollars) : "—"}</td>
        <td>${planBadge(s.actionPlan.health)}</td>
        <td>${spark}</td>
      </tr>`;
    }).join("");
    return `
      <div class="card" style="padding:6px 0 0">
        <div class="tbl-wrap">
          <table>
            <thead><tr>
              <th>Store</th><th>Cohort</th><th>Flag</th>
              <th class="num">T12 rev</th><th class="num">T12 vs case</th><th class="num">T3 vs case</th>
              <th class="num">Gap $</th><th>Plan</th><th>Trend</th>
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${rows.length > 120 ? `<div class="count-note" style="padding:10px 14px">Showing 120 of ${rows.length}. Refine filters to narrow.</div>` : `<div class="count-note" style="padding:10px 14px">${rows.length} stores</div>`}
      </div>`;
  }

  /* =========================================================================
     VIEW: Store record  (E2 / E3 / E5 / E6)
     ====================================================================== */
  function viewStore() {
    const s = STORES.find((x) => x.id === state.storeId);
    if (!s) return viewPortfolio();
    const a = s.actuals, bc = s.businessCase;

    const metricTiles = [
      { lbl: "T12 revenue", val: bigMoney(a.t12), sub: `case ${bigMoney(a.t12Plan)}` },
      { lbl: "T3 vs case", val: fmtPct(s.variance.t3), cls: s.variance.t3 < 0 ? "bad" : "good" },
      { lbl: "Avg RO (ARO)", val: "$" + a.aro.toLocaleString(), sub: `case $${bc.aro.toLocaleString()}` },
      { lbl: "Car count / mo", val: a.carCount, sub: `case ${bc.cars}` },
    ];

    return `
      <button class="back-link" data-back>← Portfolio</button>
      ${storeHeader(s)}

      <div class="grid three-col" style="margin-top:16px">
        <div class="card">
          <div class="card-head"><h4>Plan vs. actual revenue <span class="epic-tag">E6</span></h4></div>
          <div class="card-sub">Each metric charted from the action date forward, so you can tell whether the plan worked.</div>
          ${C.planVsActual(a.monthly, bc.planLine, MONTHS, ACTION_MONTH_INDEX)}
        </div>
        <div class="card">
          <h4>Why it's flagged <span class="epic-tag">E3</span></h4>
          <div class="card-sub">Rule ${s.ruleVersion} · flagged ${s.flagDate}</div>
          ${s.reasons.length ? `<ul class="reason-list">${s.reasons.map((r) => `
            <li><span class="r-ic">!</span>
              <div class="r-body"><b>${r.label}</b><span>${r.detail}</span></div>
              <span class="r-period">${r.period}</span></li>`).join("")}</ul>`
        : `<div class="empty">Not flagged. Meets the business case on every rule criterion.</div>`}
        </div>
        <div class="card">
          <h4>At a glance</h4>
          <div class="card-sub">vs investment-committee case</div>
          <div class="metric-grid">${metricTiles.map((m) =>
      `<div class="metric-tile"><div class="mt-val ${m.cls || ""}">${m.val}</div><div class="mt-lbl">${m.lbl}</div>${m.sub ? `<div class="store-meta" style="margin-top:3px">${m.sub}</div>` : ""}</div>`).join("")}</div>
          <div class="callout" style="margin-top:14px"><span>ⓘ</span><div>Baseline is memo <b>${s.memoRef}</b> (${s.icYear}). Actuals read from DOMO, last refresh 06:04 ET today.</div></div>
        </div>
      </div>

      <div style="margin-top:16px">
        ${actionPlanCard(s)}
      </div>

      <div class="grid two-col" style="margin-top:16px">
        ${deficiencyMini(s)}
        ${drpScorecardCard(s)}
      </div>

      <div style="margin-top:16px">
        ${salesAskCard(s)}
      </div>

      <div class="footer-note">One record per store carrying the business-case baseline (E2), live actuals (E1), the challenged rationale (E3), the deficiency view (E4), the action plan and sales ask (E5), and progress from the action date (E6).</div>`;
  }

  function storeHeader(s) {
    return `
      <div class="card">
        <div class="detail-head">
          <div>
            <h1 style="font-size:20px">${s.name}</h1>
            <div class="meta-row">
              <span class="chip ${s.cohort === "JHCC" ? "cohort-jhcc" : ""}">${s.cohort}</span>
              ${flagBadge(s)} ${planBadge(s.actionPlan.health)}
              <span class="kv">📍 <b>${s.city}, ${s.state}</b> · ${s.region}</span>
            </div>
            <div class="meta-row">
              <span class="kv">GM <b>${s.gm}</b></span>
              <span class="kv">CPM <b>${s.cpm}</b></span>
              <span class="kv">RVP <b>${s.rvp}</b></span>
              <span class="kv">Case <b>${s.memoRef}</b></span>
            </div>
          </div>
          <div style="text-align:right">
            <div class="kpi" style="padding:0">
              <div class="label">Gap to business case (T12)</div>
              <div class="value ${s.variance.gapDollars < 0 ? "bad" : "good"}">${bigMoney(s.variance.gapDollars)}</div>
              <div class="meta">${fmtPct(s.variance.t12)} vs case · ${s.recovering ? "trend bending up" : "still below plan"}</div>
            </div>
          </div>
        </div>
      </div>`;
  }

  function actionPlanCard(s) {
    const steps = s.actionPlan.steps;
    const sub = planView === "board"
      ? "Track steps by status — drag a card between columns to update it. Owners, due dates and risk live on the store, not in a deck."
      : "Steps, owners, dates and risks live on the store — not in a deck or email.";
    const body = steps.length === 0
      ? `<div class="empty">No action plan recorded yet.${s.challenged ? " This flagged store needs one — add the first step." : ""}</div>`
      : (planView === "board" ? kanbanBoard(s) : planList(s));
    return `
      <div class="card">
        <div class="card-head">
          <div><h4>Action plan <span class="epic-tag">E5</span></h4>
          <div class="card-sub">${sub}</div></div>
          <div class="card-head-actions">
            ${planBadge(s.actionPlan.health)}
            <div class="seg seg-sm">
              <button data-planview="board" class="${planView === "board" ? "active" : ""}">▤ Board</button>
              <button data-planview="list" class="${planView === "list" ? "active" : ""}">☰ List</button>
            </div>
            <button class="btn btn-sm btn-primary" data-plan-add>+ Add step</button>
          </div>
        </div>
        ${body}
        ${planEditIndex !== null ? planModal(s) : ""}
      </div>`;
  }

  function kanbanBoard(s) {
    const cols = STATUS_OPTS.map((status) => {
      const cards = s.actionPlan.steps
        .map((st, i) => ({ st, i }))
        .filter((x) => x.st.status === status);
      const overdue = cards.filter((c) => c.st.overdue).length;
      return `
        <div class="kanban-col" data-drop-status="${status}" style="--col-accent:${STATUS_ACCENT[status]}">
          <div class="kanban-col-head">
            <span class="k-dot"></span>
            <span class="k-title">${status}</span>
            ${overdue ? `<span class="k-overdue" title="${overdue} overdue">${overdue}⚠</span>` : ""}
            <span class="k-count">${cards.length}</span>
          </div>
          <div class="kanban-col-body">
            ${cards.map(({ st, i }) => kanbanCard(st, i)).join("") || `<div class="kanban-empty">Drop here</div>`}
          </div>
        </div>`;
    }).join("");
    return `<div class="kanban">${cols}</div>`;
  }

  function kanbanCard(st, i) {
    const riskColor = st.risk === "High" ? "var(--bad)" : st.risk === "Medium" ? "var(--warn)" : "var(--ink-3)";
    return `
      <div class="kcard" draggable="true" data-card-index="${i}" style="--risk-color:${riskColor}" tabindex="0" role="button" aria-label="Edit ${escapeAttr(st.title)}">
        <div class="kc-title">${escapeAttr(st.title)}</div>
        <div class="kc-meta">
          <span>👤 ${escapeAttr(st.owner)}</span>
          <span class="${st.overdue ? "var-neg" : ""}">📅 ${st.due}${st.overdue ? " · overdue" : ""}</span>
        </div>
        <div class="kc-foot">
          ${riskBadge(st.risk)}
          <span class="kc-actions">
            <button class="icon-btn" data-plan-edit="${i}" title="Edit step" aria-label="Edit step">✎</button>
            <button class="icon-btn" data-plan-del="${i}" title="Delete step" aria-label="Delete step">🗑</button>
          </span>
        </div>
      </div>`;
  }

  function planList(s) {
    return s.actionPlan.steps.map((st, i) => `
      <div class="plan-step">
        <div>
          <div class="p-title">${escapeAttr(st.title)}</div>
          <div class="p-meta"><span>👤 ${escapeAttr(st.owner)}</span><span class="${st.overdue ? "var-neg" : ""}">📅 due ${st.due}${st.overdue ? " · overdue" : ""}</span></div>
        </div>
        <div class="p-right">
          ${riskBadge(st.risk)} ${statusBadge(st.status)}
          <span class="p-row-actions">
            <button class="icon-btn" data-plan-edit="${i}" title="Edit step" aria-label="Edit step">✎</button>
            <button class="icon-btn" data-plan-del="${i}" title="Delete step" aria-label="Delete step">🗑</button>
          </span>
        </div>
      </div>`).join("");
  }

  function planModal(s) {
    const step = planEditIndex === "new" ? null : s.actionPlan.steps[planEditIndex];
    const st = step || { title: "", owner: s.gm, due: "2026-08-15", status: "Not started", risk: "Medium" };
    const ownerOpts = planOwnerOptions(s, st.owner);
    const statusOpts = STATUS_OPTS.map((o) => `<option ${o === st.status ? "selected" : ""}>${o}</option>`).join("");
    const riskOpts = RISK_OPTS.map((o) => `<option ${o === st.risk ? "selected" : ""}>${o}</option>`).join("");
    return `
      <div class="modal-backdrop" data-modal-backdrop>
        <div class="modal" role="dialog" aria-modal="true" aria-label="${step ? "Edit action step" : "Add action step"}">
          <div class="modal-head">
            <h4>${step ? "Edit action step" : "Add action step"}</h4>
            <button class="icon-btn" data-plan-cancel aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="field">
              <label>Step</label>
              <input type="text" data-f="title" value="${escapeAttr(st.title)}" placeholder="e.g. Cycle-time blitz on supplement approvals" />
            </div>
            <div class="modal-grid">
              <div class="field"><label>Owner</label><select data-f="owner">${ownerOpts}</select></div>
              <div class="field"><label>Due date</label><input type="date" data-f="due" value="${st.due}" /></div>
              <div class="field"><label>Status</label><select data-f="status">${statusOpts}</select></div>
              <div class="field"><label>Risk</label><select data-f="risk">${riskOpts}</select></div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn btn-ghost btn-sm" data-plan-cancel>Cancel</button>
            <button class="btn btn-primary btn-sm" data-plan-save data-index="${planEditIndex}">${step ? "Save changes" : "Add step"}</button>
          </div>
        </div>
      </div>`;
  }

  function planOwnerOptions(s, current) {
    const base = [s.gm, s.cpm, s.rvp, "Sales — Team"];
    const list = [...new Set([current, ...base].filter(Boolean))];
    return list.map((o) => `<option ${o === current ? "selected" : ""}>${escapeAttr(o)}</option>`).join("");
  }

  function salesAskCard(s) {
    return `
      <div class="card">
        <div class="card-head"><div><h4>Sales asks &amp; activity <span class="epic-tag">E5</span></h4>
          <div class="card-sub">Raise an ask, route it to Sales, see it closed. Past activity on the same record.</div></div></div>
        ${s.salesAsks.length ? `<div class="ask-grid">${s.salesAsks.map((a) => `
          <div class="ask-item">
            <div class="a-title">${a.ask}</div>
            <div class="a-meta">Client ${a.client} · owner ${a.owner} · raised ${a.raised}</div>
            <div style="margin-top:6px">${askStatusBadge(a.status)}</div>
          </div>`).join("")}</div>` : `<div class="empty" style="padding:14px">No open sales asks.</div>`}
        <div class="card-sub" style="margin-top:12px;border-top:1px solid var(--line-2);padding-top:10px">Past sales activity — ${s.pastActivity[0].client} and others</div>
        ${s.pastActivity.map((p) => `<div class="p-meta" style="padding:4px 0"><span>${p.date}</span> · <b>${p.client}</b> · ${p.note}</div>`).join("")}
      </div>`;
  }

  function deficiencyMini(s) {
    const d = s.deficiency;
    const rows = d.revByDRP.slice(0, 6).map((r) => ({
      label: r.carrier, value: r.revenue, valueLabel: money(r.revenue),
      className: "bar-drp", badge: fmtPct(r.yoy, 0), badgeClass: r.yoy >= 0 ? "pos" : "neg",
    }));
    return `
      <div class="card">
        <div class="card-head"><div><h4>Deficiency — revenue by DRP <span class="epic-tag">E4</span></h4>
          <div class="card-sub">Which carrier relationship is driving the gap. YoY at right.</div></div>
          <a href="#" data-nav-link="deficiency">Full analysis →</a></div>
        ${C.hbars(rows, { w: 520, padL: 96, title: "Revenue by DRP" })}
        <div class="metric-grid" style="margin-top:12px;grid-template-columns:repeat(3,1fr)">
          <div class="metric-tile"><div class="mt-val">${d.pifCount.toLocaleString()}</div><div class="mt-lbl">PIF count</div><div class="store-meta">${d.pifCount >= d.pifPrior ? "▲" : "▼"} vs ${d.pifPrior.toLocaleString()} PY</div></div>
          <div class="metric-tile"><div class="mt-val">${d.cbsaShare}%</div><div class="mt-lbl">CBSA share</div><div class="store-meta">${d.cbsaShare >= d.cbsaPrior ? "▲" : "▼"} from ${d.cbsaPrior}%</div></div>
          <div class="metric-tile"><div class="mt-val">${d.revByDRP.length}</div><div class="mt-lbl">Active DRPs</div></div>
        </div>
      </div>`;
  }

  function drpScorecardCard(s) {
    return `
      <div class="card">
        <div class="card-head"><div><h4>DRP scorecard vs area competitors <span class="epic-tag">E4</span></h4>
          <div class="card-sub">Standing before the carrier meeting. Rank change drives assignment volume.</div></div></div>
        <div class="tbl-wrap"><table>
          <thead><tr><th>Carrier</th><th>Metric</th><th class="num">Score</th><th>Rank vs area</th></tr></thead>
          <tbody>${s.drpScorecard.map((d) => `<tr>
            <td class="store-name">${d.carrier}</td>
            <td class="store-meta">${d.metric}</td>
            <td class="num">${d.score}</td>
            <td>${C.rankPill(d.rank, d.totalComp, d.prevRank)}</td></tr>`).join("")}</tbody>
        </table></div>
        <div class="callout" style="margin-top:12px"><span>ⓘ</span><div>Scorecard feed is <b>uncertified</b> (carrier weekly). Flagged in Data Foundation so users know its currency.</div></div>
      </div>`;
  }

  /* =========================================================================
     VIEW: Deficiency & carrier analysis  (E4)
     ====================================================================== */
  function viewDeficiency() {
    const scoped = personaScopedStores().filter((s) => s.challenged);
    // aggregate revenue by DRP across challenged stores
    const byDrp = {};
    scoped.forEach((s) => s.deficiency.revByDRP.forEach((r) => {
      byDrp[r.carrier] = byDrp[r.carrier] || { rev: 0, pif: 0, yoySum: 0, n: 0 };
      byDrp[r.carrier].rev += r.revenue; byDrp[r.carrier].yoySum += r.yoy; byDrp[r.carrier].n++;
    }));
    scoped.forEach((s) => s.deficiency.revByClient.forEach((c) => { if (byDrp[c.client]) byDrp[c.client].pif += c.pif; }));
    const drpRows = Object.entries(byDrp).map(([carrier, v]) => ({
      label: carrier, value: v.rev, valueLabel: money(v.rev),
      className: "bar-drp", badge: fmtPct(v.yoySum / v.n, 0), badgeClass: v.yoySum >= 0 ? "pos" : "neg",
    })).sort((a, b) => b.value - a.value);

    // carrier scorecard slippage roll-up
    const slip = {};
    scoped.forEach((s) => s.drpScorecard.forEach((d) => {
      slip[d.carrier] = slip[d.carrier] || { down: 0, up: 0, stores: 0 };
      slip[d.carrier].stores++;
      if (d.rank > d.prevRank) slip[d.carrier].down++;
      else if (d.rank < d.prevRank) slip[d.carrier].up++;
    }));
    const slipRows = Object.entries(slip).sort((a, b) => b[1].down - a[1].down);

    const totalPif = scoped.reduce((a, s) => a + s.deficiency.pifCount, 0);
    const totalPifPrior = scoped.reduce((a, s) => a + s.deficiency.pifPrior, 0);
    const avgCbsa = scoped.reduce((a, s) => a + s.deficiency.cbsaShare, 0) / (scoped.length || 1);
    const avgCbsaPrior = scoped.reduce((a, s) => a + s.deficiency.cbsaPrior, 0) / (scoped.length || 1);

    return `
      ${topbar("Deficiency &amp; carrier analysis", "One analysis view built once against certified DOMO datasets — replacing the per-cycle rebuild of PIF counts, CBSA share, and revenue by client and DRP.", "E4")}
      <div class="grid kpi-row">
        ${kpiCard({ label: "Challenged stores in view", value: scoped.length, meta: `${PERSONAS[state.persona].scope}` })}
        ${kpiCard({ label: "PIF count (challenged)", value: (totalPif / 1000).toFixed(1) + "K", meta: `${totalPif >= totalPifPrior ? "▲" : "▼"} vs ${(totalPifPrior / 1000).toFixed(1)}K prior year`, cls: totalPif >= totalPifPrior ? "good" : "bad" })}
        ${kpiCard({ label: "Avg CBSA market share", value: avgCbsa.toFixed(1) + "%", meta: `${avgCbsa >= avgCbsaPrior ? "▲" : "▼"} from ${avgCbsaPrior.toFixed(1)}% YoY`, cls: avgCbsa >= avgCbsaPrior ? "good" : "bad" })}
        ${kpiCard({ label: "Carriers with slipping ranks", value: slipRows.filter((r) => r[1].down > r[1].up).length, meta: "net rank loss vs area competitors" })}
      </div>

      <div class="grid two-col">
        <div class="card">
          <h4>Revenue by DRP — challenged stores <span class="epic-tag">E4</span></h4>
          <div class="card-sub">Aggregated across ${scoped.length} flagged stores. Tells a shop problem from a market problem.</div>
          ${C.hbars(drpRows, { w: 540, padL: 96 })}
        </div>
        <div class="card">
          <h4>DRP scorecard slippage vs area competitors <span class="epic-tag">E4</span></h4>
          <div class="card-sub">Where standing is falling — drives the carrier meeting agenda and assignment volume.</div>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Carrier</th><th class="num">Stores</th><th class="num">Slipping</th><th class="num">Improving</th><th>Net</th></tr></thead>
            <tbody>${slipRows.map(([c, v]) => `<tr>
              <td class="store-name">${c}</td>
              <td class="num">${v.stores}</td>
              <td class="num var-neg">${v.down || "—"}</td>
              <td class="num var-pos">${v.up || "—"}</td>
              <td>${v.down > v.up ? `<span class="badge bad"><span class="dot"></span>Losing</span>` : v.up > v.down ? `<span class="badge good"><span class="dot"></span>Gaining</span>` : `<span class="badge neutral">Flat</span>`}</td>
            </tr>`).join("")}</tbody>
          </table></div>
        </div>
      </div>

      <div class="section-title"><h3>PIF &amp; CBSA by store</h3><span class="hint">Volume next to revenue and market share</span></div>
      <div class="card" style="padding:6px 0 0"><div class="tbl-wrap"><table>
        <thead><tr><th>Store</th><th class="num">T12 rev</th><th class="num">PIF count</th><th class="num">PIF YoY</th><th class="num">CBSA share</th><th class="num">CBSA YoY</th><th>Read</th></tr></thead>
        <tbody>${scoped.slice().sort((a, b) => a.deficiency.cbsaShare - a.deficiency.cbsaPrior - (b.deficiency.cbsaShare - b.deficiency.cbsaPrior)).slice(0, 40).map((s) => {
      const pifD = s.deficiency.pifCount - s.deficiency.pifPrior;
      const cbsaD = s.deficiency.cbsaShare - s.deficiency.cbsaPrior;
      const marketProblem = cbsaD < -1 && pifD < 0;
      return `<tr class="clickable" data-store="${s.id}">
          <td><div class="store-name">${s.name}</div><div class="store-meta">${s.city}, ${s.state}</div></td>
          <td class="num">${bigMoney(s.actuals.t12)}</td>
          <td class="num">${s.deficiency.pifCount.toLocaleString()}</td>
          <td class="num"><span class="${pifD >= 0 ? "var-pos" : "var-neg"}">${pifD >= 0 ? "+" : ""}${pifD}</span></td>
          <td class="num">${s.deficiency.cbsaShare}%</td>
          <td class="num"><span class="${cbsaD >= 0 ? "var-pos" : "var-neg"}">${cbsaD >= 0 ? "+" : ""}${cbsaD.toFixed(1)}pt</span></td>
          <td>${marketProblem ? `<span class="badge warn"><span class="dot"></span>Market</span>` : `<span class="badge neutral">Shop</span>`}</td>
        </tr>`;
    }).join("")}</tbody>
      </table></div></div>
      <div class="footer-note">Built once against certified DOMO datasets (PIF via CCCone→BDAP, CBSA share monthly). "Market" = share and volume both falling; "Shop" = share holding while revenue lags — a shop-execution problem.</div>`;
  }

  /* =========================================================================
     VIEW: Slippage alerts  (E6)
     ====================================================================== */
  // prio orders the feed so the headline value — a business-case slippage alert
  // at the first missed period — surfaces above secondary signals.
  function alertsList() {
    const scoped = personaScopedStores();
    const alerts = [];
    scoped.forEach((s) => {
      // first-missed-period alert (the E6 headline)
      if (s.variance.t3 <= -0.08)
        alerts.push({ store: s, sev: "bad", prio: 0, type: "Slippage vs business case", when: s.flagDate, sort: s.variance.t3,
          desc: `T3 revenue ${fmtPct(s.variance.t3)} against the case — caught at the first missed period, not at quarterly review.` });
      else if (s.variance.t3 <= -0.03)
        alerts.push({ store: s, sev: "warn", prio: 2, type: "Early slippage watch", when: s.flagDate, sort: s.variance.t3,
          desc: `T3 revenue ${fmtPct(s.variance.t3)} vs case — trending toward the challenged threshold.` });
      s.drpScorecard.filter((d) => d.rank - d.prevRank >= 2).forEach((d) =>
        alerts.push({ store: s, sev: "bad", prio: 1, type: "DRP rank drop", when: s.flagDate, sort: -(d.rank - d.prevRank),
          desc: `${d.carrier} scorecard slipped #${d.prevRank}→#${d.rank} of ${d.totalComp} — assignment risk.` }));
      s.actionPlan.steps.filter((st) => st.overdue).forEach((st) =>
        alerts.push({ store: s, sev: "warn", prio: 3, type: "Overdue action item", when: st.due, sort: 0,
          desc: `"${st.title}" owned by ${st.owner} is past due.` }));
    });
    return alerts.sort((a, b) => (a.prio - b.prio) || (a.sort - b.sort));
  }

  function viewAlerts() {
    const alerts = alertsList();
    const critical = alerts.filter((a) => a.type === "Slippage vs business case").length;
    return `
      ${topbar("Slippage alerts", "Get ahead of slippage: an alert on the business case at the first missed period, plus overdue items and DRP rank drops. Follow-up stops being reactive.", "E6")}
      <div class="grid kpi-row">
        ${kpiCard({ label: "Open alerts", value: alerts.length, meta: `${PERSONAS[state.persona].scope}` })}
        ${kpiCard({ label: "Slippage vs case", value: critical, meta: "at or past challenged threshold", cls: "bad" })}
        ${kpiCard({ label: "Overdue items", value: alerts.filter((a) => a.type === "Overdue action item").length, meta: "action steps past due" })}
        ${kpiCard({ label: "DRP rank drops", value: alerts.filter((a) => a.type === "DRP rank drop").length, meta: "assignment-volume risk" })}
      </div>
      <div class="card" style="padding:4px 0">
        ${alerts.slice(0, 60).map((a) => `
          <div class="alert-item clickable" data-store="${a.store.id}">
            <div class="a-ic ${a.sev}">${a.sev === "bad" ? "!" : "⚠"}</div>
            <div class="a-main">
              <b>${a.type} — ${a.store.name}</b>
              <div class="a-desc">${a.desc}</div>
              <div class="store-meta" style="margin-top:3px">${a.store.city}, ${a.store.state} · CPM ${a.store.cpm} · ${a.store.cohort}</div>
            </div>
            <div class="a-when">${a.when}</div>
          </div>`).join("")}
        ${alerts.length > 60 ? `<div class="count-note" style="padding:12px 14px">Showing 60 of ${alerts.length}.</div>` : ""}
      </div>
      <div class="footer-note">Alerts fire on the business-case comparison the moment a period misses — measured against baseline (E2) using live DOMO actuals (E1). Time from first missed period to recorded action is a key success metric.</div>`;
  }

  /* =========================================================================
     VIEW: Challenged rule  (E3)
     ====================================================================== */
  function viewRule() {
    const scoped = STORES;
    const counts = {};
    RULE.criteria.forEach((c) => counts[c.key] = 0);
    scoped.forEach((s) => s.reasons.forEach((r) => counts[r.key] = (counts[r.key] || 0) + 1));
    return `
      ${topbar("Challenged-store rule", "Boyd's existing challenged definition, applied automatically and kept auditable. Versioned so a definition change does not silently restate history.", "E3")}
      <div class="grid two-col">
        <div class="card">
          <div class="card-head"><div><h4>Definition ${RULE.version}</h4>
            <div class="card-sub">Effective ${RULE.effective} · maintained by ${RULE.author}</div></div>
            <span class="badge good"><span class="dot"></span>Active</span></div>
          <p style="color:var(--ink-2);font-size:12.5px">${RULE.note}</p>
          <div class="tbl-wrap"><table>
            <thead><tr><th>Criterion</th><th class="num">Stores flagged</th></tr></thead>
            <tbody>${RULE.criteria.map((c) => `<tr>
              <td>${c.label}</td>
              <td class="num"><b>${counts[c.key]}</b></td></tr>`).join("")}</tbody>
          </table></div>
          <div class="callout" style="margin-top:14px"><span>ⓘ</span><div>A store is <b>challenged</b> if it trips <b>any</b> criterion. Each hit is recorded with its metric and period on the store record, so a CPM can see exactly why.</div></div>
        </div>
        <div class="card">
          <h4>Version history</h4>
          <div class="card-sub">Changing the definition creates a new version — history is preserved under the version that produced it.</div>
          ${[{ v: "v2.3", d: RULE.effective, note: "Added CBSA share ≥1.5pt YoY drop. Current.", active: true },
            { v: "v2.2", d: "2025-10-01", note: "DRP rank-drop threshold tightened to 2 ranks." },
            { v: "v2.1", d: "2025-07-01", note: "T3 threshold moved from -10% to -8%." },
            { v: "v2.0", d: "2025-01-01", note: "JHCC cohort onto the same rule set." }].map((h) => `
            <div class="plan-step"><div><div class="p-title">${h.v} ${h.active ? `<span class="badge good" style="margin-left:6px"><span class="dot"></span>Active</span>` : ""}</div>
              <div class="p-meta"><span>effective ${h.d}</span></div>
              <div class="store-meta" style="margin-top:3px">${h.note}</div></div></div>`).join("")}
          <div class="callout" style="margin-top:12px"><span>⚖</span><div><b>Admin control.</b> Editing a criterion here would open <b>v2.4</b> in draft and re-run detection on a preview cohort before publishing.</div></div>
        </div>
      </div>
      <div class="footer-note">Auditable rule + per-store rationale means CPMs stop building the challenged list from the tracker doc by hand.</div>`;
  }

  /* =========================================================================
     VIEW: Data foundation  (E1)
     ====================================================================== */
  function viewData() {
    return `
      ${topbar("Data foundation", "DOMO stays the source of truth; the app reads certified datasets rather than copying the warehouse into a vendor tool. Refresh status is visible so users know how current a view is.", "E1")}
      <div class="card" style="margin-bottom:16px">
        <h4>Lineage — read, don't restate</h4>
        <div class="card-sub">The app reads certified DOMO datasets. No warehouse copy; no second home for the challenged definition.</div>
        <div class="lineage">
          <span class="node">CCCone</span><span class="arrow">→</span>
          <span class="node">BDAP data engineering</span><span class="arrow">→</span>
          <span class="node">DOMO (source of truth)</span><span class="arrow">→</span>
          <span class="node" style="border-color:var(--brand)">Turnaround Tracker (read-only)</span>
        </div>
      </div>
      <div class="card" style="padding:6px 0 0">
        <div class="tbl-wrap"><table>
          <thead><tr><th>Dataset</th><th class="num">Rows</th><th>Latency</th><th>Certified</th><th>Last refresh</th><th>Status</th></tr></thead>
          <tbody>${DOMO_DATASETS.map((d) => `<tr>
            <td class="store-name">${d.name}</td>
            <td class="num store-meta">${d.rows}</td>
            <td class="store-meta">${d.latency}</td>
            <td>${d.certified ? `<span class="badge good"><span class="dot"></span>Certified</span>` : `<span class="badge neutral">Uncertified feed</span>`}</td>
            <td class="store-meta">${d.refreshed}</td>
            <td><span class="ds-status ${d.status.startsWith("Fresh") ? "ds-fresh" : d.status.startsWith("Stale") ? "ds-stale" : "ds-uncert"}">● ${d.status}</span></td>
          </tr>`).join("")}</tbody>
        </table></div>
      </div>
      <div class="grid two-col" style="margin-top:16px">
        <div class="callout"><span>ⓘ</span><div><b>Why numbers match the exec dashboard.</b> Revenue T12/T3 read the same certified DOMO datasets that back the executive dashboard — CPMs stop pulling it by hand each cycle.</div></div>
        <div class="callout"><span>⚠</span><div><b>Known gaps.</b> CBSA share refreshes monthly; DRP carrier scorecards arrive on an uncertified weekly feed. Both are surfaced on the record so users read them with the right currency.</div></div>
      </div>
      <div class="footer-note">Increment E1 — data foundation. Refresh status visible to users (IT ask). Investment-committee business cases load once per store (E2), owned by Finance.</div>`;
  }

  /* ---- shared UI bits ----------------------------------------------------- */
  function topbar(title, sub, epic) {
    const fresh = "06:04 ET";
    return `
      <div class="topbar">
        <div>
          <div class="h">${title} ${epic ? `<span class="epic-tag">${epic}</span>` : ""}</div>
          <div class="sub">${sub}</div>
        </div>
        <div class="pill-row">
          <span class="pill"><span class="dot"></span>DOMO fresh · ${fresh}</span>
          <span class="pill"><span class="dot"></span>Rule ${RULE.version}</span>
        </div>
      </div>`;
  }

  function kpiCard(k) {
    return `<div class="card kpi">
      <div class="label">${k.label}</div>
      <div class="value ${k.cls || ""}">${k.value}</div>
      <div class="meta">${k.meta || ""}</div>
      ${k.bar != null ? `<div class="bar-mini"><i style="width:${Math.round(Math.max(0, Math.min(1, k.bar)) * 100)}%"></i></div>` : ""}
    </div>`;
  }

  function seg(group, val, label, current) {
    return `<button data-seg="${group}" data-val="${val}" class="${current === val ? "active" : ""}">${label}</button>`;
  }
  function pct(n, d) { return d ? Math.round((n / d) * 100) + "%" : "0%"; }

  function flagBadge(s) {
    if (s.challenged) return `<span class="badge bad"><span class="dot"></span>Challenged</span>`;
    if (s.variance.t3 < -0.02) return `<span class="badge watch"><span class="dot"></span>Watch</span>`;
    return `<span class="badge good"><span class="dot"></span>On case</span>`;
  }
  function planBadge(h) {
    const map = { "At risk": "bad", Watch: "warn", "On track": "good", None: "neutral" };
    return `<span class="badge ${map[h]}"><span class="dot"></span>${h === "None" ? "No plan" : h}</span>`;
  }
  function riskBadge(r) { return `<span class="badge ${r === "High" ? "bad" : r === "Medium" ? "warn" : "neutral"}">${r} risk</span>`; }
  function statusBadge(s) {
    const map = { Done: "good", "In progress": "watch", Blocked: "bad", "Not started": "neutral" };
    return `<span class="badge ${map[s] || "neutral"}">${s}</span>`;
  }
  function askStatusBadge(s) {
    const good = s.includes("won"), closed = s.includes("Closed");
    return `<span class="badge ${good ? "good" : closed ? "neutral" : s === "Open" ? "warn" : "watch"}">${s}</span>`;
  }

  /* ---- event binding per view -------------------------------------------- */
  function bindView(v) {
    document.querySelectorAll("[data-store]").forEach((el) =>
      el.addEventListener("click", () => { planEditIndex = null; state.storeId = el.dataset.store; state.view = "store"; render(); }));
    document.querySelectorAll("[data-back]").forEach((el) =>
      el.addEventListener("click", () => { planEditIndex = null; state.storeId = null; state.view = "portfolio"; render(); }));
    document.querySelectorAll("[data-nav-link]").forEach((el) =>
      el.addEventListener("click", (e) => { e.preventDefault(); planEditIndex = null; state.view = el.dataset.navLink; state.storeId = null; render(); }));

    if (v === "store") bindStorePlan();

    if (v === "portfolio") {
      const q = $("#q");
      if (q) q.addEventListener("input", debounce((e) => { state.filters.q = e.target.value; refreshTable(); }, 180));
      const region = $("#region");
      if (region) region.addEventListener("change", (e) => { state.filters.region = e.target.value; refreshTable(); });
      const sort = $("#sort");
      if (sort) sort.addEventListener("change", (e) => { state.filters.sort = e.target.value; refreshTable(); });
      document.querySelectorAll("[data-seg]").forEach((b) =>
        b.addEventListener("click", () => { state.filters[b.dataset.seg] = b.dataset.val; renderView(); }));
    }
  }

  function bindStorePlan() {
    const store = () => STORES.find((x) => x.id === state.storeId);

    document.querySelectorAll("[data-planview]").forEach((b) =>
      b.addEventListener("click", () => { planView = b.dataset.planview; renderView(); }));

    const add = $("[data-plan-add]");
    if (add) add.addEventListener("click", () => { planEditIndex = "new"; renderView(); focusEditor(); });

    document.querySelectorAll("[data-plan-edit]").forEach((b) =>
      b.addEventListener("click", (e) => { e.stopPropagation(); planEditIndex = +b.dataset.planEdit; renderView(); focusEditor(); }));
    document.querySelectorAll("[data-plan-del]").forEach((b) =>
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        const s = store();
        s.actionPlan.steps.splice(+b.dataset.planDel, 1);
        recomputePlan(s); persistPlan(s); planEditIndex = null; renderView();
      }));

    document.querySelectorAll("[data-plan-cancel]").forEach((b) => b.addEventListener("click", closeModal));
    const save = $("[data-plan-save]");
    if (save) save.addEventListener("click", savePlan);
    const backdrop = $("[data-modal-backdrop]");
    if (backdrop) backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });
    document.removeEventListener("keydown", escClose);
    if (planEditIndex !== null) document.addEventListener("keydown", escClose);

    // Kanban cards: click / keyboard to edit, native drag-and-drop to restatus.
    document.querySelectorAll(".kcard").forEach((card) => {
      const openEdit = () => { planEditIndex = +card.dataset.cardIndex; renderView(); focusEditor(); };
      card.addEventListener("click", (e) => { if (!e.target.closest("[data-plan-edit],[data-plan-del]")) openEdit(); });
      card.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); openEdit(); } });
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.dataset.cardIndex);
        e.dataTransfer.effectAllowed = "move";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
    });
    document.querySelectorAll("[data-drop-status]").forEach((col) => {
      col.addEventListener("dragover", (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; col.classList.add("drop-over"); });
      col.addEventListener("dragleave", (e) => { if (!col.contains(e.relatedTarget)) col.classList.remove("drop-over"); });
      col.addEventListener("drop", (e) => {
        e.preventDefault(); col.classList.remove("drop-over");
        const idx = parseInt(e.dataTransfer.getData("text/plain"), 10);
        const s = store();
        if (!Number.isNaN(idx) && s.actionPlan.steps[idx] && s.actionPlan.steps[idx].status !== col.dataset.dropStatus) {
          s.actionPlan.steps[idx].status = col.dataset.dropStatus;
          recomputePlan(s); persistPlan(s); renderView();
        }
      });
    });
  }

  function savePlan() {
    const btn = $("[data-plan-save]");
    if (!btn) return;
    const get = (f) => { const el = document.querySelector(`[data-f="${f}"]`); return el ? el.value.trim() : ""; };
    const titleEl = document.querySelector('[data-f="title"]');
    if (!titleEl || !titleEl.value.trim()) { if (titleEl) { titleEl.classList.add("invalid"); titleEl.focus(); } return; }
    const s = STORES.find((x) => x.id === state.storeId);
    const step = { title: get("title"), owner: get("owner"), due: get("due") || "2026-08-15",
      status: get("status"), risk: get("risk"), overdue: false };
    const idx = btn.dataset.index;
    if (idx === "new") s.actionPlan.steps.push(step);
    else s.actionPlan.steps[+idx] = step;
    recomputePlan(s); persistPlan(s); closeModal();
  }

  function closeModal() { planEditIndex = null; document.removeEventListener("keydown", escClose); renderView(); }
  function escClose(e) { if (e.key === "Escape") closeModal(); }

  function focusEditor() {
    const t = document.querySelector('.modal-body [data-f="title"]');
    if (t) { t.focus(); t.setSelectionRange(t.value.length, t.value.length); }
  }

  function refreshTable() {
    // re-render just the table + toolbar region to preserve focus feel
    renderView();
    const q = $("#q");
    if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
  }

  function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

  /* ---- boot --------------------------------------------------------------- */
  loadPlanOverrides();
  render();
})();
