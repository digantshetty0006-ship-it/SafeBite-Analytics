# Process analysis: complaints and inspections

This document explains how the **Process efficiency** page measures the food-safety
workflow, what each stage means, where the bottlenecks are, and — importantly —
which stages **cannot** be measured with the current schema.

> **Synthetic demo data.** The seeded dataset is not official government
> statistics and does not imply government endorsement. Timings are calendar
> days, not business hours.

## 1. Why this page exists

The KPI overview answers *what changed*. The process page answers *where the time
goes*. It follows complaints created in the selected period through the lifecycle
timestamps that actually exist, and it measures inspection completion and
turnaround from the planned date to the recorded completion.

Every duration is computed from a pair of stored timestamps. Nothing is estimated,
imputed or modelled. When a pair is impossible (for example resolution before
creation), it is excluded from the duration sample and counted in
`excludedDurations`.

## 2. The complaint lifecycle

### Available stages

| # | Stage | From → To | Meaning |
| --- | --- | --- | --- |
| 1 | Receipt → assignment | `createdAt` → `assignedAt` | Time until an officer owns the case. Used as a **proxy for acknowledgement**, because no acknowledgement timestamp exists. |
| 2 | Assignment → investigation start | `assignedAt` → `investigationStartedAt` | Time until casework begins. |
| 3 | Investigation → inspection | `investigationStartedAt` (or `assignedAt` when missing) → `inspectionAt` | Time until the inspection stage is reached. The fallback start is documented on the page. |
| 4 | Last casework stage → resolution | `inspectionAt` / `investigationStartedAt` / `assignedAt` / `createdAt` (latest available) → `resolvedAt` | Time from the last recorded casework milestone to a valid resolution. |
| 5 | Receipt → resolution | `createdAt` → `resolvedAt` | End-to-end complaint resolution. |

### Cohort definition

The page uses a **cohort view**: complaints whose `createdAt` falls inside the
selected period are followed through their current lifecycle records, even if a
later stage happened after the period end. This is intentional — a cohort answers
"of the complaints we received in this period, how far did they get and how long
did each step take?" Filtering each stage independently would mix cohorts of
different ages and distort the funnel. The visible period label and cohort size
make the boundary explicit.

### Funnel

The funnel shows how many cohort complaints reached each milestone:

```
Created  →  Assigned  →  Investigation started  →  Inspection stage reached  →  Resolved
```

Counts are cumulative in the sense that each step requires the corresponding
timestamp; a complaint can be resolved without an inspection timestamp (for
example a documentation-only resolution), so the funnel is a stage-reach view
rather than a strict linear drop-off. The page presents counts and shares side by
side so a small cohort is not over-interpreted.

### What counts as a valid resolution

A complaint contributes to the resolution and end-to-end durations only when:

- `resolvedAt` is present;
- `resolvedAt >= createdAt`; and
- the preceding stage timestamp used for the pair is not later than `resolvedAt`
  (otherwise that stage pair is excluded and counted).

A complaint with status `resolved` and no `resolvedAt` is **not** counted as
resolved in process metrics. It is surfaced by the data-quality rule
`C-RES-MISSING` instead of being silently repaired.

## 3. Inspection metrics

| Metric | Definition |
| --- | --- |
| Inspections completed | Inspections with `completedAt` inside the period. |
| Inspections due | Inspections with `scheduledAt` in `[period start, min(period end, now))`. Future scheduled inspections are not yet due. |
| Completion rate | Due inspections with `completedAt < period end`, divided by due inspections. |
| Overdue backlog | Inspections still in status `scheduled` whose `scheduledAt` is before the extract time. This is a point-in-time backlog, not limited to the period. |
| Missed inspections | Inspections with status `missed` and `scheduledAt` inside the period. |
| Turnaround | Calendar days from `scheduledAt` to `completedAt` for inspections completed in the period. Negative values are excluded and counted. |

Turnaround measures **planned date to completion**, not on-site duration. It
includes any delay between the planned visit and the actual visit plus the time to
record completion, which is the closest available proxy for inspection lag.

## 4. Quantiles and interpretation

For every stage the page shows:

- **Reached** — cohort records that have the stage timestamp at all.
- **Sample size** — records with a valid, non-negative pair of timestamps for that
  stage. This can be smaller than *reached* because the previous stage may be
  missing.
- **Median** — typical case; resistant to a single very slow record.
- **Average** — sensitive to outliers; shown next to the median so skew is visible.
- **p90** — worst-case experience: 90% of valid cases were at or below this
  duration.

The engine uses a nearest-rank percentile: for `n` sorted values and `p = 90`,
the index is `ceil(0.9 × n) - 1`, clamped to the array. Medians average the two
middle values for even samples.

**Small samples.** A median based on fewer than five records is noise, not a
process baseline. The UI displays sample size on every stage, and the notes repeat
this warning. Do not set targets from a tiny cohort.

**Calendar days.** Durations use calendar days and include weekends. There is no
business-calendar table, so "3 days" may span a weekend. Do not compare directly
with a service standard expressed in business days.

## 5. Unavailable stages

The schema does not contain timestamps for several stages that a full process
analysis would normally cover. The page lists them explicitly rather than
estimating them:

| Unavailable stage | Why it cannot be measured |
| --- | --- |
| Complaint acknowledgement | No acknowledgement timestamp. Receipt → assignment is shown as a labelled proxy. |
| On-site inspection duration / travel time | Inspections store a planned date and a completion timestamp, but no start, arrival or travel times. |
| Inspection report approval / publication | No report-submitted, approved or published timestamps. Report-writing and approval lag cannot be calculated. |
| Laboratory result turnaround | No sample, dispatch, receipt or result timestamps are modelled. |
| Enforcement action and case closure | No enforcement or legal closure timestamps. Complaint resolution is the final measurable stage. |
| Business registration approval | Only `registeredAt` is stored; application, review and approval stages are not modelled. |

This gap is a schema limitation, not a UI omission. Phase 2 proposes the fields
needed to close it (see [roadmap.md](roadmap.md)).

## 6. Current seeded illustration

At the seeded extract dated 8 November 2026, trailing 90 days, the process page
reports (values move when the seed is rerun on another date):

- complaint cohort and funnel counts derived from 46 complaints created in the
  period;
- stage medians and p90 in calendar days for the five available complaint stages;
- inspection completion rate, overdue backlog and missed inspections;
- turnaround from planned date to completion;
- a non-zero count of excluded impossible durations, driven by the deliberate
  seed anomalies.

Use `npm run analytics:smoke` for the authoritative current figures. Do not copy
these values into a report as if they were official statistics.

## 7. How to act on the results

1. **Start with the funnel.** A large loss between two stages points to a
   queue-ownership problem, not a slow individual officer.
2. **Compare median with p90.** A stable median and a large p90 indicates a
   long tail — usually a few stalled cases — rather than a uniformly slow process.
3. **Read backlog next to completion rate.** A high completion rate with a rising
   overdue backlog means demand is outrunning capacity.
4. **Check exclusions.** A rising `excludedDurations` count means data quality is
   degrading and the durations shown are based on fewer records.
5. **Cross-check with data quality.** Out-of-order lifecycles appear on the
   quality page with record links; fix the source record rather than the metric.

## 8. Reconciliation notes

- The process page uses the same filtered dataset and scope helpers as the KPI
  engine (`makeScope`, `complaintInScope`, `inspectionInScope`).
- The SQL query `complaint_stage_durations` mirrors the stage definitions for
  external audit.
- Inspection completion in process analytics uses the same `completedAt` event
  window as KPI #4. The due denominator uses `scheduledAt` with the
  `min(period end, now)` cap, matching KPI #5.
- The Python toolkit does not reproduce the process page stage-by-stage; it
  reproduces the governed KPIs, risk views and quality reconciliation. Process
  timings are audited through the SQL library and the UI.
