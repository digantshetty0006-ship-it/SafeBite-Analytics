# Data dictionary

The source schema is Prisma (`prisma/schema.prisma` for SQLite and
`prisma/schema.pg.prisma` for PostgreSQL). This dictionary covers the fields used
by analytics, the derived measures, and the exported Power BI columns. It is not a
full API reference.

## 1. Type conventions

| Prisma | SQLite | PostgreSQL | Analytics use |
| --- | --- | --- | --- |
| `String` | TEXT | TEXT / VARCHAR | Codes, names, IDs. |
| `Int` | INTEGER | INTEGER | SLA days, counts. |
| `Float` | REAL | DOUBLE PRECISION | Scores, coordinates. |
| `Boolean` | INTEGER 0/1 | BOOLEAN | Anonymous flag. |
| `DateTime` | TEXT ISO-8601 | TIMESTAMP | Lifecycle and event times. |
| `Json` | TEXT | JSONB | Checklist, factor breakdown. |

Prisma stores SQLite `DateTime` values as ISO-8601 text with a UTC offset. SQL
queries that compare computed timestamps wrap values in `datetime()` or
`julianday()` so comparisons are chronological, not lexicographic.

## 2. Core entities

### Business

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Join key. |
| `name` | String | Trading name. | Display and exports. |
| `category` | String | Controlled category code. | Category filter, risk baseline, distribution. |
| `licenseNumber` | String | FSSAI-style licence. | Duplicate/missing quality rules, report identifier. |
| `address` | String | Registered address. | Display. |
| `district` | String | Operational district. | District filter and scorecard. |
| `lat`, `lng` | Float | Coordinates. | Map and coordinate quality rule. |
| `ownerId` | String | Business-owner user. | Ownership; not used in analytics. |
| `supplier` | String? | Legacy supplier label. | Not used; `Supplier` is authoritative. |
| `status` | String | `active`, `suspended` or `closed`. | Closed premises excluded from current register and risk KPIs. |
| `riskScore` | Float | Current deterministic score 0–100. | Current fallback and risk register. |
| `riskTier` | String | A/B/C/D. | Risk filter and tier distribution. |
| `registeredAt` | DateTime | Registration timestamp. | Historical register count. |

Indexes: `district`, `category`, `riskTier`, `status`, `licenseNumber`.

### Inspection

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Join key. |
| `businessId` | String | Parent business. | Scope and joins. |
| `officerId` | String | Assigned officer. | Officer workload. |
| `scheduledAt` | DateTime | Planned inspection date/time. | Due denominator, turnaround start. |
| `completedAt` | DateTime? | Completion timestamp. | Completed counts, turnaround end. |
| `checklist` | Json | Checklist items. | Quality rule only; not exported. |
| `notes` | String? | Officer notes. | Not exported. |
| `photos` | String | JSON array of photo URLs. | Not used in analytics. |
| `aiSummary` | String? | Generated summary. | Not used in analytics. |
| `riskDelta` | Float? | Legacy risk delta. | Not used; snapshots are authoritative. |
| `status` | String | `scheduled`, `completed` or `missed`. | Queue, completion, status-conflict rule. |

Indexes: `businessId`, `officerId`, `status`, `scheduledAt`, `completedAt`.

### Violation

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Finding count. |
| `inspectionId` | String | Parent inspection. | Completion-date join, repeat logic. |
| `type` | String | Controlled violation type. | Repeat violation detection. |
| `severity` | String | `low`, `medium`, `high`, `critical`. | Critical KPI, severity distribution, risk weight. |
| `description` | String | Finding text. | Display; not exported to Power BI. |

Indexes: `inspectionId`, `type`, `severity`.

### Complaint

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Join key. |
| `businessId` | String? | Attached business; null for unattached complaints. | Scope and district fallback. |
| `citizenId` | String? | Citizen identity; null for anonymous/unlinked. | Anonymity quality rule only. Never exported. |
| `assignedOfficerId` | String? | Owning officer. | Assignment stage and workload. |
| `anonymous` | Boolean | Reporter requested anonymity. | Quality false-positive control. |
| `description` | String | Complaint narrative. | Operations only; **never exported**. |
| `type` | String? | Complaint type code. | Type distribution, type-missing rule. |
| `photos` | String | JSON array of evidence URLs. | Not used in analytics. |
| `status` | String | `submitted`, `under_review`, `inspection_scheduled`, `resolved`. | Open/closed, SLA, process funnel. |
| `createdAt` | DateTime | Receipt timestamp. | Received KPI, SLA clock, period filter. |
| `assignedAt` | DateTime? | Officer assignment timestamp. | Receipt → assignment duration. |
| `investigationStartedAt` | DateTime? | Casework start. | Assignment → investigation duration. |
| `inspectionAt` | DateTime? | Inspection stage timestamp. | Investigation → inspection duration. |
| `resolvedAt` | DateTime? | Resolution timestamp. | Resolved KPI, resolution time, SLA. |
| `slaDays` | Int | Policy target in calendar days. | SLA compliance, overdue calculation. |
| `lat`, `lng` | Float? | Complaint location. | Not used in current analytics. |
| `address` | String? | Complaint address. | Not exported. |
| `district` | String? | Complaint district when unattached. | Unattached scope fallback. |
| `aiAnalysis` | String? | Generated triage text. | Not used in analytics. |

Indexes: `businessId`, `assignedOfficerId`, `status`, `createdAt`, `resolvedAt`.

### Document

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Quality finding. |
| `businessId` | String | Parent business. | Document completeness. |
| `type` | String | Document type. | Expired-document grouping. |
| `fileUrl` | String | Stored file URL. | Not exported. |
| `uploadedAt` | DateTime | Upload timestamp. | Expiry-order rule, risk document-on-file check. |
| `expiresAt` | DateTime? | Expiry timestamp. | Expired-document risk points; regulatory follow-up. |

Index: `businessId`, `expiresAt`.

### RiskSnapshot

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Snapshot identity. |
| `businessId` | String | Parent business. | History join. |
| `score` | Float | Deterministic score 0–100. | Trend, tier, average risk. |
| `tier` | String | A/B/C/D. | High-risk KPI and distribution. |
| `factors` | Json | `{violations, complaints, inspectionTimeliness, documents, category}` points. | Factor explanation and export. |
| `snapshotAt` | DateTime | Point-in-time of the score. | Latest-snapshot semantics, history. |

Indexes: `[businessId, snapshotAt]`, `snapshotAt`.

### Supplier

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Quality finding. |
| `businessId` | String | Parent business. | Join. |
| `name` | String | Supplier name. | Display. |
| `category` | String | Supplier category. | Not currently analysed. |
| `products` | String | Supplied products. | Not currently analysed. |
| `location` | String | Supplier location. | Not currently analysed. |
| `licenceNumber` | String? | Supplier licence. | Supplier-master completeness rule. |
| `lastDeliveryAt` | DateTime? | Last delivery. | Not currently analysed. |
| `createdAt` | DateTime | Record creation. | Not currently analysed. |

### User

| Field | Type | Meaning | Analytics use |
| --- | --- | --- | --- |
| `id` | String | Primary key. | Officer dimension. |
| `name` | String | Display name. | Officer label. |
| `email` | String | Login email (unique). | **Not exported.** |
| `password` | String | Password hash. | **Never exported.** |
| `role` | String | `food_officer`, `citizen`, `business_owner`. | Access control and officer dimension. |
| `district` | String? | Officer district. | Officer dimension; no row-level security yet. |

## 3. Derived analytics fields

| Field | Definition | Where used |
| --- | --- | --- |
| `resolutionDays` | `(resolvedAt - createdAt) / 86,400,000 ms` when `resolvedAt >= createdAt`; otherwise blank. | Average resolution, SLA, complaint export, Power BI. |
| `slaWithinTarget` | 1 when `resolutionDays <= slaDays`; 0 when breached; blank when no valid resolution. | SLA compliance, Power BI. |
| `turnaroundDays` | `(completedAt - scheduledAt) / 86,400,000 ms` when non-negative; otherwise blank. | Inspection turnaround, Power BI. |
| `isRepeat` | 1 when the same violation type was recorded at the same business in an earlier completed inspection; otherwise 0. | Repeat violation share, Power BI. |
| `highRisk` | Tier C or D at the relevant snapshot date. | District scorecard, risk KPI. |
| `overdueOpen` | Created before as-of, unresolved at as-of, and `createdAt + slaDays < as-of`. | Overdue KPI, district scorecard. |
| `factorUtilisation` | Factor points / policy maximum × 100. | Risk drill-down, methodology. |
| `scoreChange30d` | Current latest score minus latest score at or before `asOf - 30 days`; null when no baseline. | Risk movers. |

## 4. Power BI extract columns

The extracts in `public/powerbi/` are documented in detail in
[docs/powerbi/data_model.md](powerbi/data_model.md). The key additional columns
are:

- `dim_business.registeredDate` — date-only registration helper.
- `dim_date` — 2024-01-01 to 2027-12-31 calendar dimension.
- `fact_inspections.scheduledDate`, `completedDate`, `turnaroundDays`,
  `violationCount`, `criticalViolationCount`.
- `fact_violations.completedDate`, `isRepeat`.
- `fact_complaints.createdDate`, `resolvedDate`, `resolutionDays`,
  `slaWithinTarget`, `hasCitizenLink`.
- `fact_risk_snapshots.snapshotDate`, `factorViolations`, `factorComplaints`,
  `factorInspectionTimeliness`, `factorDocuments`, `factorCategory`.
- `kpi_definitions` — 13 governed definitions.
- `data_quality_findings` — 20 rule results.
- `district_scorecard` — prepared trailing-90-day view.
- `dataset_manifest` — file grain, row count and generation time.

`hasCitizenLink` is 1 when a citizen identity is attached. It exists so Power BI
and Python can detect contradictory anonymity without exporting the identity.

## 5. Data-quality rules

The authoritative implementation is `src/lib/quality.ts`; the Python toolkit
re-evaluates the rules that can be tested from the extracts.

| Rule ID | Severity | Check | False-positive control |
| --- | --- | --- | --- |
| `C-RES-MISSING` | critical | `status = 'resolved' AND resolvedAt IS NULL` | None; a resolved case must have a timestamp. |
| `C-RES-NEGATIVE` | critical | `resolvedAt < createdAt` | None. |
| `C-TIMELINE` | high | Lifecycle timestamps are not monotonic. | Only present stages are compared. |
| `C-ANON-CONFLICT` | high | `anonymous = true AND citizenId IS NOT NULL` | Anonymous with no citizen link is valid and not flagged. |
| `C-TYPE-MISSING` | medium | Type null or blank. | Exporter labels it `unspecified`; both are treated as missing. |
| `C-SLA-INVALID` | medium | `slaDays < 1 OR slaDays > 30`. | Policy range only. |
| `C-STATUS-INVALID` | high | Status outside the four workflow states. | None. |
| `I-DATE-ORDER` | high | `completedAt < scheduledAt`. | None. |
| `I-COMPLETE-MISSING` | critical | `status = 'completed' AND completedAt IS NULL`. | None. |
| `I-STATUS-CONFLICT` | high | Scheduled/missed with a completion timestamp. | None. |
| `I-CHECKLIST-EMPTY` | medium | Completed inspection with zero checklist entries. | None. |
| `B-LICENCE-DUPLICATE` | high | Same trimmed, case-folded licence on more than one business. | Empty licences are handled by the missing rule. |
| `B-LICENCE-MISSING` | critical | Licence blank. | None. |
| `B-COORDS-INVALID` | medium | Coordinates outside India (lat 6–38, lng 68–98). | None. |
| `B-RISK-MISMATCH` | high | Score outside 0–100 or tier not matching the score band. | None. |
| `B-STATUS-INVALID` | medium | Status outside active/suspended/closed. | None. |
| `D-EXPIRY-ORDER` | critical | `expiresAt < uploadedAt`. | None. |
| `R-SCORE-RANGE` | high | Snapshot score outside 0–100. | None. |
| `R-TIER-MISMATCH` | high | Snapshot tier not matching the score band. | None. |
| `S-LICENCE-MISSING` | medium | Supplier licence blank. | Labelled supplier-master follow-up, not an analytics defect. |

Expired documents are **not** a quality defect. They are a regulatory follow-up
and are excluded from the quality score.

Scoring: each failing rule deducts once — critical 6, high 4, medium 2, low 1 —
capped at 100 penalty. Grade: Healthy ≥ 95, Good ≥ 85, Watch ≥ 70, otherwise
Needs attention.

## 6. Data retention and privacy

- Complaint descriptions and citizen identities are operational data. They are
  not part of the Power BI or Python extracts.
- Emails and password hashes are never exported.
- Analytics pages show complaint IDs and business names, not citizen names.
- The demo dataset is synthetic. Production retention must follow the applicable
  records-retention policy and a privacy impact assessment.
