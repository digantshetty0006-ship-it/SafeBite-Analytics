# Architecture

## 1. Overview

SafeBite is a Next.js 16 App Router application backed by Prisma. The analytics
upgrade adds a server-rendered decision-support workspace inside the existing
officer experience. It does not introduce a separate service, a second database,
or a client-side analytics engine.

```
Browser (Food Safety Officer)
   │  GET /officer/intelligence?period=last90&district=Mumbai
   ▼
Next.js App Router (React Server Components)
   │  requireRole("food_officer")
   ▼
Analytics data loader  ──── Prisma ────► SQLite (local) / PostgreSQL (deploy)
   │  one filtered dataset per request
   ▼
KPI engine · Risk engine · Quality engine · Process engine
   │  server-side aggregates only
   ▼
RSC page + Recharts client islands + export route
   │
   ├── CSV: /officer/intelligence/export/[report]
   ├── PDF: browser jsPDF from the rendered summary DTO
   └── Static extracts: public/powerbi/*.csv ──► Power BI / Python
```

Key properties:

- **Server-side truth.** The KPI engine runs on the server. The browser receives
  aggregates and table rows, not the whole analytical universe.
- **One definition.** The app engine, SQL library, Power BI DAX guide and Python
  toolkit share one KPI catalogue.
- **No hidden writes.** Analytics pages are read-only. Lifecycle timestamps and
  risk snapshots are written by the existing operational server actions.
- **Fail closed.** Pages and export routes re-check the session role.

## 2. Runtime components

| Layer | Location | Responsibility |
| --- | --- | --- |
| Route guard | `src/app/(app)/officer/layout.tsx`, `src/app/(app)/officer/intelligence/layout.tsx` | Require `food_officer` before rendering the workspace. |
| Pages | `src/app/(app)/officer/intelligence/**/page.tsx` | Parse search params, load the dataset, build the view, render server components. |
| Filter parsing | `src/lib/analytics/filters.ts` | Clamp query values, resolve IST periods, equal-length comparison windows. |
| Data loader | `src/lib/analytics/data.ts` | One batched Prisma load per request, scoped by category/risk tier and status filters. |
| KPI engine | `src/lib/analytics/kpis.ts` | 13 governed KPIs, comparisons, trends, distributions, risk ranking, district scorecard. |
| Risk engine | `src/lib/risk.ts`, `src/lib/risk-service.ts` | Deterministic score, factor breakdown, snapshots on material change. |
| Quality engine | `src/lib/quality.ts` | 20 validation rules, findings, grade, false-positive controls. |
| Process engine | `src/lib/process.ts` | Stage durations, funnel, inspection completion and turnaround, unavailable stages. |
| Report builders | `src/lib/analytics/reports.ts` | CSV payloads, formula-injection guard, summary DTO for PDF. |
| Export route | `src/app/(app)/officer/intelligence/export/[report]/route.ts` | Role check, report allow-list, filtered CSV response. |
| UI components | `src/components/intelligence/**` | Filter bar, KPI cards, charts, risk table, district table, nav. |
| Extract generator | `scripts/export-powerbi.ts` | 11 static CSVs under `public/powerbi/`. |
| SQL tooling | `analytics/sql/`, `scripts/run-sql.ts`, `scripts/validate-sql.ts`, `scripts/sql-lib.ts` | Two dialects, bound parameters, structural and execution validation. |
| Python toolkit | `analytics/python/safebite_analytics/` | KPI reproduction, risk views, quality reconciliation, self-tests. |
| Tests | `tests/*.test.ts` | Pure-function tests for risk, filters, KPI logic, CSV safety, anonymity rules. |

## 3. Request flow

1. The officer opens `/officer/intelligence` with optional search params.
2. The layout calls `requireRole("food_officer")`; unauthorised users are
   redirected before any data is loaded.
3. `parseAnalyticsFilters` normalises the query. Unknown periods, groupings and
   risk tiers fall back to safe defaults. An invalid custom range resets to the
   last 30 days and `custom` becomes `false`.
4. `resolvePeriod` computes current and previous windows using Asia/Kolkata day
   boundaries, returns labels and days, and picks a default trend grouping.
5. `loadAnalyticsDataset` issues four parallel Prisma reads for filter options
   and then three parallel reads for complaints, inspections and risk snapshots.
   The district filter is applied in the KPI layer so peer districts remain
   visible while a district is selected; category and risk-tier filters change
   the business universe.
6. `buildAnalyticsView` computes KPIs, trends, distributions, risk ranking and
   the district scorecard from that single dataset.
7. The page renders server components; chart and filter components are client
   islands that receive aggregate arrays.
8. The navigation and filter bar write a new URL; there is no client-side data
   fetch for analytics.

## 4. Data model additions

Both Prisma schemas (`prisma/schema.prisma` for SQLite and
`prisma/schema.pg.prisma` for PostgreSQL) add:

- `Business.status` — `active`, `suspended`, `closed`.
- `Complaint.assignedAt`, `investigationStartedAt`, `inspectionAt`,
  `resolvedAt` — lifecycle timestamps for process analytics.
- `RiskSnapshot` — append-only score history with JSON factor points.
- Indexes on the fields used by analytics filters and time windows.

Migration: `prisma/migrations/20261108131325_analytics_upgrade`.

The risk snapshot writer (`src/lib/risk-service.ts`) records a snapshot when the
score moves by at least 2 points or the latest snapshot is more than 24 hours
old. Completed inspections force a write. This keeps history meaningful without
writing a row on every page view.

## 5. Access control

| Control | Implementation |
| --- | --- |
| Page access | `requireRole("food_officer")` in the officer and intelligence layouts. |
| Server actions | Existing complaint/inspection actions call `requireRole("food_officer")`. |
| CSV export | `/officer/intelligence/export/[report]` calls `getSessionUser()` and returns 403 for non-officers; report names are checked against an allow-list. |
| PDF | Generated in the browser from data already authorised for the page. |
| Power BI / Python | Static files on disk; no live credentials, no row-level security. Workspace permissions are the access boundary. |
| Citizen / business owner | No analytics routes, no export route access, no extract access through the app. |

There is no `admin` role in the schema and the implementation does not invent one.
Supervisor-style district comparison uses the officer role for the demo.

### Privacy boundaries

- Complaint narratives (`description`), citizen identities (`citizenId`), emails
  and password hashes are never selected by the analytics loader and never
  exported.
- `fact_complaints.csv` includes `hasCitizenLink` (1/0) instead of the identity,
  so anonymity contradictions can be detected externally without exporting the
  person.
- CSV cells beginning with `=`, `+`, `-`, `@`, tab or carriage return are prefixed
  with an apostrophe and quoted to prevent spreadsheet formula injection.

## 6. Period and snapshot semantics

- All user-facing periods use Asia/Kolkata day boundaries converted to UTC for
  querying.
- The previous window is the immediately preceding window of equal length, not
  the previous calendar month unless the selected period is a month.
- Event KPIs count records whose event timestamp falls in `[start, end)`.
- Snapshot KPIs use the latest `RiskSnapshot` on or before the period end.
  Historical dates never fall back to today's register. The only fallback is the
  live register when the as-of date is effectively "now".
- Invalid resolutions (`resolvedAt < createdAt`, or resolved status without a
  timestamp) are excluded from resolution and SLA metrics and surfaced in data
  quality.

## 7. Rendering and performance

- The dataset is loaded once per request. There is no per-business query loop.
- Aggregate arrays are passed to Recharts; raw records are not shipped for charts.
- Tables are paginated/limited in the UI; the risk register caps the visible rows
  and reports have explicit row caps.
- Routes that depend on live data use `export const dynamic = "force-dynamic"`.
- SQLite is used for local demo builds (`npm run build`); `npm run build:pg`
  generates the PostgreSQL client for deployment.

## 8. Deployment notes

| Concern | Demo | Production guidance |
| --- | --- | --- |
| Database | SQLite `file:./dev.db` | PostgreSQL with `DATABASE_URL` and the PG schema. |
| Migrations | `prisma migrate` | Run migrations as a release step; back up before applying. |
| Session | Existing cookie-based auth | Add rotation, secure cookies, CSRF review. |
| Extracts | Committed static CSVs for demo | Regenerate from a read replica or scheduled job; do not commit production extracts. |
| Power BI | Manual import of CSVs | Gateway/service principal with row-level security. |
| Retention | Demo data | Apply records-retention and privacy policy. |
| Monitoring | Build/lint/tests | Add request tracing, slow-query logging and export audit logs. |

## 9. Failure modes

| Failure | Behaviour |
| --- | --- |
| Invalid custom date range | Falls back to the last 30 days; no crash. |
| Empty filter result | KPI values render as unavailable or zero with explicit denominators; no fake percentages. |
| Missing risk snapshot | Premises is unrated; not assumed safe. |
| Invalid complaint lifecycle | Excluded from duration metrics; counted in quality findings. |
| Unknown report name | 404 from the export route. |
| Non-officer export request | 403. |
| Extract drift | Python self-test and `analytics:sql:validate` fail loudly. |
| Database unavailable | Page errors; there is no stale cache presented as live data. |

## 10. What this architecture deliberately avoids

- A separate analytics database that could drift from operations.
- Client-side KPI computation that could diverge between pages.
- A trained model or opaque score.
- Live Power BI credentials embedded in the repository.
- Auto-repair of data-quality findings.
- Changes to the original live deployment or URL.
