# KPI definitions

This is the governed KPI catalogue for the SafeBite intelligence workspace. It is
mirrored by:

- the in-app engine: `src/lib/analytics/kpis.ts`;
- the SQL library: `analytics/sql/queries.sqlite.sql` and `queries.postgres.sql`;
- the Power BI extracts and DAX guide: `docs/powerbi/`;
- the Python toolkit: `analytics/python/safebite_analytics/kpis.py`.

If a definition changes, update all four and the automated tests together.

## 1. Reading the catalogue

- **Unit** describes the display format, not the storage type.
- **Desired direction** drives the favourable/adverse label. `neutral` means no
  value judgement is applied.
- **Measurement** is `event` (records inside the period) or `snapshot` (the state
  at the period end).
- **Current** is the selected period. **Previous** is the immediately preceding
  window of equal length.
- Percentages are stored as 0–100 in the engine and formatted to one decimal.
- Risk scores are 0–100, higher = riskier. They are deterministic weighted policy
  rules, not a probability and not a trained model.

## 2. The 13 KPIs

| # | ID | KPI | Unit | Desired | Measurement | Definition / formula | Source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `registered_businesses` | Registered businesses | count | neutral | snapshot | Count of businesses with `registeredAt < period end` and `status <> 'closed'`. | Business |
| 2 | `high_risk_premises` | High-risk premises (C + D) | count | down | snapshot | Count of registered, non-closed premises whose latest risk snapshot on or before period end is tier C or D. Premises without a snapshot are excluded. | Business, RiskSnapshot |
| 3 | `average_risk_score` | Average risk score | score | down | snapshot | Mean of each rated premises' latest snapshot score on or before period end. | Business, RiskSnapshot |
| 4 | `inspections_completed` | Inspections completed | count | up | event | Count of inspections with `completedAt` in `[start, end)`. | Inspection |
| 5 | `inspection_completion_rate` | Inspection completion rate | percent | up | event | Inspections scheduled in `[start, dueEnd)` with `completedAt < end`, divided by inspections scheduled in `[start, dueEnd)`. `dueEnd = min(period end, extract now)`. | Inspection |
| 6 | `critical_violations` | Critical violations | count | down | event | Count of violations with `severity = 'critical'` whose parent inspection completed in `[start, end)`. | Violation, Inspection |
| 7 | `violations_per_inspection` | Violations per inspection | rate | down | event | All violations on completed inspections in the period divided by the number of completed inspections. Inspections with zero findings stay in the denominator. | Violation, Inspection |
| 8 | `repeat_violation_rate` | Repeat violation share | percent | down | event | Findings in the period whose violation type was already recorded at the same business by an inspection completed before `start`, divided by all findings in the period. | Violation, Inspection |
| 9 | `complaints_received` | Complaints received | count | neutral | event | Count of complaints with `createdAt` in `[start, end)`. | Complaint |
| 10 | `complaints_resolved` | Complaints resolved | count | up | event | Count of complaints with `resolvedAt` in `[start, end)` and `resolvedAt >= createdAt`. | Complaint |
| 11 | `average_resolution_days` | Average resolution time | days | down | event | Mean of `(resolvedAt - createdAt) / 86,400,000 ms` for valid resolutions in the period. | Complaint |
| 12 | `sla_compliance` | Complaint SLA compliance | percent | up | event | Valid resolutions in the period whose duration is `<= slaDays`, divided by valid resolutions in the period. | Complaint |
| 13 | `overdue_open_complaints` | Overdue open complaints | count | down | snapshot | Complaints created before period end, not resolved by period end, and whose `createdAt + slaDays` is before period end. Complaints marked resolved without a timestamp are excluded and surfaced in data quality. | Complaint |

## 3. Period and comparison rules

### Presets

| Key | Window |
| --- | --- |
| `last7` | Start of IST day 6 days ago through now. |
| `last30` | Start of IST day 29 days ago through now. |
| `last90` | Start of IST day 89 days ago through now. |
| `current_month` | Start of the current IST month through now. |
| `previous_month` | Start of the previous IST month through start of the current month. |
| `custom` | Start of the `from` IST day through the end of the `to` IST day. |

The previous window is `[start - duration, start)`, where `duration` is
`max(1 day, end - start)`. This is an equal-length comparison, not "the previous
calendar month" unless the selected period is itself a month.

### Boundaries

- User-facing dates are Asia/Kolkata (UTC+05:30).
- The database stores UTC timestamps.
- IST day boundaries are converted to UTC before querying. A record at 23:00 IST
  falls in that IST day even though its UTC date may already be the next day.
- Power BI and Python extracts use UTC date columns. Small boundary differences
  are expected when reconciling at the current-day edge; the app is authoritative.

## 4. Risk score definitions

| Factor | Max points | Rule |
| --- | --- | --- |
| Previous violations | 40 | Severity weight (`critical` 10, `high` 6, `medium` 3, `low` 1) × recency decay (`0.95 ^ months`), summed over inspections completed on or before the scoring date, capped at 40. |
| Recent complaints | 25 | Complaints in the 90 days before the scoring date: new/submitted 4 points, in-review or substantiated 7 points each, capped at 25. |
| Inspection timeliness | 15 | `max(0, months since last completed inspection - 6) × 2.5`, capped at 15. A never-inspected business receives 15. A future scheduled follow-up subtracts 4 points (floor 0). |
| Document compliance | 10 | Expired documents on file: 4 points each, capped at 10. No documents on file: 4 points. |
| Category baseline | 10 | Policy baseline: street vendor 9, meat/poultry 8, restaurant 6, catering 6, manufacturer 5, bakery 4, warehouse 4, packaged retail 3, otherwise 5. |

The raw total is rounded to one decimal, then clamped and rounded to a whole
number for the stored score. Tier bands: A ≤ 25, B ≤ 50, C ≤ 75, D > 75.

The risk engine is deterministic and reproducible with an explicit `asOf`. It is
**not** trained on outcomes, does not forecast, and must not be presented as a
probability of illness or as an official regulatory determination.

## 5. Snapshot semantics

Risk KPIs and the risk register use the latest stored `RiskSnapshot` at or before
the relevant date.

- Historical dates never use today's register score as a substitute.
- A premises with no snapshot is unrated, not assumed safe.
- The only fallback is the live register when the as-of date is effectively the
  extract timestamp; this prevents an empty current view when a snapshot has not
  yet been written.
- Snapshots are written when a material change occurs (score movement of at least
  2 points) or when the latest snapshot is more than 24 hours old. Completed
  inspections force a snapshot. The seed writes six monthly snapshots per business
  for the demo.

## 6. Current seeded values (illustration only)

At the seeded extract dated 8 November 2026, trailing 90 days:

| KPI | Current | Previous |
| --- | --- | --- |
| Registered businesses | 56 | 56 |
| High-risk premises | 8 | 0 |
| Average risk score | 24.9 | 18.6 |
| Inspections completed | 19 | 12 |
| Inspection completion rate | 85.0% | 76.9% |
| Critical violations | 16 | 0 |
| Violations per inspection | 2.11 | 0.67 |
| Repeat violation share | 60.0% | 25.0% |
| Complaints received | 46 | 12 |
| Complaints resolved | 2 | 13 |
| Average resolution time | 5.5 d | 3.9 d |
| SLA compliance | 50.0% | 84.6% |
| Overdue open complaints | 35 | 0 |

These values move when the seed is rerun on a different date because the demo
generator anchors dates relative to "now". Use `npm run analytics:smoke` for the
authoritative current figures. Do not hard-code these numbers into a report.

## 7. Interpretation guardrails

1. **Do not rank on a percentage alone.** A district with one premises can show a
   100% high-risk share. Read the counts.
2. **Do not compare a KPI across different filters.** The previous value uses the
   same scope as the current value.
3. **Do not treat missing data as zero.** A null completion rate means the
   denominator was empty, not that performance was 0%.
4. **Do not describe risk as prediction.** It is a weighted policy score.
5. **Do not hide invalid lifecycles.** Resolution metrics exclude them, and the
   data-quality page names them.
6. **Do not mix IST and UTC boundaries** when reconciling the app to Power BI or
   Python. The app uses IST day boundaries; extracts use UTC dates.
7. **Do not imply government endorsement.** The dataset is synthetic.

## 8. Change control

To change a KPI:

1. Update the definition and implementation in `src/lib/analytics/kpis.ts`.
2. Update both SQL dialects and `EXPECTED_COLUMNS` in `scripts/validate-sql.ts`.
3. Update the Power BI extract/DAX documentation if the exported fields change.
4. Update `analytics/python/safebite_analytics/kpis.py`.
5. Update this document and the methodology page.
6. Add or adjust automated tests.
7. Run every quality gate in [testing-strategy.md](testing-strategy.md).
