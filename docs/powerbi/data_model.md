# Power BI data model

## Star schema

```
                         ┌───────────────┐
                         │   dim_date    │
                         │  date (PK)    │
                         └──────┬────────┘
                                │
        ┌───────────────────────┼────────────────────────┐
        │                       │                        │
┌───────┴────────┐     ┌────────┴────────┐     ┌─────────┴──────────┐
│ fact_inspections│     │  fact_complaints │     │ fact_risk_snapshots│
│ scheduledDate   │     │  createdDate     │     │ snapshotDate       │
│ completedDate*  │     │  resolvedDate*   │     └─────────┬──────────┘
└───────┬────────┘     └────────┬────────┘               │
        │                       │                        │
        │  ┌────────────────────┴───────────────┐        │
        └──┤            dim_business            ├────────┘
           │           businessId (PK)          │
           └────────────────┬───────────────────┘
                            │
                  ┌─────────┴─────────┐
                  │   fact_violations │
                  │  completedDate    │
                  └───────────────────┘

           dim_officer ──< fact_inspections[officerId]
```

`*` inactive relationship, activated in measures with `USERELATIONSHIP`.

`kpi_definitions` and `dataset_manifest` are disconnected reference tables.
`district_scorecard` is a prepared aggregate and should not be related to the
star schema (it would double-count if related to facts).

## Table dictionaries

### dim_business

| Column | Type | Description |
| --- | --- | --- |
| `businessId` | Text | Primary key. |
| `name` | Text | Trading name. |
| `category` | Text | Business category code (restaurant, bakery, …). |
| `district` | Text | Operational district. |
| `licenseNumber` | Text | FSSAI-style licence number. Duplicates exist intentionally for the data-quality demo. |
| `address` | Text | Registered address. |
| `status` | Text | `active`, `suspended` or `closed`. Current status only. |
| `riskScore` | Decimal | Current deterministic score, 0–100. |
| `riskTier` | Text | `A` low, `B` moderate, `C` high, `D` critical. |
| `registeredAt` | Date/Time | Registration timestamp. |
| `registeredDate` | Date | Date-only helper for relationships. |
| `lat`, `lng` | Decimal | Coordinates. Five demo records deliberately fall outside the India bounding box for data-quality testing. |

### dim_date

Generated for 2024-01-01 through 2027-12-31 using UTC calendar dates. Mark as the
date table. `weekOfMonth` is a simple calendar week; use `yearMonth` for monthly
axes.

### dim_officer

| Column | Type | Description |
| --- | --- | --- |
| `officerId` | Text | Primary key. |
| `name` | Text | Officer name. |
| `district` | Text | Officer's recorded district (demo value may be state-level). |
| `role` | Text | Always `food_officer` in this extract. |

### fact_inspections

| Column | Type | Description |
| --- | --- | --- |
| `inspectionId` | Text | Primary key. |
| `businessId` | Text | Foreign key to `dim_business`. |
| `businessName`, `district`, `category` | Text | Denormalised labels for tables and tooltips. Prefer dimension fields in slicers. |
| `officerId`, `officerName` | Text | Assigned officer. |
| `status` | Text | `scheduled`, `completed` or `missed`. |
| `scheduledAt` | Date/Time | Planned date and time. |
| `scheduledDate` | Date | Active date relationship. |
| `completedAt` | Date/Time | Completion timestamp; blank when not completed. |
| `completedDate` | Date | Inactive date relationship. |
| `turnaroundDays` | Decimal | `completedAt − scheduledAt` in calendar days; blank if negative or missing. |
| `violationCount` | Whole number | Number of findings. |
| `criticalViolationCount` | Whole number | Findings with severity `critical`. |

### fact_violations

| Column | Type | Description |
| --- | --- | --- |
| `violationId` | Text | Primary key. |
| `inspectionId` | Text | Parent inspection. |
| `businessId` | Text | Foreign key to `dim_business`. |
| `businessName`, `district`, `category`, `officerName` | Text | Labels. |
| `completedAt` / `completedDate` | Date/Time / Date | Parent inspection completion, on which the active date relationship is based. |
| `violationType` | Text | Controlled violation type. |
| `severity` | Text | `low`, `medium`, `high` or `critical`. |
| `description` | Text | Finding note. |
| `isRepeat` | Whole number | `1` when the same violation type was already recorded at the same business before this inspection. `0` otherwise. This is precomputed so DAX does not need a slow self-join. |

### fact_complaints

| Column | Type | Description |
| --- | --- | --- |
| `complaintId` | Text | Primary key. |
| `businessId` | Text | Blank for unattached complaints. |
| `businessName`, `district` | Text | Labels; district falls back to the complaint's own district. |
| `complaintType` | Text | Type code, or `unspecified`. |
| `status` | Text | `submitted`, `under_review`, `inspection_scheduled` or `resolved`. |
| `anonymous` | Whole number | `1` for anonymous. Anonymous complaints with no citizen link are valid and not a quality finding. |
| `hasCitizenLink` | Whole number | `1` when a citizen identity is attached. Used to detect contradictory anonymity without exporting the identity. |
| `createdAt` / `createdDate` | Date/Time / Date | Receipt. Active date relationship. |
| `assignedAt` | Date/Time | Officer assignment. |
| `investigationStartedAt` | Date/Time | Casework start. |
| `inspectionAt` | Date/Time | Inspection stage. |
| `resolvedAt` / `resolvedDate` | Date/Time / Date | Valid resolution; inactive date relationship. |
| `slaDays` | Whole number | Policy target in calendar days. |
| `resolutionDays` | Decimal | `resolvedAt − createdAt` when non-negative; blank when invalid. |
| `slaWithinTarget` | Whole number | `1` within SLA, `0` breached, blank when no valid resolution. |
| `assignedOfficerName` | Text | Officer label. |

Complaint descriptions and citizen identifiers are **not** exported.

### fact_risk_snapshots

| Column | Type | Description |
| --- | --- | --- |
| `snapshotId` | Text | Primary key. |
| `businessId` | Text | Foreign key to `dim_business`. |
| `businessName`, `district`, `category` | Text | Labels. |
| `score` | Decimal | Deterministic risk score, 0–100. |
| `tier` | Text | `A`–`D`. |
| `snapshotAt` / `snapshotDate` | Date/Time / Date | Point-in-time of the score. |
| `factorViolations` | Decimal | Points contributed by inspection findings (max 40). |
| `factorComplaints` | Decimal | Points contributed by recent complaints (max 25). |
| `factorInspectionTimeliness` | Decimal | Points for inspection gaps (max 15). |
| `factorDocuments` | Decimal | Points for document gaps/expiry (max 10). |
| `factorCategory` | Decimal | Category baseline (max 10). |

## Calculated columns

Add these in Power BI if you need them as slicers; the underlying fields are
already exported.

```dax
Tier Order =
SWITCH(dim_business[riskTier], "A", 1, "B", 2, "C", 3, "D", 4, 99)
```

```dax
Is High Risk = IF(dim_business[riskTier] IN {"C", "D"}, 1, 0)
```

```dax
Resolution Bucket =
SWITCH(
    TRUE(),
    ISBLANK(fact_complaints[resolutionDays]), "Not resolvable",
    fact_complaints[resolutionDays] <= 3, "0–3 days",
    fact_complaints[resolutionDays] <= 7, "4–7 days",
    fact_complaints[resolutionDays] <= 14, "8–14 days",
    "15+ days"
)
```

Use `Tier Order` as the sort-by column for `riskTier`.

## Modelling rules

1. Keep relationship filtering single-direction (dimension → fact). Bidirectional
   relationships make the risk-snapshot "latest row" pattern ambiguous.
2. Never relate `district_scorecard` to facts. It is a report-ready aggregate.
3. Use the date dimension for all time slicing. Do not slice directly on
   `createdAt` / `completedAt`; timestamp slicers break period comparisons.
4. Format scores as decimals with one place, rates as percentages with one
   place, and counts with thousands separators.
5. Add a report-page disclaimer: synthetic demo data, not government statistics,
   deterministic risk rules rather than ML.
6. Reconcile totals to `npm run analytics:smoke` for the trailing 90 days after
   each dataset refresh. Small differences at boundaries are expected because
   the app uses Asia/Kolkata day boundaries while the extract uses UTC dates.
