# Rebound - Shop performance recovery (prototype)

A clickable prototype of an internal Boyd Group application, working name
**Rebound**. It holds each shop's KPI targets against actuals and gives Client
Performance Managers (CPMs) the tools to spot off-target stores, diagnose why,
and build and track a recovery action plan on the same record.

> **Naming note.** The original spec used the working name *CRM (Client Recovery
> Manager)*, which collides with the industry meaning of *customer relationship
> management* - Boyd almost certainly already runs one, and stakeholders would
> assume this is a sales tool. It has been renamed **Rebound** (a store bouncing
> back to plan) to avoid that collision. The name is still a working title;
> confirm it before anything ships.

This is a demo-and-feedback prototype. It is **not** a pilot, connects to **no**
real systems, and writes back nowhere.

## Run it

```bash
npm install && npm run dev
```

Then open the printed local URL. Other scripts:

- `npm run build` - type-check and produce a production build.
- `npm test` - run the unit tests for the challenged-store rule.

## Stack

Vite + React + TypeScript, Tailwind CSS, Recharts, React Router. No state
library (React state + context), no backend, no database. All state lives in
memory and resets on a hard reload.

## What's mocked

**Everything.** There is no DOMO, BDAP, or CCCone connection. All data is
generated locally at startup by a **seeded deterministic generator**
(`src/mock/generator.ts`, seed in `src/seed.ts`), so screenshots reproduce
across reloads and machines. The real application would read from **DOMO**
(metrics and exec dashboard) and **BDAP** (upstream of DOMO, fed by **CCCone**);
both are simulated here. Each screen showing a DOMO-derived number can name its
source dataset and say how current it is (all timestamps are mocked too).

The generated world: 345 stores (205 Boyd, 140 JHCC) grouped into 12 regions
under 3 divisions (North, South, West), 60 CBSAs, 14 carriers (9 DRP), and 36
months of history ending at the current month. Roughly 18-22% of stores are
currently challenged (a struggling Gulf Region concentrates some of them), about
60% of challenged stores have an action plan, and the data deliberately plants
the patterns the demo needs to find (distinct root-cause signatures, carrier-
and region-level underperformance, DRP-volume vs revenue splits, internal vs
external rules divergence, carrier volume anomalies, a "Not loaded" baseline
gap, and tasks whose target metric improved, didn't move, or got worse).

Two manager roles are modeled. A **Shop Performance Manager (SPM)** owns a book
of shops (the shop's owner, and the primary Rebound user who builds recovery
plans); a few shops are left unassigned so the "percent of shops with an
assigned SPM" metric has something to show. A **Client Performance Manager
(CPM)** owns one DRP carrier within one division (9 DRP carriers x 3 divisions =
27 seats, a few vacant), so a CPM's book is the shops that trade their carrier
in their division. The store record shows the shop's SPM and lists the CPM for
every DRP carrier it trades. Both are switchable in the role menu.

## Screens

- **Portfolio** (`/`) - the SPM's book, challenged shops first. The list *is*
  the identification step; no hunting.
- **Store record** (`/store/:id`) - everything about one shop: baseline,
  performance chart with per-task markers, why-flagged, diagnosis, client/DRP
  breakdown, ownership continuity, and the action plan.
- **Plan editor** (`/store/:id/plan`) - structured, typed tasks with the metrics
  they are meant to move, owners, tags, risks, and sales asks.
- **Analysis** (`/analysis`) - forecast vs actual with a carrier / region / shop
  / carrier-in-region pivot, root-cause comparison, and a shop-vs-market view.
- **Benchmarking** (`/benchmarking`) - KPI movement vs plan activity, before/
  after per task, and aggregate outcome by task type.
- **Carriers** (`/carriers`) - DRP scorecards, assignment volume vs forecast,
  anomalies, and scorecard-driver weighting per carrier.
- **Roll-up** (`/roll-up`) - region and executive roll-up, application metrics,
  brand split.
- **Alerts** (`/alerts`) - the proactive alert queue.

Use the **role switcher** in the header (CPM / RVP / Shop GM / Executive) to
change the visible scope and landing screen.

## The challenged-store rule

A single pure function with a version string
(`src/logic/challengedRule.ts`, `RULE_VERSION = 'v2.1'`), unit-tested in
`src/logic/challengedRule.test.ts`. Prototype thresholds (labelled in the UI as
placeholders): T3 revenue below 90% of plan, or T12 below 95%, or DRP volume
below 90% of forecast on a carrier over 20% of revenue, or a Watch/At-risk DRP
tier on such a carrier, or capture rate below 60% for two consecutive months.
Every flag records its reasons down to the metric, value, and threshold.

## Open questions (surfaced in the UI, not resolved in code)

These are deliberately left visible where they bite, to generate the right
conversation in a demo:

- **Challenged-rule thresholds** are placeholders pending sign-off from Finance
  and Client Performance Management.
- **Business case numbers** may exist only in memos and workbooks - the "Not
  loaded" baseline state (some JHCC stores have no RO plan) is deliberate.
- **DRP scorecard data at competitor granularity** may not be licensable; that
  table is marked as dependent on an unconfirmed source.
- **JHCC stores** may not share a comparable metric set with the legacy 205.
- **The app name** was changed from the placeholder *CRM* to **Rebound** to
  avoid the customer-relationship-management collision; it is still a working
  title, so confirm it before anything ships.
- **Estimate accuracy, rules adherence, central review, quality recommendation,
  and supplement counts** may not be available at store and carrier grain in
  DOMO today.
- **Internal vs external rules adherence** may not be separable in the source
  systems; the prototype assumes it is (and keeps them separate everywhere
  because they point at different fixes). Confirm before the split is
  load-bearing.
- **Forecast DRP assignment volume** may not exist as a published number the way
  revenue forecast does. Confirm who owns it.
- **The `TaskType` taxonomy** is a first pass drawn from examples - validate it
  with CPMs before it becomes fixed. A wrong list is worse than free text.

## Application metrics

Surfaced on the roll-up screen with targets left as **TBD**: percent of shops
with an assigned CPM (expected to decrease), percent of challenged shops meeting
targets (expected to increase), percent of action plan tasks on track, plus
supporting operational metrics (rental days, total cost of repair, estimate
accuracy, percent supplements).
