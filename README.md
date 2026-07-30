# Challenged Shop Turnaround Tracker, Prototype

An interactive, click-through prototype of the in-house app described in the
**Challenged Shop Turnaround Tracker** opportunity canvas. It puts one record
per store, carrying the investment-committee **business-case baseline**, live
**DOMO actuals**, an auditable **challenged flag**, the **deficiency/carrier
analysis**, the **action plan and sales ask**, and **progress from the action
date**, behind a single portfolio roll-up.

> Scope modeled: **205 investment-committee stores + 140 JHCC stores = 345**,
> each measured against the business case in its IC memo. Direction: build in
> house on Boyd's stack; **DOMO stays the source of truth and the app reads it.**

## Run it

No build step. It's static HTML/CSS/vanilla JS.

```bash
# from the repo root
python3 -m http.server 8099
# then open http://localhost:8099
```

Or just open `index.html` directly in a browser.

## What to click

Use the **Viewing as** persona switcher (bottom-left) to see the app from each
target customer's seat, CPM (primary), RVP (region-scoped), Shop GM (single
store), Sales, Finance, Executive. Then walk the nav:

| View | Increment | What it shows |
|------|-----------|---------------|
| **Portfolio** | E6 / E3 | KPI roll-up + every store ranked by gap to business case, with live plan health, T12/T3 variance, and a trend sparkline. Filters by cohort, region, status. |
| **Store record** (click any row) | E2 / E3 / E5 / E6 | Plan-vs-actual charted from the action date; the exact rule reasons the store was flagged; action plan (owners, dates, risks); sales asks + past activity; deficiency mini-view; DRP scorecard. |
| **Slippage alerts** | E6 | Business-case slippage caught at the first missed period (headline), plus DRP rank drops and overdue action items. |
| **Deficiency analysis** | E4 | Revenue by client/DRP, PIF counts, CBSA share, and DRP scorecard slippage, the analysis that gets rebuilt every cycle, built once. "Market" vs "Shop" read per store. |
| **Challenged rule** | E3 | The versioned challenged definition, per-criterion flag counts, and version history so a definition change never silently restates history. |
| **Data foundation** | E1 | DOMO lineage (CCCone → BDAP → DOMO → app, read-only), certified-dataset status, and refresh currency. |

## How it maps to the canvas increments

- **E1, Data foundation.** `Data foundation` view shows the read-only lineage,
  certified DOMO datasets, latency, and refresh status. The app **reads**
  certified datasets; it does not restate the warehouse.
- **E2, Business-case baseline.** Every store carries its IC memo numbers
  (`memoRef`, target monthly revenue, ARO, car count) as the plan actuals are
  measured against, JHCC stores on the same baseline model as the ~205 cases.
- **E3, Challenged detection.** A versioned, auditable rule (`v2.3`) flags
  stores automatically; each flag records the specific metric and period, shown
  on the store record and rolled up on the `Challenged rule` view.
- **E4, Deficiency & carrier analysis.** One analysis view: revenue by client
  and DRP, PIF counts, CBSA market share, and DRP scorecard standing vs area
  competitors.
- **E5, Action plan & sales ask.** The plan lives on the store record, steps,
  owners, dates, risks, plus sales asks routed to Sales and past client
  activity on the same record.
- **E6, Progress, alerting, roll-up.** Each metric charts from the action date;
  slippage alerts fire at the first missed period; the portfolio ranks stores by
  gap to business case with plan health across markets.

## About the data

All records are **synthetic** and generated deterministically from a fixed seed
(`assets/js/data.js`), so the prototype looks identical on every load. No real
Boyd data, no customer or employee PII. In the production build these records are
read from certified DOMO datasets and the loaded IC business cases, this
prototype simulates that read locally.

Roughly **48% of the modeled portfolio flags as challenged** under the demo rule
thresholds, tune `RULE.criteria` and the posture bands in `data.js` to explore
other definitions.

## Project layout

```
index.html              # entry point
assets/css/styles.css   # theme (light + dark), layout, components
assets/js/data.js       # seeded mock portfolio + DOMO dataset status + rule
assets/js/charts.js     # inline-SVG charts (plan-vs-actual, bars, sparklines, rank pills)
assets/js/app.js         # router, persona switching, all views
```

## Not in this prototype (deliberately)

This is a UI/UX and data-model prototype to align stakeholders, it is **not**
wired to DOMO, has no auth, and persists nothing. The canvas's open questions
(who loads the business-case numbers, DOMO latency/certification/read pattern,
PIF/CBSA/DRP licensing and granularity, IT sizing of the in-house build) are the
next steps before implementation.
