# Power BI DAX measures

This file mirrors the 13 governed KPIs in `src/lib/analytics/kpis.ts`. Create a
measure table (Model view → **New table** → blank query) or add the measures to
the relevant fact tables. Use display folders to keep them organised:

- `01 Premises & risk`
- `02 Inspections`
- `03 Complaints`
- `04 Comparisons`

> These DAX definitions have not been executed in Power BI Desktop as part of
> the automated test run (Power BI is a desktop application and is not available
> in CI). Validate them against the in-app figures after loading the CSV extracts.
> Report totals should reconcile with `npm run analytics:smoke` for the trailing
> 90 days; boundary differences are expected because the app uses Asia/Kolkata
> day boundaries.

## Supporting pattern: point-in-time risk

The snapshot table stores history. "Current risk" always means the latest
snapshot on or before the period end, never an average of the whole period.

```dax
Latest Snapshot Score (as of period end) =
VAR AsOfDate = COALESCE(MAX('dim_date'[date]), TODAY())
RETURN
AVERAGEX(
    VALUES('dim_business'[businessId]),
    VAR CurrentBusiness = 'dim_business'[businessId]
    VAR LatestSnapshot =
        CALCULATETABLE(
            TOPN(
                1,
                FILTER(
                    'fact_risk_snapshots',
                    'fact_risk_snapshots'[businessId] = CurrentBusiness
                        && 'fact_risk_snapshots'[snapshotDate] <= AsOfDate
                ),
                'fact_risk_snapshots'[snapshotDate], DESC
            ),
            REMOVEFILTERS('dim_date')
        )
    RETURN MAXX(LatestSnapshot, 'fact_risk_snapshots'[score])
)
```

The `REMOVEFILTERS('dim_date')` is essential: without it, a slicer would hide
snapshots from earlier months and the measure would silently pick the latest row
inside the selected window instead of at its end.

## 01 Premises & risk

### 1. Registered businesses

```dax
Registered Businesses =
VAR AsOfDate = COALESCE(MAX('dim_date'[date]), TODAY())
RETURN
CALCULATE(
    COUNTROWS('dim_business'),
    KEEPFILTERS('dim_business'[registeredAt] < AsOfDate + 1),
    KEEPFILTERS('dim_business'[status] <> "closed")
)
```

### 2. High-risk premises (C + D)

```dax
High-Risk Premises =
VAR AsOfDate = COALESCE(MAX('dim_date'[date]), TODAY())
VAR Result =
    COUNTROWS(
        FILTER(
            VALUES('dim_business'[businessId]),
            VAR CurrentBusiness = 'dim_business'[businessId]
            VAR LatestSnapshot =
                CALCULATETABLE(
                    TOPN(
                        1,
                        FILTER(
                            'fact_risk_snapshots',
                            'fact_risk_snapshots'[businessId] = CurrentBusiness
                                && 'fact_risk_snapshots'[snapshotDate] <= AsOfDate
                        ),
                        'fact_risk_snapshots'[snapshotDate], DESC
                    ),
                    REMOVEFILTERS('dim_date')
                )
            VAR LatestTier = MAXX(LatestSnapshot, 'fact_risk_snapshots'[tier])
            RETURN LatestTier IN {"C", "D"}
        )
    )
RETURN
CALCULATE(Result, KEEPFILTERS('dim_business'[status] <> "closed"))
```

### 3. Average risk score

```dax
Average Risk Score =
CALCULATE(
    [Latest Snapshot Score (as of period end)],
    KEEPFILTERS('dim_business'[status] <> "closed")
)
```

Show as a decimal with one place, not a percentage. The score is a weighted policy
value with a 0–100 range.

### Current tier mix (column/bar visual)

For the current state, use `dim_business[riskTier]` with `Tier Order` as the
sort-by column. For a historical tier mix, add `fact_risk_snapshots[snapshotDate]`
to the visual axis and use the latest-snapshot filter pattern above. Do not
average tier text.

## 02 Inspections

### 4. Inspections completed

```dax
Inspections Completed =
CALCULATE(
    COUNTROWS('fact_inspections'),
    KEEPFILTERS('fact_inspections'[status] = "completed"),
    USERELATIONSHIP('fact_inspections'[completedDate], 'dim_date'[date])
)
```

### 5. Inspection completion rate

```dax
Inspection Completion Rate =
VAR AsOfDate = COALESCE(MAX('dim_date'[date]), TODAY())
VAR DueInspections = COUNTROWS('fact_inspections')
VAR CompletedDue =
    CALCULATE(
        COUNTROWS('fact_inspections'),
        FILTER(
            'fact_inspections',
            NOT ISBLANK('fact_inspections'[completedDate])
                && 'fact_inspections'[completedDate] <= AsOfDate
        )
    )
RETURN
DIVIDE(CompletedDue, DueInspections)
```

Format as a percentage with one place. The denominator is inspections whose
planned date falls in the selected period; future-dated inspections in the live
period are still counted as due in the app, so the Power BI and in-app values can
differ slightly at the current-day edge.

### 6. Critical violations

```dax
Critical Violations =
CALCULATE(
    COUNTROWS('fact_violations'),
    KEEPFILTERS('fact_violations'[severity] = "critical")
)
```

### 7. Violations per inspection

```dax
Violations per Inspection =
DIVIDE(
    COUNTROWS('fact_violations'),
    [Inspections Completed]
)
```

### 8. Repeat violation share

`fact_violations[isRepeat]` is precomputed by `scripts/export-powerbi.ts` using
the same definition as the app: the same violation type already existed at the
same business before this inspection.

```dax
Repeat Violation Share =
VAR Findings = COUNTROWS('fact_violations')
VAR Repeats = COALESCE(SUM('fact_violations'[isRepeat]), 0)
RETURN
DIVIDE(Repeats, Findings)
```

## 03 Complaints

### 9. Complaints received

```dax
Complaints Received = COUNTROWS('fact_complaints')
```

The active relationship is `fact_complaints[createdDate] → dim_date[date]`.

### 10. Complaints resolved

```dax
Complaints Resolved =
CALCULATE(
    COUNTROWS('fact_complaints'),
    KEEPFILTERS('fact_complaints'[status] = "resolved"),
    KEEPFILTERS(NOT ISBLANK('fact_complaints'[resolvedAt])),
    USERELATIONSHIP('fact_complaints[resolvedDate]', 'dim_date'[date])
)
```

### 11. Average resolution days

```dax
Average Resolution Days =
CALCULATE(
    AVERAGE('fact_complaints'[resolutionDays]),
    USERELATIONSHIP('fact_complaints[resolvedDate]', 'dim_date'[date])
)
```

`resolutionDays` is blank when the lifecycle is impossible (`resolvedAt < createdAt`)
or the complaint has no valid resolution, so it is excluded automatically.

### 12. Complaint SLA compliance

```dax
SLA Compliance =
CALCULATE(
    AVERAGE('fact_complaints'[slaWithinTarget]),
    USERELATIONSHIP('fact_complaints[resolvedDate]', 'dim_date'[date])
)
```

`slaWithinTarget` is `1` within SLA, `0` breached, blank when not evaluable.
Format as a percentage.

### 13. Overdue open complaints

```dax
Overdue Open Complaints =
VAR AsOfDate = COALESCE(MAX('dim_date'[date]), TODAY())
RETURN
CALCULATE(
    COUNTROWS(
        FILTER(
            'fact_complaints',
            'fact_complaints'[createdDate] <= AsOfDate
                && (
                    ISBLANK('fact_complaints'[resolvedDate])
                        || 'fact_complaints'[resolvedDate] > AsOfDate
                )
                && 'fact_complaints'[createdDate] + 'fact_complaints'[slaDays] < AsOfDate
        )
    ),
    REMOVEFILTERS('dim_date')
)
```

This is an as-of measure: it counts complaints created before the period end
that were still unresolved and past due, so the date slicer is deliberately
cleared. District/category slicers on `dim_business` still apply.

## 04 Comparisons

### Previous period

```dax
Previous Period =
VAR DaysInPeriod = MAX('dim_date'[date]) - MIN('dim_date'[date]) + 1
RETURN
IF(
    NOT ISBLANK(DaysInPeriod),
    CALCULATE([Selected KPI], DATEADD('dim_date'[date], -DaysInPeriod, DAY))
)
```

Replace `[Selected KPI]` with the measure being compared. `DATEADD` shifts the
whole selected range back by its own length, matching the app's equal-length
comparison.

For a visual with multiple KPIs, create one "previous" measure per KPI rather
than a dynamic measure selector; the explicit version is easier to audit.

### Change and assessment

```dax
KPI Change % =
VAR CurrentValue = [Selected KPI]
VAR PreviousValue = [Previous Period]
RETURN
DIVIDE(CurrentValue - PreviousValue, ABS(PreviousValue))
```

```dax
SLA Assessment =
VAR Change = [SLA Compliance] - [Previous Period]
RETURN
SWITCH(
    TRUE(),
    ISBLANK(Change), "No baseline",
    ABS(Change) < 0.0001, "Flat",
    Change > 0, "Favourable",
    "Adverse"
)
```

For KPIs where lower is better (average risk score, critical violations, resolution
days, overdue backlog), reverse the favourable/adverse labels.

## Visual and formatting conventions

- `Compliance`, `share`, `rate` → percentage, one decimal place.
- Risk score → decimal, one place, fixed 0–100 axis.
- Days → decimal, one place, suffix ` d`.
- Counts → whole number, thousands separator.
- Use a single accent colour for neutral series and reserve red/orange for
  adverse movement or high-risk tiers.
- Add a tooltip page containing the KPI definition from `kpi_definitions.csv`.
- Add a header disclaimer on every page: synthetic demo data; deterministic
  rules, not ML; not official government statistics.

## Reconciliation checklist

After loading a fresh extract:

1. `Registered Businesses` = 56.
2. `Inspections Completed` (trailing 90 days) = 19.
3. `Critical Violations` (trailing 90 days) = 16.
4. `High-Risk Premises` = 8.
5. `Overdue Open Complaints` = about 35 at the seeded date.
6. `kpi_definitions.csv` has 13 rows.
7. `data_quality_findings.csv` has 20 rules (findings + passes).

The exact values shift if the seed is re-run on a different date because the demo
generator anchors relative dates to "now". Re-run `npm run analytics:smoke` for
the authoritative current figures.
