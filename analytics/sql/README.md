# SafeBite SQL analytics library

Read-only SQL for validating, auditing and extending the BI workspace outside the
Next.js application. The library ships in two dialects with identical query names,
parameters and result columns:

| File | Dialect | Use |
| --- | --- | --- |
| `queries.sqlite.sql` | SQLite | Local demo database (`file:./dev.db`) |
| `queries.postgres.sql` | PostgreSQL | Production-style deployment (`build:pg`) |

Both files contain **26 documented queries**: the 13 governed KPIs, the risk
register views, district and process analytics, and data-quality checks.

## Running

```bash
# List every query and its parameters
npm run analytics:sql -- list

# Execute all queries with a 90-day default window
npm run analytics:sql -- all

# Execute one query with explicit boundaries (ISO dates)
npm run analytics:sql -- run kpi_sla_compliance --from 2026-08-11 --to 2026-11-09

# Structural + execution validation (requires the seeded SQLite database)
npm run analytics:sql:validate
```

The runner selects the dialect from `DATABASE_URL` and writes results as JSON.
Counts are converted from BigInt so the output is portable.

## Parameters

| Name | Meaning | Default |
| --- | --- | --- |
| `:fromDate` | Inclusive start of the reporting window | 90 days before now |
| `:toDate` | Exclusive end of the reporting window | now |
| `:asOf` | Point-in-time date for snapshots and backlog | now |
| `:priorDate` | Baseline date for 30-day movement | 30 days before now |
| `:limit` | Row cap for list queries | 20 |

Parameters are bound by Prisma. User input never becomes part of the SQL string.
The runner converts named placeholders to `?` (SQLite) or `$n` (PostgreSQL), reuses
numbered parameters in PostgreSQL, and clamps `:limit` to 1–1000.

Dates in the application reports use **Asia/Kolkata day boundaries**. When calling
the SQL runner directly, pass explicit boundaries (for example
`--from 2026-08-11 --to 2026-11-09`) if you need to reproduce an IST period exactly.

## Query catalogue

### Governed KPIs

| Query | Parameters | Returns | Definition |
| --- | --- | --- | --- |
| `kpi_registered_businesses` | `asOf` | `registeredBusinesses` | Businesses registered before `asOf`, excluding closed premises. |
| `kpi_high_risk_premises` | `asOf`, `limit` | `id`, `name`, `district`, `category`, `licenseNumber`, `score`, `tier`, `snapshotAt` | Latest snapshot per premise on or before `asOf`, tier C or D. |
| `kpi_average_risk_score` | `asOf` | `averageRiskScore`, `ratedBusinesses` | Mean latest snapshot score for registered, rated premises. |
| `kpi_inspections_completed` | `fromDate`, `toDate` | `inspectionsCompleted` | Completed inspections whose completion timestamp is in the window. |
| `kpi_inspection_completion_rate` | `fromDate`, `toDate` | `dueInspections`, `completedInspections`, `completionRatePercent` | Inspections scheduled in the window that were completed by its end. |
| `kpi_critical_violations` | `fromDate`, `toDate` | `findings`, `criticalFindings` | Findings from inspections completed in the window, split by critical severity. |
| `kpi_violations_per_inspection` | `fromDate`, `toDate` | `inspectionsCompleted`, `findings`, `violationsPerInspection` | Findings divided by completed inspections; zero-finding inspections stay in the denominator. |
| `kpi_repeat_violation_rate` | `fromDate`, `toDate` | `findings`, `repeatFindings`, `repeatRatePercent` | Findings whose type already occurred at the same business before the window. |
| `kpi_complaints_received` | `fromDate`, `toDate` | `complaintsReceived` | Complaints created in the window. |
| `kpi_complaints_resolved` | `fromDate`, `toDate` | `complaintsResolved` | Valid resolutions (`resolvedAt >= createdAt`) in the window. |
| `kpi_average_resolution_days` | `fromDate`, `toDate` | `evaluatedResolutions`, `averageResolutionDays` | Mean calendar days from creation to valid resolution. |
| `kpi_sla_compliance` | `fromDate`, `toDate` | `evaluatedResolutions`, `withinSla`, `slaCompliancePercent` | Valid resolutions completed within the complaint's `slaDays` target. |
| `kpi_overdue_open_complaints` | `asOf` | `overdueOpen` | Complaints not resolved by `asOf` whose SLA due date has passed. Invalid lifecycles remain visible. |

### Risk, districts and process

| Query | Parameters | Returns | Use |
| --- | --- | --- | --- |
| `risk_tier_distribution` | `asOf` | `tier`, `businesses`, `averageScore` | Current tier mix from latest snapshots. |
| `risk_score_history` | `asOf` | `month`, `ratedBusinesses`, `averageScore`, `highestScore` | Monthly snapshot history for trend validation. |
| `risk_score_movers` | `asOf`, `priorDate`, `limit` | `name`, `district`, `riskTier`, `currentScore`, `priorScore`, `scoreChange` | Largest positive movers; filter or sort the other way for reductions. |
| `district_scorecard` | `fromDate`, `toDate`, `asOf` | `district`, `premises`, `highRiskPremises`, `averageRiskScore`, `inspectionsCompleted`, `findings`, `complaintsReceived`, `complaintsResolved`, `overdueOpen` | Peer-comparison table. |
| `inspection_turnaround_by_district` | `fromDate`, `toDate` | `district`, `completedInspections`, `averageTurnaroundDays` | Planned date to completion, excluding negative durations. |
| `inspection_overdue_backlog` | `asOf` | `district`, `overdueInspections` | Scheduled inspections past their planned date. |
| `complaint_stage_durations` | `fromDate`, `toDate` | `stage`, `samples`, `averageDays` | Receipt → assignment → investigation → inspection → resolution. |
| `complaint_type_distribution` | `fromDate`, `toDate` | `complaintType`, `complaints` | Missing types are surfaced as `unspecified`, never dropped. |
| `violation_severity_distribution` | `fromDate`, `toDate` | `severity`, `findings` | Severity mix for completed inspections. |

### Data quality

| Query | Parameters | Returns | Use |
| --- | --- | --- | --- |
| `data_quality_lifecycle_anomalies` | `limit` | complaint fields, `issue` | Resolved-without-timestamp, negative duration, out-of-order stages and anonymity conflicts. |
| `data_quality_duplicate_licences` | `limit` | `name`, `district`, `licenseNumber`, `duplicates` | Duplicate licences after trimming and case-folding. |
| `supplier_licence_coverage` | none | `suppliers`, `missingLicence`, `withLicence` | Supplier-master completeness follow-up. |
| `expired_documents_by_type` | `asOf` | `type`, `expiredDocuments` | Regulatory follow-up; **not** a data-quality defect. |

## Interpretation rules

- **KPI queries are definitions, not a second implementation.** The app's KPI
  engine remains the source of truth for visualisations. These queries are for
  audit and external tooling. If a definition changes, update both the engine and
  these files.
- **Latest snapshot semantics.** Risk queries use the latest `RiskSnapshot` at or
  before `asOf`. They never back-fill a historical score from today's register.
- **Valid resolutions only.** Resolution and SLA queries require
  `resolvedAt >= createdAt`. Impossible lifecycles are returned by
  `data_quality_lifecycle_anomalies` instead of being silently repaired.
- **No training, no prediction.** Risk scores are deterministic weighted rules.
  SQL never estimates a probability of illness.
- **Demo data.** The seeded dataset is synthetic. Results are not official
  government statistics and do not imply endorsement.

## Adding a query

1. Add the query to **both** dialect files with the same `-- name`, `-- params`
   and `-- description` headers.
2. Use only the supported named parameters. Never interpolate strings.
3. Add the query to `EXPECTED_COLUMNS` in `scripts/validate-sql.ts`.
4. Run `npm run analytics:sql:validate`.

The validator checks dialect parity, parameter declarations, expected columns and
execution against the seeded database.
