# FIELDIQ 4.1 — Operations Intelligence

**A product-style operations intelligence demonstration for heavy-equipment dealership workflows.**

FIELDIQ brings service, parts, rental, and fleet signals into one explainable operating experience. It is designed around a simple user journey: understand the operating picture, choose an operational playbook, inspect the records, test a target, and create a clear team huddle brief.

> **Independence and data notice:** FIELDIQ is a self-directed portfolio demonstration inspired by heavy-equipment dealership workflows. It is not affiliated with, endorsed by, or connected to HOLT Group. All records and measures are synthetic and do not represent HOLT data, customers, employees, assets, or performance.

## Start here

1. **Overview** — get the executive picture, key KPIs, branch comparisons, and service trends.
2. **Operations Playbook** — choose a service, parts, or fleet workflow; inspect the highest-signal records; work through suggested team checks; and copy a huddle brief.
3. **Decision Studio** — explore operational signals, adjust what-if targets, see the arithmetic gap, and copy a leadership-ready discussion brief.
4. **Operations Explorer** — search and export the service, parts, rental, and equipment records behind the measures.
5. **Semantic Model** — inspect fact-table grain, conformed dimensions, relationships, and plain-language metric definitions.
6. **Data Quality** — review the validation checks executed by the reproducible pipeline.
7. **Data Lineage** — trace selected measures from source fields through Gold transformations to the dashboard.
8. **AI Analyst** — ask questions against a constrained set of documented metrics and inspect the formula and caveat returned.
9. **Role Alignment / Architecture** — inspect implementation evidence, engineering decisions, and the production boundary.

## Product experience highlights

- **One operating picture:** branch-aware KPIs, service revenue and intake trends, queue composition, parts fill, rental revenue, and fleet utilization.
- **Operations Playbook:** service queue, parts fulfillment, and fleet deployment playbooks with record-level evidence, team questions, a checkable huddle list, and copyable briefing. The playbooks are review aids, not automated recommendations.
- **Decision Studio:** three cross-functional operational signal cards; an interactive scenario workbench for parts fill, backlog reduction, and fleet utilization targets; a calculated gap analysis; and a copyable meeting brief.
- **Explainable scenarios:** controls calculate target gaps directly from the current scope. They do not claim that one KPI causes another, forecast revenue, predict dates, or promise operational outcomes.
- **Explore the evidence:** multi-entity search, filters, and CSV export for service work orders, parts orders, rental contracts, and equipment.
- **Shared definitions:** metric descriptions, formulas, fact grain, ownership, caveats, and model relationships are visible to business and technical reviewers.
- **Traceability:** interactive source-to-consumption paths for service revenue, parts fill rate, and fleet utilization.
- **Constrained analyst:** deterministic question-to-metric routing; no LLM, arbitrary SQL execution, or unsupported answer generation.
- **Responsive experience:** desktop and mobile navigation and layouts.

## Data and engineering foundation

- Deterministic synthetic source generator and Bronze → Silver → Gold transformations in Python / Pandas.
- Seven Gold tables: three dimensions and four facts, including `fact_fleet_day` at one row per equipment asset per calendar day.
- Ten executable quality checks, with observed results embedded in the web snapshot.
- SQL examples, semantic model specification, DAX measure starters, branch RLS design notes, and a Fabric PySpark validation notebook starter.
- Pytest suite and GitHub Actions workflow.

## Modeled data coverage

- Period: **2025-01-01 through 2025-11-17** (321 calendar days)
- 5 Texas branches: San Antonio, Austin, Dallas, Fort Worth, and Waco
- 480 service work orders
- 90 equipment assets
- 250 rental contracts
- 320 parts orders
- 28,890 equipment-day rows in `fact_fleet_day` (90 assets × 321 days)

All generated records use deterministic seed `58`.

## Important metric definitions

| Metric | Definition | Important limitation |
|---|---|---|
| Service revenue | Sum of labor + parts revenue for closed work orders | Synthetic modeled revenue, not audited accounting revenue |
| Open service backlog | Count of work orders whose status is not Closed | Count only; no monetary valuation or SLA breach logic |
| Average days to close | Average `days_open` for closed work orders | Generated elapsed days; excludes open work orders |
| Parts fill rate | Total fulfilled units ÷ total requested units | Weighted by units; not an order-line on-time fill measure |
| Modeled rental revenue | Rental days × daily rate | Not an invoice or recognized accounting amount |
| Fleet utilization | Unique rented asset-days ÷ modeled available asset-days | Every asset-day is assumed available; maintenance and out-of-service time are not modeled |

`fact_fleet_day` has a grain of one equipment asset per calendar day. If overlapping contracts exist for the same asset-day, the day counts once as rented. This avoids double-counting utilization, but it does not replace an effective-dated availability model with maintenance and downtime states.

## Rebuild the data and run tests

Requires Python 3.10+.

```bash
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python scripts/build_pipeline.py
pytest -q
```

The pipeline regenerates `data/bronze`, `data/silver`, `data/gold`, and `public/data/operations.json`.

## Run the web application

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open http://localhost:3000. For a production build, run `npm run build`. `npm run lint` runs the TypeScript compiler in no-emit mode.

## Technical implementation boundary

**Implemented in this repository:** deterministic Python data generation; Bronze / Silver / Gold CSV layers; seven Gold tables; ten executed quality checks; multi-entity web explorer; branch-aware scorecard; Decision Studio scenarios and briefing; Operations Playbook with three evidence-led team huddles; metric catalog; three KPI lineage paths; deterministic analyst prototype; tests; GitHub Actions workflow.

**Starter / design assets:** SQL examples require source/platform adaptation; DAX is a measure library, not a published semantic model; RLS / OLS are documented patterns, not active enforcement; Fabric notebook is a starter and has not run in a Fabric workspace; no Power BI report or semantic model is published.

**Not claimed:** no HOLT system access, no live operational data, no real-time integration, no production identity/security, no Fabric Lakehouse deployment, no published Power BI semantic model, and no LLM-backed analyst.

## Deploy to Vercel

The committed JSON snapshot allows the Next.js app to build without Python or a database at Vercel build time.

- Framework preset: Next.js
- Install command: `npm install`
- Build command: `npm run build`
- Environment variables: none required for this demo

The Python pipeline runs locally or in a separate scheduled environment. Vercel does not execute it automatically.

## Suggested five-minute walkthrough

1. **Lead with the product:** explain how service, parts, rental, and fleet signals are presented together.
2. **Open Operations Playbook:** choose a workflow, inspect the evidence, work through the team checklist, and copy the huddle brief.
3. **Open Decision Studio:** move the scenario sliders, explain the calculated target gaps, and copy the leadership brief.
4. **Prove the numbers:** inspect the matching records in Operations Explorer.
5. **Explain trust:** show metric definitions, grain, quality checks, and lineage.
6. **Discuss engineering:** explain the Bronze / Silver / Gold pipeline and how the semantic model could be operationalized in Fabric / Power BI.

Keep the synthetic-data notice visible during the walkthrough. The demo illustrates a product concept and engineering implementation; it is not a live operational system.
