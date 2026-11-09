# Acceptance criteria

Each scenario is written as Given/When/Then and maps to the stories in
[user-stories.md](user-stories.md). All checks are for the demo dataset unless a
scenario explicitly creates its own fixture.

## A. Access and navigation

### AC-01 — Officer-only analytics (US-01, US-02)

**Given** an unauthenticated visitor or a signed-in citizen/business owner
**When** they request `/officer/intelligence` or any export route
**Then** the app redirects or returns 403 and no business, complaint or risk data
is rendered.

**Given** a signed-in Food Safety Officer
**When** they open the sidebar
**Then** an "Intelligence & BI" entry is visible and links to
`/officer/intelligence`.

### AC-02 — Legacy route preserved (US-03)

**Given** a Food Safety Officer
**When** they open `/officer/analytics`
**Then** the original analytics page still renders and is not replaced by the new
workspace.

## B. Periods and filters

### AC-03 — Equal-length comparison (US-05, US-06)

**Given** any period preset or valid custom range
**When** the dashboard resolves the period
**Then** the previous window ends exactly where the current window starts and has
the same duration in milliseconds.

**Given** the `last90` preset at 8 November 2026
**When** the period is resolved
**Then** the current window starts at 11 August 2026 00:00 IST (10 August 2026
18:30 UTC) and ends at the current timestamp.

### AC-04 — Custom range inclusivity (US-05)

**Given** a custom range from `2026-08-11` to `2026-11-08`
**When** records are filtered
**Then** a record at 23:59 IST on 8 November is included and a record at 00:00 IST
on 9 November is excluded.

**Given** an invalid custom range
**When** the page loads
**Then** the app falls back to the last 30 days without crashing.

### AC-05 — Filters apply consistently (US-07, US-09)

**Given** a district, category or risk-tier filter
**When** the overview renders
**Then** the KPI cards, trend series, risk ranking, district table, complaint
distribution, violation distribution and report exports all use the same filtered
scope.

**Given** active filters
**When** a CSV is downloaded
**Then** the export reflects those filters and the summary export lists the active
filter values.

## C. KPI overview

### AC-06 — KPI coverage (US-10)

**Given** the seeded database
**When** the overview loads
**Then** exactly 13 KPI cards render with a current value, previous value and
definition.

The IDs are: `registered_businesses`, `high_risk_premises`,
`average_risk_score`, `inspections_completed`, `inspection_completion_rate`,
`critical_violations`, `violations_per_inspection`, `repeat_violation_rate`,
`complaints_received`, `complaints_resolved`, `average_resolution_days`,
`sla_compliance`, `overdue_open_complaints`.

### AC-07 — Direction-aware assessment (US-11)

**Given** a KPI where lower is better (for example average risk score or overdue
open complaints)
**When** the value falls
**Then** the assessment is "Favourable".

**Given** a KPI where higher is better (for example SLA compliance)
**When** the value falls
**Then** the assessment is "Adverse".

**Given** a KPI with no previous baseline
**When** the card renders
**Then** the change is shown as unavailable rather than implied to be zero.

### AC-08 — Repeat violation definition (US-10, US-13)

**Given** a violation finding in the current period
**When** the same violation type was recorded at the same business in an
inspection completed before the period start
**Then** it counts as a repeat finding.

**Given** no prior finding of that type at that business
**Then** it does not count as a repeat, even if other businesses had that type.

### AC-09 — Valid resolutions only (US-13, US-27)

**Given** a complaint with `resolvedAt < createdAt`
**When** resolution and SLA KPIs are calculated
**Then** the complaint is excluded from the numerator and denominator and counted
in the data-quality invalid-lifecycle finding.

**Given** a complaint with status `resolved` and no `resolvedAt`
**Then** it is excluded from resolution and SLA metrics and surfaced in data
quality.

### AC-10 — Overdue complaints (US-13)

**Given** a complaint created before the as-of timestamp, still unresolved at that
timestamp, and whose `createdAt + slaDays` is before the as-of timestamp
**Then** it counts as overdue open.

**Given** a complaint resolved before the as-of timestamp
**Then** it does not count as overdue, even if it was resolved late.

## D. Risk intelligence

### AC-11 — Explainable ranking (US-15, US-16, US-19)

**Given** the risk page
**When** a premises row is expanded
**Then** it shows points and policy maximum for violations, recent complaints,
inspection timeliness, document compliance and category baseline, plus the top
factor.

**Given** a score of 73
**Then** the tier is C and the factor points sum to the score (subject to the
0–100 clamp).

### AC-12 — Deterministic reproducibility (US-18, US-20)

**Given** the same business records and the same `asOf` timestamp
**When** risk is calculated twice
**Then** the score, tier, factor points and explainers are identical.

**Given** a historical period end
**When** risk is shown
**Then** the latest snapshot on or before that date is used. If no snapshot
exists, the premises is unrated; today's register score is not back-filled,
except for the current-date fallback where the snapshot is effectively "now".

### AC-13 — Risk weights and tiers (US-20)

**Given** the methodology page and risk engine
**Then** the weights are violations 40, recent complaints 25, inspection
timeliness 15, document compliance 10 and category baseline 10, totalling 100.

**Given** scores 25, 25.1, 50, 50.1, 75 and 75.1
**Then** tiers are A, B, B, C, C and D respectively.

### AC-14 — 30-day movement (US-17)

**Given** a business with a snapshot at or before `asOf` and another at or before
`asOf - 30 days`
**When** the risk register renders
**Then** the score change is the current score minus the earlier score.

**Given** no earlier snapshot
**Then** the movement is shown as unavailable, not zero.

## E. District comparison

### AC-15 — District scorecard (US-21, US-23)

**Given** multiple districts
**When** the overview renders
**Then** each district row shows premises, high-risk count, average risk score,
inspections completed, findings, complaints received, complaints resolved and
overdue open complaints.

**Given** a district with one premises
**Then** the row still shows the underlying counts next to any percentage.

**Given** a district row is clicked
**When** the filter is applied
**Then** the risk table and KPIs switch to that district.

## F. Data quality

### AC-16 — Rule coverage and transparency (US-24, US-25, US-28)

**Given** the quality page
**When** it loads
**Then** it evaluates 20 rules and shows rules failed, records affected, severity,
sample records and a recommendation.

**Given** a failing rule
**Then** the quality score deducts the documented severity penalty once for that
rule, not once per affected record.

### AC-17 — Anonymous complaint false-positive control (US-26)

**Given** a complaint with `anonymous = true` and `citizenId = null`
**When** data quality runs
**Then** it is **not** counted as an anonymity conflict.

**Given** a complaint with `anonymous = true` and a citizen identity linked
**Then** it is counted as `C-ANON-CONFLICT`.

**Given** the automated test suite
**Then** both the legitimate and contradictory cases are exercised and pass.

### AC-18 — No auto-repair (US-27, US-29)

**Given** an impossible lifecycle, duplicate licence, missing timestamp or
out-of-range coordinate
**When** quality runs
**Then** the record is reported with its ID/link and is not silently changed.

**Given** an expired document
**Then** it is labelled a regulatory follow-up and excluded from the quality
score.

## G. Process efficiency

### AC-19 — Stage timings (US-30, US-34)

**Given** complaints created in the period with valid consecutive timestamps
**When** the process page loads
**Then** each available stage shows reached count, valid sample size, median,
average and p90 days.

**Given** a negative or out-of-order duration
**Then** it is excluded from the duration sample and counted as excluded.

### AC-20 — Unavailable stages named (US-32)

**Given** the schema has no acknowledgement, on-site duration, laboratory,
report-approval or enforcement timestamps
**When** the process page renders
**Then** an "unavailable stages" panel states each gap and why it is not
estimated.

### AC-21 — Inspection and backlog metrics (US-31, US-33)

**Given** the selected period
**Then** the page shows inspections completed, inspections due, completion rate,
overdue scheduled inspections and missed inspections.

**Given** a scheduled inspection whose `scheduledAt` is before the as-of date and
whose status is still `scheduled`
**Then** it counts in the overdue backlog.

## H. Reports and exports

### AC-22 — CSV report set (US-35, US-36, US-39)

**Given** a Food Safety Officer
**When** they request each report type
**Then** `summary`, `risk`, `districts`, `complaints`, `inspections`, `quality`
and `process` return a UTF-8 CSV attachment.

**Given** a report request with filters
**Then** the rows respect the same dataset scope as the screen.

**Given** a district filter
**Then** the filename includes the district slug and the date.

### AC-23 — CSV injection protection (US-37)

**Given** a text cell beginning with `=`, `+`, `-`, `@`, tab or carriage return
**When** the CSV is generated
**Then** the cell is quoted and prefixed with an apostrophe so a spreadsheet does
not execute it as a formula.

**Given** a value containing double quotes
**Then** the quotes are doubled and the cell remains valid CSV.

### AC-24 — PDF summary (US-38)

**Given** a Food Safety Officer on the reports page
**When** they generate the PDF
**Then** the document includes the period, comparison period, active filters,
generated-by user, KPI table, district table, top risk premises, data notes and
the synthetic-data / non-endorsement disclaimer.

### AC-25 — Privacy of exports (US-40)

**Given** any CSV or Power BI extract
**Then** it contains no complaint narrative, citizen identity, email address or
password hash.

## I. Analyst portability

### AC-26 — SQL library (US-41, US-42)

**Given** the seeded SQLite database
**When** `npm run analytics:sql:validate` runs
**Then** all 26 queries parse, execute, return documented columns and have
identical names and parameters in the PostgreSQL dialect.

**Given** user-supplied dates or limits
**Then** they are bound as parameters and never concatenated into SQL text.

### AC-27 — Power BI extract (US-43, US-44, US-47)

**Given** `npm run analytics:datasets`
**Then** 11 CSVs are written to `public/powerbi/` and
`dataset_manifest.csv` records grain, row count and generation timestamp.

**Given** the extracts
**Then** `dim_date` covers 2024-01-01 to 2027-12-31 and the fact tables expose
the keys and flags documented in `docs/powerbi/data_model.md`.

### AC-28 — Python toolkit (US-45, US-46)

**Given** fresh extracts
**When** `py -m safebite_analytics self-test` runs
**Then** it verifies 13 KPIs, equal-length periods, risk weights, tier coverage,
anonymous-complaint false positives, quality reconciliation and non-negative
resolution time.

**Given** the quality comparison
**Then** every evaluable rule's Python count matches the app's exported finding
count. Rules needing checklist, document or supplier tables are marked not
evaluable.

## J. Quality gates and limitations

### AC-29 — Automated gates (US-49)

**Given** a clean checkout with dependencies installed
**When** the delivery checks run
**Then** `npx tsc --noEmit`, `npm run lint`, `npm test` and `npm run build`
complete successfully.

### AC-30 — Honest limitations (US-48, US-50, US-51)

**Given** any analytical page or exported report
**Then** synthetic data is labelled and risk is described as deterministic policy
rules, not ML.

**Given** the README and docs
**Then** they state the run commands, changed files, unavailable timestamps and
Phase 2/3 work.

**Given** a historical risk comparison
**Then** the UI does not claim precision beyond the stored snapshot dates.

## Manual sign-off checklist

- [ ] Officer login reaches the intelligence workspace.
- [ ] Citizen login cannot reach any intelligence route.
- [ ] All six period presets and a custom range render without error.
- [ ] Filter combinations produce coherent KPI and table values.
- [ ] Risk factor drill-down sums to the displayed score.
- [ ] Quality page shows known seeded defects and no false anonymous flag.
- [ ] Process page names unavailable stages.
- [ ] All seven CSV types download and open in a spreadsheet.
- [ ] PDF opens and contains the disclaimer.
- [ ] Mobile/tablet layout is usable (no horizontal page scroll; tables scroll).
- [ ] `npm run analytics:smoke` matches the dashboard for the same period.
- [ ] `npm run analytics:sql:validate`, `npm run analytics:datasets` and the
  Python self-test pass after a reseed.
