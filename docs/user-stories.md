# User stories

Priority: **M** must, **S** should, **C** could. Story IDs are referenced by
[acceptance-criteria.md](acceptance-criteria.md).

## Epic A — Access and navigation

| ID | Pri | Story |
| --- | --- | --- |
| US-01 | M | As a Food Safety Officer, I want a single "Intelligence & BI" entry point so that I can reach analytics without hunting through the app. |
| US-02 | M | As a Food Safety Officer, I want analytics pages to require my role so that citizens and business owners cannot view operational intelligence. |
| US-03 | S | As a Food Safety Officer, I want the legacy analytics page to keep working so that existing links and habits are not broken. |
| US-04 | S | As a Food Safety Officer, I want a sub-navigation across overview, risk, quality, process, reports and methodology so that I can move between views quickly. |

## Epic B — Filters and period context

| ID | Pri | Story |
| --- | --- | --- |
| US-05 | M | As a Food Safety Officer, I want to choose last 7/30/90 days, current month, previous month or a custom range so that I can frame the question. |
| US-06 | M | As a Food Safety Officer, I want every KPI to compare against the immediately preceding equal-length period so that I know whether performance is improving. |
| US-07 | M | As a Food Safety Officer, I want to filter by district, category, risk tier, complaint status and inspection status so that I can focus on a cohort. |
| US-08 | S | As a Food Safety Officer, I want daily, weekly or monthly trend grouping so that I can see the right level of detail for the selected range. |
| US-09 | M | As a Food Safety Officer, I want the active filters shown on the page and in exports so that a shared report has context. |

## Epic C — KPI overview

| ID | Pri | Story |
| --- | --- | --- |
| US-10 | M | As a Food Safety Officer, I want 13 governed KPIs on one overview so that I can scan the food-safety position quickly. |
| US-11 | M | As a Food Safety Officer, I want a favourable/adverse assessment that respects each KPI's direction so that "up" is not automatically good. |
| US-12 | M | As a Food Safety Officer, I want sparklines and trend charts so that I can see whether the current value is a spike or a trend. |
| US-13 | M | As a Food Safety Officer, I want the exact formula and caveat for each KPI so that I can defend the number in a meeting. |
| US-14 | S | As a Food Safety Officer, I want distribution charts for risk tier, category, complaint type and violation severity so that I can see mix, not just totals. |

## Epic D — Risk intelligence

| ID | Pri | Story |
| --- | --- | --- |
| US-15 | M | As a Food Safety Officer, I want premises ranked by deterministic risk score so that I can prioritise visits. |
| US-16 | M | As a Food Safety Officer, I want each risk row to show the factor breakdown and top driver so that the score is explainable. |
| US-17 | M | As a Food Safety Officer, I want the 30-day score movement so that I can distinguish a chronic problem from a sudden deterioration. |
| US-18 | M | As a Food Safety Officer, I want risk metrics to use the snapshot at the period end, not today's score, so that historical comparisons are honest. |
| US-19 | S | As a Food Safety Officer, I want a drill-down showing each factor's points against its policy maximum so that I can see which budget is exhausted. |
| US-20 | S | As a Food Safety Officer, I want a methodology page that states the weights, caps, recency decay and tier thresholds so that I can challenge or trust the model. |

## Epic E — District comparison

| ID | Pri | Story |
| --- | --- | --- |
| US-21 | M | As a supervisor, I want districts compared on premises, high-risk count, average risk, inspections, findings, complaints, resolutions and overdue backlog so that I can allocate attention. |
| US-22 | S | As a supervisor, I want to click a district to filter the whole workspace so that I can move from comparison to investigation. |
| US-23 | S | As a supervisor, I want small-district percentages presented with counts so that I do not overreact to a single premises. |

## Epic F — Data quality

| ID | Pri | Story |
| --- | --- | --- |
| US-24 | M | As a data steward, I want 20 documented validation rules so that defects are found consistently. |
| US-25 | M | As a data steward, I want to see how many records each rule affects and sample links so that I can fix the source record. |
| US-26 | M | As a citizen, I want legitimate anonymous complaints not to be flagged so that privacy choices do not create false data-quality findings. |
| US-27 | M | As a Food Safety Officer, I want impossible complaint and inspection lifecycles excluded from resolution and turnaround metrics so that bad data does not distort performance. |
| US-28 | S | As a data steward, I want a quality score and grade with a documented penalty method so that I can track improvement over time. |
| US-29 | S | As a data steward, I want expired documents and supplier licence gaps labelled as follow-ups, not analytics defects, so that the score stays meaningful. |

## Epic G — Process efficiency

| ID | Pri | Story |
| --- | --- | --- |
| US-30 | M | As a supervisor, I want median, average and p90 durations for each complaint stage so that I can see typical and worst-case delay. |
| US-31 | M | As a supervisor, I want a complaint funnel and inspection completion metrics so that I can see where cases are lost. |
| US-32 | M | As a supervisor, I want stages that cannot be measured to be named explicitly so that I do not mistake missing data for zero delay. |
| US-33 | S | As a supervisor, I want inspection turnaround by district and an overdue backlog so that I can balance workload. |
| US-34 | S | As a supervisor, I want invalid or negative durations excluded and counted so that a data defect does not become a fake improvement. |

## Epic H — Reports and exports

| ID | Pri | Story |
| --- | --- | --- |
| US-35 | M | As a Food Safety Officer, I want to download CSV reports for summary, risk, districts, complaints, inspections, quality and process so that I can analyse them externally. |
| US-36 | M | As a Food Safety Officer, I want CSV exports to respect the active filters so that the file matches the screen. |
| US-37 | M | As a Food Safety Officer, I want CSV formula injection protection so that opening an export cannot execute malicious complaint text. |
| US-38 | M | As a Food Safety Officer, I want a PDF management summary with period, filters, KPI table, district table, top risks and disclaimer so that I can share a point-in-time view. |
| US-39 | S | As a Food Safety Officer, I want export filenames to identify the report, district and date so that files do not overwrite each other. |
| US-40 | S | As a reviewer, I want exports to exclude complaint narratives and citizen identities so that sensitive data is not leaked. |

## Epic I — Analyst portability

| ID | Pri | Story |
| --- | --- | --- |
| US-41 | M | As a data analyst, I want at least 15 documented SQL queries with named parameters so that I can audit KPIs directly. |
| US-42 | M | As a data analyst, I want SQLite and PostgreSQL dialect parity so that local and deployed results use the same definitions. |
| US-43 | M | As a BI developer, I want Power BI-ready dimension and fact CSVs with a documented star schema so that I can rebuild the dashboard. |
| US-44 | M | As a BI developer, I want DAX measures that mirror the governed KPIs so that report consumers see the same logic. |
| US-45 | M | As a Python analyst, I want a toolkit that reproduces KPIs, risk views and quality reconciliation so that I can validate the extract. |
| US-46 | S | As a Python analyst, I want a self-test command so that I can detect drift after a dataset refresh. |
| US-47 | S | As a reviewer, I want a dataset manifest with row counts and generation time so that I know what I am looking at. |

## Epic J — Trust, documentation and limitations

| ID | Pri | Story |
| --- | --- | --- |
| US-48 | M | As a reviewer, I want synthetic data and non-endorsement notices wherever analytics appear so that the demo is not misrepresented. |
| US-49 | M | As an engineer, I want automated tests for risk bands, periods, KPI calculations, CSV injection and anonymity rules so that regressions are caught. |
| US-50 | M | As a maintainer, I want a README with exact run commands, changed files, limitations and Phase 2/3 work so that the delivery can be operated and extended. |
| US-51 | S | As a reviewer, I want a data dictionary and process analysis so that formulas and unavailable stages are traceable. |

## Out-of-scope stories

- Citizen-facing comparison of districts.
- Business-owner access to competitor risk.
- A trained predictive model or illness probability.
- Automated enforcement action from a risk score.
- Live Power BI refresh with production credentials.
