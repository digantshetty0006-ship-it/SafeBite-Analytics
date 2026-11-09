# SafeBite Power BI model

A star-schema extract of the SafeBite demo database for self-service BI. The
extracts are generated from the same Prisma records as the in-app intelligence
workspace, so totals can be reconciled — but the app remains the source of truth
for the governed KPI definitions.

> **Synthetic data.** The database is seeded with demonstration records. These
> files are not official government statistics and do not imply government
> endorsement. Risk scores are deterministic policy rules, not a trained
> machine-learning model.

## Generating the files

```bash
npm run db:seed              # restore the deterministic demo dataset
npm run analytics:datasets   # write public/powerbi/*.csv
```

Output directory: `public/powerbi/`.

| File | Grain | Rows in the seeded demo |
| --- | --- | --- |
| `dim_business.csv` | one row per business | 56 |
| `dim_date.csv` | one row per date, 2024–2027 | 1,461 |
| `dim_officer.csv` | one row per Food Safety Officer | 4 |
| `fact_inspections.csv` | one row per inspection | 90 |
| `fact_violations.csv` | one row per violation | 120 |
| `fact_complaints.csv` | one row per complaint | 78 |
| `fact_risk_snapshots.csv` | one row per stored snapshot | 336 |
| `kpi_definitions.csv` | one row per KPI | 13 |
| `data_quality_findings.csv` | one row per data-quality rule | 20 |
| `district_scorecard.csv` | one row per district | 6 |
| `dataset_manifest.csv` | one row per file | 11 |

`dataset_manifest.csv` records row counts and the generation timestamp. Always
check it after a refresh.

## Load steps (Power BI Desktop)

1. **Get Data → Text/CSV** for each file. Do not use *Combine Files* blindly:
   the tables have different schemas and combined headers are hard to repair.
2. On the preview, choose **Transform Data** and confirm:
   - `dim_business`: `registeredAt` = Date/Time; `registeredDate` = Date; keys = Text.
   - `dim_date`: `date` = Date; year/month/week columns = Whole Number.
   - `fact_inspections`: `scheduledAt`/`completedAt` = Date/Time;
     `scheduledDate`/`completedDate` = Date; counts = Whole Number.
   - `fact_violations`: `completedAt` = Date/Time; `completedDate` = Date;
     `isRepeat` = Whole Number.
   - `fact_complaints`: lifecycle timestamps = Date/Time;
     `createdDate`/`resolvedDate` = Date; `resolutionDays` = Decimal Number;
     `slaWithinTarget` = Whole Number.
   - `fact_risk_snapshots`: `snapshotAt` = Date/Time; `snapshotDate` = Date;
     `score` and factor columns = Decimal Number.
3. **Mark `dim_date` as date table** using the `date` column.
4. Create the relationships listed below. Set cardinality to *many-to-one* and
   single-direction filtering unless stated otherwise.
5. Hide all `*Id` key columns from report view. Keep business/officer names and
   dates visible.
6. Sort `dim_date[month]` by `monthNumber`, and `dim_date[dayName]` by
   `dayOfWeek` (or use the supplied numeric columns directly).
7. Sort `dim_business[riskTier]` with a small custom order table or a
   `Tier Order` calculated column: A = 1, B = 2, C = 3, D = 4.
8. Import `kpi_definitions.csv` as a **disconnected** reference table. It powers
   a definitions page and tooltips; it must not be related to the facts.
9. Add the measures from `docs/powerbi/dax_measures.md`.
10. Save the report, then publish to a workspace if required.

## Relationships

| From (many) | To (one) | Active | Notes |
| --- | --- | --- | --- |
| `fact_inspections[businessId]` | `dim_business[businessId]` | Yes | Business slicing. |
| `fact_inspections[officerId]` | `dim_officer[officerId]` | Yes | Officer workload. |
| `fact_inspections[scheduledDate]` | `dim_date[date]` | Yes | Default inspection date. |
| `fact_inspections[completedDate]` | `dim_date[date]` | **No** | Activated with `USERELATIONSHIP` for completion measures. |
| `fact_violations[businessId]` | `dim_business[businessId]` | Yes | Finding slicing. |
| `fact_violations[completedDate]` | `dim_date[date]` | Yes | Findings belong to the inspection completion date. |
| `fact_complaints[businessId]` | `dim_business[businessId]` | Yes | Business slicing; blanks are unattached complaints. |
| `fact_complaints[createdDate]` | `dim_date[date]` | Yes | Complaints received. |
| `fact_complaints[resolvedDate]` | `dim_date[date]` | **No** | Activated for resolution and SLA measures. |
| `fact_risk_snapshots[businessId]` | `dim_business[businessId]` | Yes | Risk history. |
| `fact_risk_snapshots[snapshotDate]` | `dim_date[date]` | Yes | Snapshot trend visuals. |

Do **not** relate `fact_violations` to `fact_inspections` unless you need
drill-through by inspection; the shared business and completed-date dimensions
are sufficient for the documented measures.

## Snapshot semantics

`fact_risk_snapshots` contains one row per business per snapshot date. To answer
"what was risk at the end of the selected period", the DAX measures clear the
date filter and pick the latest snapshot on or before the period end. This
prevents a common error: averaging snapshots across the whole period and calling
it "current risk".

The in-app engine records snapshots when the score moves by at least 2 points or
when the latest snapshot is more than 24 hours old. The demo seed writes six
monthly snapshots. Historical comparisons beyond that window have no baseline.

## Refresh workflow

Power BI imports are static files. To refresh:

1. Re-run `npm run analytics:datasets` after the database changes.
2. In Power BI Desktop, **Refresh**; the folder path must still resolve.
3. For a published dataset, configure a gateway or upload the new files, then
   refresh the semantic model.

There is no live connection to the application database. This is deliberate:
production credentials are never embedded in a report, and report consumers see
a stable, auditable extract.

## Privacy and permissions

- The extracts contain no citizen identities, passwords, emails or complaint
  narratives. Complaint descriptions were excluded from `fact_complaints.csv`.
- The in-app role check does not carry into Power BI. Workspace permissions are
  the access control boundary. Do not distribute the CSVs publicly.
- Row-level security by district is **not** configured because the demo has no
  officer-to-district identity mapping. Add an RLS table and role if the report
  is used with district-scoped staff.

## Known limitations

- Complaint resolution uses calendar days, not business-day SLAs.
- The dataset has no acknowledgement, on-site inspection duration, laboratory,
  report-approval or enforcement timestamps.
- Business status in `dim_business` is current status; historical status changes
  are not modelled.
- `district_scorecard.csv` is a prepared trailing-90-day view. Recompute from
  facts if a different period is needed.
- The app's governed KPI engine applies Asia/Kolkata boundaries. Power BI date
  relationships use date-only columns; avoid mixing timestamp-level filters with
  date-level slicers when reconciling to the penny.
