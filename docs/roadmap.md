# Roadmap: Phase 2 and Phase 3

Phase 1 is the delivered demo: a governed BI workspace inside SafeBite with 13
KPIs, explainable risk, data quality, process analytics, filtered exports, SQL,
Power BI extracts, a Python toolkit and documentation.

The roadmap is ordered by dependency, not by enthusiasm. Items that unlock
measurement or trust come before items that add surface area.

> **Demo disclaimer.** Phase 1 runs on synthetic data. Production rollout needs
> privacy review, retention policy, accessibility audit and formal authorisation
> sign-off. No government endorsement is implied.

## Phase 2 — Production readiness

Target: run the workspace on real operational data with real roles, reliable
lifecycle timestamps and monitored exports.

### 2.1 Authorisation and tenancy

| Item | Why | Depends on |
| --- | --- | --- |
| Add a read-only `supervisor` / `analyst` role | District and programme managers need analytics without operational edit rights. | Role schema change, session handling, migration. |
| District-scoped row-level security | An officer should not see another district's complaint identities or operational notes. | Role model, officer-to-district mapping, query-level scoping. |
| Export audit log | Track who exported what, when, with which filters. | Durable event table, retention policy. |
| Separate operational edit from analytical read | Reduces accidental mutation and supports least privilege. | Permission matrix and UI changes. |

### 2.2 Lifecycle completeness

The biggest measurement gap is missing timestamps. Phase 2 should add:

| Field | Enables |
| --- | --- |
| `Complaint.acknowledgedAt` | True acknowledgement SLA instead of the receipt → assignment proxy. |
| `Inspection.startedAt`, `arrivedAt` | On-site duration and travel analysis. |
| `Inspection.reportSubmittedAt`, `approvedAt`, `publishedAt` | Report-writing and approval lag. |
| `LaboratorySample.collectedAt`, `receivedAt`, `resultedAt` | Laboratory turnaround. |
| `EnforcementAction.createdAt`, `closedAt` | Enforcement cycle time and case closure. |
| `Business.applicationAt`, `approvedAt` | Registration approval process. |
| `Complaint.reopenedAt`, `escalatedAt` | Reopen and escalation analysis. |

Each field needs a backfill strategy, a nullability policy and a quality rule.
Without backfill, historical process metrics remain labelled as partially
available.

### 2.3 Data quality operations

| Item | Why |
| --- | --- |
| Data-steward workflow | Assign, comment on and close a quality finding with an audit trail. |
| Rule thresholds and suppressions | Allow justified, time-bounded exceptions without hiding the finding. |
| Automated daily quality snapshot | Track quality score and finding counts over time. |
| Quality trend page | Show whether data health is improving. |
| Root-cause tags | Distinguish integration, user-entry and migration defects. |
| Alerting | Notify the owner when a critical rule count crosses a threshold. |

### 2.4 Analytics depth

| Item | Why |
| --- | --- |
| Seasonality and cohort analysis | Compare like periods instead of raw month-to-month movement. |
| Confidence intervals or explicit small-sample warnings | Prevent over-reading a median from three records. |
| Business-level trend drill-down | Show a single premises' score, complaints and inspections over time. |
| Officer workload and coverage | Balance assignment using real capacity, not just queue size. |
| Geographic clustering | Move from district aggregates to hotspot analysis with privacy thresholds. |
| Complaint type × severity matrix | Improve triage rules. |
| Inspection outcome effectiveness | Measure whether a follow-up inspection actually reduces risk. |

These are analytical additions, not a trained model. Any scoring change must keep
the deterministic, explainable contract unless a separate, validated model is
introduced with governance.

### 2.5 Reporting and BI

| Item | Why | Depends on |
| --- | --- | --- |
| Scheduled extract job | Regenerate Power BI CSVs on a schedule rather than manually. | Read replica or bounded query window. |
| Power BI Service dataset with gateway | Live refresh instead of static files. | Credentials management, row-level security. |
| Published DAX measure tests | Prove measures match the app on a fixture dataset. | Power BI Desktop/CI capability. |
| Excel export with formatting | Some stakeholders prefer a formatted workbook to CSV. | Server-side workbook library evaluation. |
| Scheduled PDF packs | Weekly district pack without manual clicks. | Background job infrastructure. |
| Report subscriptions and distribution lists | Controlled sharing. | Notification service and consent. |

### 2.6 Platform and operations

| Item | Why |
| --- | --- |
| PostgreSQL in staging and production | SQLite is a demo store; concurrency and backup need a server database. |
| Migration and rollback runbook | Safe schema changes on live data. |
| Backup and restore drill | Prove recovery, not just claim it. |
| Slow-query monitoring | The dataset loader is batched but will grow. |
| Cache policy for reference data | Reduce repeated option queries. |
| Error tracking | Detect page and export failures. |
| Rate limiting on exports | Prevent bulk extraction. |
| Accessibility audit (WCAG 2.2 AA) | Tables, charts, filters and colour contrast. |
| Localisation of analytical labels | The app already supports language switching elsewhere. |
| Dependency and security scanning | Keep the supply chain current. |

### 2.7 Privacy and governance

| Item | Why |
| --- | --- |
| Privacy impact assessment | Complaint data can identify individuals even without names. |
| Retention and deletion policy | Define how long raw complaints and snapshots are kept. |
| Small-cell suppression | Prevent district/type combinations from identifying a reporter. |
| Data-processing agreement | Required if an external BI platform hosts extracts. |
| Model/score governance | Version weights, document changes and review periodically. |
| Public communication review | Ensure no wording implies official endorsement or prediction. |

## Phase 3 — Decision support and prevention

Target: move from describing performance to supporting prevention, with explicit
governance and human review.

### 3.1 Scenario and what-if analysis

- Simulate the effect of changing risk weights or tier thresholds on the ranked
  list, with a diff against the current policy.
- Estimate inspection capacity required to clear a backlog by a target date.
- Compare allocation strategies by district and category.

Scenario analysis must remain transparent and reversible. It must never silently
change live scores.

### 3.2 Early-warning signals

- Rising complaint rate for a category or district relative to its own baseline.
- Repeat-violation clusters at supplier or owner level.
- Inspection overdue growth combined with high-risk tier concentration.
- Sudden score deterioration with a factor breakdown.

Signals are prompts for human review, not enforcement decisions. Each signal needs
a documented threshold, a false-positive review and an explanation.

### 3.3 Supplier and traceability analytics

- Supplier licence coverage and delivery recency.
- Link violations and complaints to supplier networks where the data supports it.
- Traceability gaps by product category.
- Recall or withdrawal cycle time, if those events are modelled.

### 3.4 Citizen transparency

- Aggregate, privacy-safe district food-safety indicators.
- Clear explanation of what a risk tier does and does not mean.
- Feedback loop showing complaint outcomes without exposing identities.
- Multilingual definitions and methodology.

Citizen-facing views need small-cell suppression and a separate content review;
they must not expose business-owner competitor intelligence.

### 3.5 Forecasting (only with governance)

Forecasting is **not** part of Phase 1 and must not be implied. If pursued:

1. Define the outcome precisely (for example inspection backlog, not "illness
   probability").
2. Establish a labelled historical dataset with sufficient length and quality.
3. Compare against a simple baseline and report error, not only a headline score.
4. Document features, validation, drift monitoring and retraining.
5. Keep a human decision in the loop and an explanation for every flagged case.
6. Obtain ethical, legal and privacy review.

A trained model would be a separate, governed capability — never a relabelling of
the current deterministic score.

### 3.6 Integration

- State food-safety systems for licence and enforcement data.
- Laboratory information systems for sample turnaround.
- Mapping/geocoding services for hotspot accuracy.
- Notification services for SLA escalation.
- Identity provider for single sign-on and role provisioning.

Each integration needs a contract, error handling, reconciliation and an owner.

## Sequencing summary

```
Phase 1 (delivered)
  KPIs · risk · quality · process · reports · SQL · Power BI · Python · docs

Phase 2 (production readiness)
  roles/RLS → lifecycle fields → quality workflow → PostgreSQL → scheduled BI
  → accessibility/privacy review → monitoring/audit

Phase 3 (decision support)
  scenario analysis → early warning → supplier analytics → citizen transparency
  → governed forecasting (optional) → external integration
```

## Explicitly not planned

- Presenting the deterministic risk score as a trained model or an illness
  probability.
- Automated enforcement action from a score without human review.
- Exposing complaint narratives or citizen identities to BI extracts.
- Government endorsement claims for a hackathon demo.
- Silent auto-repair of data-quality defects.

## Phase 1 known limitations

1. Synthetic demo data; values move when the seed is rerun on another date.
2. SQLite is the local database; PostgreSQL is provided structurally but not
   exercised by the demo runtime.
3. No acknowledgement, on-site duration, laboratory, report-approval or
   enforcement timestamps, so those stages are named as unavailable.
4. No trained model, forecast or illness probability.
5. Power BI DAX has been documented and reviewed, not executed in Power BI
   Desktop or CI.
6. The extract is static; analysts must re-run `npm run analytics:datasets`.
7. No browser E2E or accessibility automation in the demo.
8. Business status is current status; historical status changes are not modelled.
9. Complaint SLA durations are calendar days, not business days.
10. There is no admin or supervisor role in the schema; supervisor use is via the
    officer role.
