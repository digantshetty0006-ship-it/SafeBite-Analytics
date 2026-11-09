# SafeBite — Risk Intelligence, Business Analytics & Decision Support

SafeBite is a food-safety platform with role-based experiences for citizens,
business owners and Food Safety Officers. This repository is the
**analytics-enhanced copy** of the Smart India Hackathon 2026 project. It adds a
governed BI workspace on top of the existing application without changing the
original live deployment.

**Original live demo (untouched):** <https://safebite-demo.vercel.app>

> **Demo and data notice.** The seeded dataset is synthetic. Nothing here is
> official government statistics or a regulatory determination, and no
> endorsement by FSSAI, Maharashtra FDA or any government body is implied.
>
> Risk scores are **deterministic weighted policy rules**, not a trained
> machine-learning model, not a forecast, and not a probability of illness.

---

## 1. What this delivery adds

- A **13-KPI** decision-support workspace with equal-length previous-period
  comparisons, direction-aware favourable/adverse labels, sparklines and trends.
- **Global filters** for period, district, category, risk tier, complaint status,
  inspection status and trend grouping, applied consistently to every view and
  export.
- An **explainable risk register**: score, tier, 30-day movement, factor points
  against policy budgets and the top driver for every premises.
- **District comparison** across premises, high-risk count, average risk,
  inspections, findings, complaints, resolutions and overdue backlog.
- **Data quality**: 20 real validation rules with affected records, links,
  severity, recommendations and explicit false-positive controls.
- **Process analytics**: complaint stage medians/averages/p90, funnel,
  inspection completion, overdue backlog and turnaround — with unavailable
  stages named rather than estimated.
- **Reports**: seven filtered CSV exports and a management PDF summary.
- **SQL library**: 26 documented queries in SQLite and PostgreSQL dialects with
  bound parameters.
- **Power BI**: 11 CSV extracts, star-schema documentation and DAX measures.
- **Python toolkit**: KPI reproduction, risk views, quality reconciliation and a
  14-check self-test.
- **Documentation**: BRD, stakeholders, user stories, acceptance criteria, KPI
  definitions, data dictionary, process analysis, architecture, testing strategy
  and roadmap.
- **Automated tests**: 31 Node tests covering risk, periods, KPIs, CSV safety and
  anonymity rules.

The original SafeBite features — citizen complaint portal, officer queue,
inspection workflow, map, business-owner dashboard and legacy analytics — remain
available.

---

## 2. Routes

| Route | Purpose | Access |
| --- | --- | --- |
| `/` | Public landing page | Public |
| `/login` | Role-based demo login | Public |
| `/citizen/**` | Complaint submission and tracking | Citizen |
| `/owner/**` | Business-owner dashboard | Business owner |
| `/officer/dashboard` | Officer home | Food Safety Officer |
| `/officer/queue`, `/officer/schedule`, `/officer/inspection/[id]` | Operational workflow | Food Safety Officer |
| `/officer/map`, `/officer/suppliers`, `/officer/history` | Operational views | Food Safety Officer |
| `/officer/analytics` | **Legacy analytics, preserved** | Food Safety Officer |
| `/officer/intelligence` | **BI overview: 13 KPIs, trends, districts, top risk** | Food Safety Officer |
| `/officer/intelligence/risk` | **Risk register and factor drill-down** | Food Safety Officer |
| `/officer/intelligence/quality` | **20-rule data-quality report** | Food Safety Officer |
| `/officer/intelligence/process` | **Complaint and inspection process metrics** | Food Safety Officer |
| `/officer/intelligence/reports` | **CSV downloads and PDF summary** | Food Safety Officer |
| `/officer/intelligence/methodology` | **Definitions, weights, caveats** | Food Safety Officer |
| `/officer/intelligence/export/[report]` | **CSV export endpoint** | Food Safety Officer |

The workspace is read-only. Lifecycle timestamps and risk snapshots are written
by the existing complaint and inspection actions.

---

## 3. Demo credentials

| Role | Email | Password |
| --- | --- | --- |
| Food Safety Officer | `officer@demo.in` | `demo1234` |
| Citizen | `citizen@demo.in` | `demo1234` |
| Business Owner | `owner@demo.in` | `demo1234` |

Analytics is restricted to the Food Safety Officer role. Citizens and business
owners cannot open the intelligence routes or download exports.

---

## 4. Quick start

### Prerequisites

- Node.js 22+ (the demo was verified with Node 22.23.4)
- npm 10+
- Python 3.11+ with `pandas` and `numpy` (only for the Python toolkit)

### Install and run

```bash
npm install
npx prisma migrate dev      # creates SQLite dev.db and applies migrations
npx prisma db seed          # loads the deterministic synthetic demo dataset
npm run dev -- -p 3100
```

Open <http://localhost:3100>, sign in as the officer and choose
**Intelligence & BI** in the sidebar.

Copy `.env.example` to `.env` if needed:

```env
DATABASE_URL="file:./dev.db"
AUTH_SECRET="replace-with-a-long-random-secret"
```

On Windows PowerShell in this environment, the portable Node bin directory must
be on `PATH` and `npm.cmd` used instead of `npm`:

```powershell
$env:Path = "C:\Users\Sejal\AppData\Local\Programs\nodejs-portable\node-v22.23.4-win-x64;$env:Path"
npm.cmd run dev -- -p 3100
```

---

## 5. Exact verification commands

Run from the repository root unless stated otherwise.

```bash
# 1. Reset the demo data (restores the deliberate quality anomalies)
npm run db:seed

# 2. Regenerate the Power BI / Python CSV extracts
npm run analytics:datasets

# 3. Type checking
npx tsc --noEmit

# 4. Lint (28 pre-existing warnings, no errors)
npm run lint

# 5. Automated tests (31 passing)
npm test

# 6. Production build (SQLite client)
npm run build

# 7. SQL library validation (26/26 queries)
npm run analytics:sql:validate

# 8. Server-side KPI smoke check
npm run analytics:smoke

# 9. Run the SQL library (all queries, 90-day window)
npm run analytics:sql -- all

# 10. Run one query with explicit boundaries
npm run analytics:sql -- run kpi_sla_compliance --from 2026-08-11 --to 2026-11-09
```

Python toolkit, from `analytics/python`:

```bash
py -m pip install -r requirements.txt

py -m safebite_analytics --data-dir ..\..\public\powerbi info
py -m safebite_analytics --data-dir ..\..\public\powerbi kpis --period last90
py -m safebite_analytics --data-dir ..\..\public\powerbi risk --top 10
py -m safebite_analytics --data-dir ..\..\public\powerbi quality
py -m safebite_analytics --data-dir ..\..\public\powerbi self-test
```

PostgreSQL build (requires a PostgreSQL `DATABASE_URL`):

```bash
npm run build:pg
```

---

## 6. The 13 governed KPIs

| ID | KPI | Unit | Direction |
| --- | --- | --- | --- |
| `registered_businesses` | Registered businesses (non-closed) | count | neutral |
| `high_risk_premises` | High-risk premises (tiers C + D) | count | down |
| `average_risk_score` | Average risk score | score | down |
| `inspections_completed` | Inspections completed | count | up |
| `inspection_completion_rate` | Inspection completion rate | percent | up |
| `critical_violations` | Critical violations | count | down |
| `violations_per_inspection` | Violations per inspection | rate | down |
| `repeat_violation_rate` | Repeat violation share | percent | down |
| `complaints_received` | Complaints received | count | neutral |
| `complaints_resolved` | Complaints resolved (valid lifecycles only) | count | up |
| `average_resolution_days` | Average resolution time | days | down |
| `sla_compliance` | Complaint SLA compliance | percent | up |
| `overdue_open_complaints` | Overdue open complaints | count | down |

Definitions, formulas and caveats are in
[docs/kpi-definitions.md](docs/kpi-definitions.md) and in the in-app methodology
page. The full catalogue is implemented once in
`src/lib/analytics/kpis.ts` and mirrored in SQL, Power BI and Python.

### Period semantics

- Presets: last 7/30/90 days, current month, previous month, custom range.
- User-facing boundaries are **Asia/Kolkata (UTC+05:30)**; stored timestamps are
  UTC.
- The previous period is the immediately preceding window of **equal length**,
  not the previous calendar month unless the selected period is a month.
- Event KPIs use `[start, end)`; snapshot KPIs use the latest `RiskSnapshot` on or
  before the period end.
- Historical risk never falls back to today's register. Premises without a
  snapshot are unrated.

---

## 7. Risk scoring: explainable, deterministic, not ML

| Factor | Max points | Rule |
| --- | --- | --- |
| Previous violations | 40 | Severity weight (`critical` 10, `high` 6, `medium` 3, `low` 1) × `0.95 ^ months` decay, capped. |
| Recent complaints | 25 | Complaints in the last 90 days: submitted 4 points, in-review/substantiated 7 points, capped. |
| Inspection timeliness | 15 | `max(0, months since last completed inspection - 6) × 2.5`; never inspected = 15; a scheduled follow-up mitigates 4 points. |
| Document compliance | 10 | Expired documents 4 points each, capped; no documents on file = 4. |
| Category baseline | 10 | Policy baseline by business category (street vendor 9 … packaged retail 3). |

The total is capped at 100 and maps to tiers: **A ≤ 25**, **B ≤ 50**, **C ≤ 75**,
**D > 75**. The function takes an explicit `asOf`, so the same input reproduces
the same output. Every score carries a factor breakdown and plain-language
explainers.

This is a **policy score**, not a prediction. Do not describe it as trained,
predictive, or a probability of illness.

---

## 8. Data quality

Twenty documented rules cover complaints, inspections, businesses, documents,
risk snapshots and supplier master data. Key controls:

- **Legitimate anonymous complaints are never flagged.** The only anonymity
  finding is `anonymous = true AND citizenId IS NOT NULL`.
- **Expired documents are a regulatory follow-up**, not a data-quality defect.
- **Impossible complaint lifecycles are excluded** from resolution/SLA metrics and
  reported as findings.
- **No auto-repair.** Findings link to the affected record.
- **Rule-based score.** Each failing rule deducts once: critical 6, high 4,
  medium 2, low 1. Grades: Healthy ≥ 95, Good ≥ 85, Watch ≥ 70, otherwise Needs
  attention.

The seed deliberately creates a small number of defects so the page is meaningful
in the demo. Reseeding restores them.

---

## 9. Process analytics

Measured from real timestamps:

- Receipt → assignment (**proxy for acknowledgement** — no acknowledgement field
  exists)
- Assignment → investigation start
- Investigation → inspection
- Last casework stage → resolution
- Receipt → resolution
- Inspection completion, overdue backlog, missed inspections and planned-date to
  completion turnaround

Each stage shows reached count, valid sample size, median, average and p90 in
calendar days. Negative or out-of-order durations are excluded and counted.

**Unavailable and named:** true acknowledgement, on-site inspection duration and
travel, report approval/publication, laboratory turnaround, enforcement/case
closure and business registration approval. These are schema gaps, not estimates.
See [docs/process-analysis.md](docs/process-analysis.md).

---

## 10. Reports and exports

CSV report types: `summary`, `risk`, `districts`, `complaints`, `inspections`,
`quality`, `process`.

- Exports respect the active filters and the same role check as the page.
- CSV output is UTF-8 with a BOM, CRLF line endings and quoted cells.
- Cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed
  with an apostrophe to prevent spreadsheet formula injection.
- Filenames include report type, district slug and date.
- The PDF management summary includes period, comparison period, filters,
  generated-by user, KPI table, district table, top risks, notes and disclaimer.

Privacy: no complaint narrative, citizen identity, email or password hash is
included in any export or extract.

---

## 11. SQL analytics library

```
analytics/sql/queries.sqlite.sql
analytics/sql/queries.postgres.sql
analytics/sql/README.md
scripts/run-sql.ts
scripts/validate-sql.ts
scripts/sql-lib.ts
```

26 documented queries: the 13 KPIs, risk tier distribution/history/movers,
district scorecard, inspection turnaround and backlog, complaint stage durations,
complaint type and violation severity distributions, lifecycle anomalies,
duplicate licences, supplier coverage and expired documents.

- Identical query names, parameters and result columns in both dialects.
- Named parameters are bound by Prisma; user input is never concatenated.
- `:limit` is clamped to 1–1000.
- `npm run analytics:sql:validate` checks parity, columns and execution against
  the seeded database.

---

## 12. Power BI

Extracts are written to `public/powerbi/` by `npm run analytics:datasets`:

| File | Grain | Rows (seeded) |
| --- | --- | --- |
| `dim_business.csv` | One row per business | 56 |
| `dim_date.csv` | One row per calendar date (2024–2027) | 1,461 |
| `dim_officer.csv` | One row per officer | 4 |
| `fact_inspections.csv` | One row per inspection | 90 |
| `fact_violations.csv` | One row per violation | 120 |
| `fact_complaints.csv` | One row per complaint | 78 |
| `fact_risk_snapshots.csv` | One row per snapshot | 336 |
| `kpi_definitions.csv` | One row per governed KPI | 13 |
| `data_quality_findings.csv` | One row per rule result | 20 |
| `district_scorecard.csv` | One row per district | 6 |
| `dataset_manifest.csv` | One row per extract file | 11 |

Documentation: [docs/powerbi/README.md](docs/powerbi/README.md),
[docs/powerbi/data_model.md](docs/powerbi/data_model.md) and
[docs/powerbi/dax_measures.md](docs/powerbi/dax_measures.md).

These are **static extracts**, not a live connection. There are no database
credentials in the repository. Re-run the export after any seed or data change.
DAX measures are documented and reviewed; they have not been executed in Power BI
Desktop or CI.

---

## 13. Python toolkit

```
analytics/python/safebite_analytics/
  loader.py     typed CSV loading, risk bands, weights
  kpis.py       13 governed KPIs, IST-aware periods, comparisons
  risk.py       tiers, ranking, factor profile, districts, movers, history
  quality.py    17 extract-evaluable rules + app-export reconciliation
  cli.py        info / kpis / risk / quality / self-test commands
  selftest.py   assertions against the real extracts
  __main__.py   `py -m safebite_analytics`
analytics/python/notebooks/safebite_exploration.ipynb
analytics/python/README.md
```

Highlights:

- Converts IST day boundaries to UTC before filtering, matching the dashboard.
- Uses the latest snapshot on or before the as-of date; never back-fills history.
- Marks three quality rules (checklist, documents, suppliers) as **not evaluable**
  from the extract instead of reporting a false pass.
- Proves the anonymous-complaint false-positive control with both a legitimate
  and a contradictory synthetic case.
- Current self-test: **14 passed, 0 failed**.

---

## 14. Tests

```
npm test
```

31 tests across five files:

| File | Tests | Coverage |
| --- | --- | --- |
| `tests/risk.test.ts` | 9 | Tier bands, weights, decay, caps, reproducibility, baselines. |
| `tests/filters.test.ts` | 8 | IST/UTC boundaries, presets, custom ranges, grouping, parsing. |
| `tests/kpis.test.ts` | 5 | 13 KPIs, event windows, repeat logic, invalid lifecycles, snapshots. |
| `tests/reports.test.ts` | 4 | CSV injection guard, quoting, BOM/CRLF, filenames. |
| `tests/quality.test.ts` | 5 | 20 rules, anonymity false-positive control, rule catalogue. |

Additional validation: `npm run analytics:sql:validate` (26/26),
`npm run analytics:smoke`, and the Python self-test (14/14).

---

## 15. Changed files and directories

The work is isolated in this `SafeBite-Analytics` workspace. Major additions and
changes:

**Database and data**

- `prisma/schema.prisma`, `prisma/schema.pg.prisma` — business status, complaint
  lifecycle timestamps, `RiskSnapshot`, analytics indexes.
- `prisma/migrations/20261108131325_analytics_upgrade/` — migration for both.
- `prisma/seed.ts` — deterministic synthetic data, lifecycle/SLA timestamps,
  historical complaints, deliberate quality anomalies, monthly risk snapshots.

**Analytics engines**

- `src/lib/risk.ts`, `src/lib/risk-service.ts` — deterministic explanation,
  reproducible `asOf`, snapshot history.
- `src/lib/analytics/types.ts`, `filters.ts`, `data.ts`, `kpis.ts`, `reports.ts`
  — server-side dataset, periods, 13 KPIs, comparisons, trends, districts, CSV/PDF
  payloads.
- `src/lib/quality.ts` — 20 rules and `isAnonymityConflict`.
- `src/lib/process.ts` — stage metrics, funnel, inspection turnaround, unavailable
  stages.

**Application**

- `src/app/(app)/officer/intelligence/` — layout, overview, risk, quality,
  process, reports, methodology and `export/[report]` route.
- `src/components/intelligence/` — filter bar, KPI cards, charts, risk table,
  district table, nav, PDF button.
- `src/app/(app)/officer/complaints-actions.ts` and
  `src/app/(app)/officer/inspection/actions.ts` — lifecycle timestamps, risk
  recalculation, forced snapshots, BI revalidation.
- `src/components/app-shell.tsx` — sidebar "Intelligence & BI" entry. Legacy
  `/officer/analytics` remains unchanged.
- `src/app/layout.tsx`, `src/lib/i18n.ts` — remove predictive/ML wording from
  metadata and home copy; describe explainable, deterministic risk prioritisation.

**Analyst tooling**

- `analytics/sql/` — both dialects and README.
- `scripts/run-sql.ts`, `scripts/validate-sql.ts`, `scripts/sql-lib.ts`,
  `scripts/analytics-smoke.ts`, `scripts/export-powerbi.ts`.
- `analytics/python/` — toolkit, requirements, notebook and README.
- `public/powerbi/` — generated extracts (regenerate, do not hand-edit).

**Tests and configuration**

- `tests/*.test.ts` — five suites, 31 tests.
- `package.json`, `package-lock.json` — analytics scripts and `test`.
- `eslint.config.mjs` — keeps lint focused on correctness for pre-existing
  components and legacy scripts.
- `prisma/migrations/migration_lock.toml` — migration provider lock.
- `scripts/load-env.ts` — shared environment loader for the analytics scripts.
- `.env.example` — SQLite, PostgreSQL example and `AUTH_SECRET`.
- `README.md` — this document.

**Documentation**

- `docs/README.md`, `docs/BRD.md`, `docs/stakeholders.md`,
  `docs/user-stories.md`, `docs/acceptance-criteria.md`,
  `docs/kpi-definitions.md`, `docs/data-dictionary.md`,
  `docs/process-analysis.md`, `docs/architecture.md`,
  `docs/testing-strategy.md`, `docs/roadmap.md`.
- `docs/powerbi/README.md`, `docs/powerbi/data_model.md`,
  `docs/powerbi/dax_measures.md`.
- `analytics/sql/README.md`, `analytics/python/README.md`.

---

## 16. Stack

Next.js 16 (App Router, Turbopack) · React 19 · Tailwind CSS v4 · shadcn/ui ·
Prisma 7 + SQLite (PostgreSQL schema provided) · Recharts · react-leaflet ·
jsPDF · Node test runner · pandas/numpy.

---

## 17. Limitations

1. **Synthetic demo data.** Values move when the seed is rerun on another date.
   Not official statistics; no government endorsement.
2. **Deterministic policy score, not ML.** No trained model, no forecast, no
   probability of illness.
3. **SQLite is the local store.** PostgreSQL is provided structurally but not
   exercised by the local demo runtime.
4. **Missing lifecycle stages.** No true acknowledgement, on-site duration,
   laboratory, report-approval or enforcement timestamps. Those stages are named
   as unavailable, not estimated.
5. **Calendar days.** SLA and duration metrics use calendar days, not business
   days.
6. **Current business status only.** Historical status changes are not modelled.
7. **Static BI extracts.** Power BI and Python read generated CSVs; re-run
   `npm run analytics:datasets` after data changes.
8. **DAX not executed.** Power BI measures are documented, not run in Desktop/CI.
9. **No browser E2E or accessibility automation** in the demo. The manual
   checklist is in `docs/acceptance-criteria.md`.
10. **No admin/supervisor role.** The schema has only `food_officer`, `citizen`
    and `business_owner`; supervisor use is via the officer role.
11. **Small-sample caution.** A stage median from fewer than five records is not a
    stable baseline.
12. **Privacy.** Extracts exclude complaint narratives, citizen identities,
    emails and password hashes. Production retention and privacy review are
    outstanding.

---

## 18. Phase 2 and Phase 3

Phase 2 focuses on production readiness:

- supervisor/analyst role and district-scoped row-level security;
- export audit logging;
- missing lifecycle fields (acknowledgement, on-site start/arrival, report
  approval, laboratory, enforcement) with backfill and quality rules;
- quality workflow (assign, comment, suppress with justification, trend);
- PostgreSQL in staging/production, backups and migration runbook;
- scheduled BI refresh, Power BI Service with gateway, DAX execution tests;
- accessibility audit, privacy impact assessment, retention policy, monitoring.

Phase 3 focuses on decision support:

- transparent what-if and capacity scenario analysis;
- early-warning signals with human review and documented thresholds;
- supplier and traceability analytics;
- privacy-safe citizen transparency;
- governed forecasting **only** with a labelled dataset, baseline comparison,
  error reporting, drift monitoring and legal/ethical review — never by
  relabelling the current policy score;
- integration with state systems, laboratories and identity providers.

Full detail and sequencing: [docs/roadmap.md](docs/roadmap.md).

---

## 19. Documentation index

| Document | Purpose |
| --- | --- |
| [docs/README.md](docs/README.md) | Documentation map and conventions. |
| [docs/BRD.md](docs/BRD.md) | Problem, objectives, scope, requirements, success measures. |
| [docs/stakeholders.md](docs/stakeholders.md) | Roles, access model, RACI. |
| [docs/user-stories.md](docs/user-stories.md) | Prioritised user outcomes. |
| [docs/acceptance-criteria.md](docs/acceptance-criteria.md) | Given/When/Then checks and manual sign-off. |
| [docs/kpi-definitions.md](docs/kpi-definitions.md) | The 13 governed KPI definitions. |
| [docs/data-dictionary.md](docs/data-dictionary.md) | Tables, fields, derived measures, quality rules. |
| [docs/process-analysis.md](docs/process-analysis.md) | Stage timings, bottlenecks, unavailable stages. |
| [docs/architecture.md](docs/architecture.md) | Components, data flow, access control, deployment. |
| [docs/testing-strategy.md](docs/testing-strategy.md) | Test layers, release gate, what is not automated. |
| [docs/roadmap.md](docs/roadmap.md) | Phase 2/3 work and dependencies. |
| [docs/powerbi/README.md](docs/powerbi/README.md) | Power BI import and refresh guide. |
| [analytics/sql/README.md](analytics/sql/README.md) | SQL query catalogue and runner. |
| [analytics/python/README.md](analytics/python/README.md) | Python toolkit usage and caveats. |

---

## 20. License and attribution

This is a Smart India Hackathon 2026 demonstration project. Product names,
government body names and agency references are used descriptively. They do not
imply endorsement, partnership or official status. The seeded dataset is
synthetic.
