# Business Requirements Document (BRD)

**Project:** SafeBite Risk Intelligence, Business Analytics & Decision Support
**Version:** 1.0 (demo delivery)
**Date:** 8 November 2026
**Status:** Implemented in the SafeBite-Analytics workspace

> **Data notice.** The workspace runs on a deterministic synthetic dataset built
> for demonstration. It is not official government statistics and does not imply
> endorsement by FSSAI, Maharashtra FDA or any government body. Risk scores are
> transparent policy rules, not machine-learning predictions.

## 1. Background

SafeBite is a food-safety platform with separate experiences for citizens,
business owners and Food Safety Officers. The original application already
captured businesses, inspections, violations and complaints, but its analytics
page was a set of high-level counts. Officers could see that a business was
marked high risk, but not why, how risk had moved, which districts were
struggling, or whether the underlying data could be trusted.

The analytics upgrade turns those operational records into a governed decision
support workspace: consistent KPI definitions, historical comparisons, an
explainable risk register, district peer comparison, data-quality findings,
process-stage timings, and exports that external analysts can use.

## 2. Problem statement

Officers and supervisors need to answer five questions quickly:

1. **What changed?** Are complaints, inspections, violations, resolution times
   and backlog improving or worsening against the previous period?
2. **Where should we act first?** Which premises and districts carry the highest
   risk, and which factor is driving that risk?
3. **Can we trust the numbers?** Are there impossible lifecycles, duplicate
   licences, missing timestamps or contradictory anonymity flags?
4. **Where is the process slow?** How long does each complaint stage take, what is
   the backlog, and which stages cannot be measured with current data?
5. **Can we share the result?** Can a supervisor export a filtered CSV or PDF, or
   continue analysis in Power BI or Python without a second copy of the business
   logic?

## 3. Objectives

| Objective | Measure of success |
| --- | --- |
| One governed KPI language | 13 documented KPIs with one server-side definition each, mirrored in SQL, Power BI and Python. |
| Historical context | Every KPI shows an equal-length previous-period value and a favourable/adverse assessment. |
| Explainable prioritisation | Every risk row exposes score, tier, 30-day movement, factor points and the top driver. |
| District comparison | All districts compared on premises, high-risk counts, average risk, inspections, findings, complaints and backlog. |
| Trustworthy data | 20 documented quality rules, including explicit false-positive controls for anonymous complaints. |
| Process visibility | Complaint stage medians, averages, p90, funnel and inspection turnaround, with unavailable stages named. |
| Portable reporting | Working filtered CSV exports, a management PDF summary, 11 Power BI extracts and a Python toolkit. |
| Safe access | Analytics restricted to authenticated Food Safety Officers; exports use the same role check. |
| Build quality | TypeScript, lint, automated tests and a production build pass. |

## 4. Scope

### In scope

- A new officer workspace at `/officer/intelligence` with overview, risk, data
  quality, process, reports and methodology pages.
- Global filters for period, district, category, risk tier, complaint status,
  inspection status and trend grouping.
- Server-side KPI computation from Prisma records; only aggregates are sent to
  the browser.
- Reproducible risk snapshots and a factor-level explanation of the deterministic
  risk score.
- Data-quality checks across complaints, inspections, businesses, documents,
  risk snapshots and supplier master data.
- Complaint and inspection process metrics using the timestamps that exist.
- CSV exports for summary, risk, districts, complaints, inspections, quality and
  process; a PDF management summary generated in the browser with jsPDF.
- A documented SQL library in SQLite and PostgreSQL dialects.
- Power BI CSV extracts, a star-schema guide and DAX measure definitions.
- A Python toolkit for KPI reproduction, risk analysis and quality reconciliation.
- Business and technical documentation, automated tests and a delivery README.

### Out of scope

- Changes to the original live SafeBite deployment or its URL.
- A citizen-facing analytics experience.
- A separate admin role or user-management console.
- Predictive machine learning, forecasting, or a probability-of-illness score.
- Live Power BI database connectivity, gateways or embedded reports.
- Government API integration, payment, enforcement notices or legal workflow.
- Laboratory, acknowledgement, on-site duration, report-approval or enforcement
  timestamps that do not exist in the schema.
- Mobile-native applications.

## 5. Stakeholders

| Stakeholder | Interest |
| --- | --- |
| Food Safety Officer | Triage high-risk premises, understand drivers, manage complaints and inspections. |
| Supervisor / programme manager | Compare districts, monitor SLA and backlog, export management reports. |
| Data / BI analyst | Reproduce KPIs in SQL, Power BI or Python without redefining them. |
| Citizen | Submit complaints and track status; no access to analytics. |
| Business owner | View own business information; no access to analytics. |
| Reviewer / judge | Verify that the analytics are real, explainable, documented and safe. |
| Engineering maintainer | Extend the workspace without breaking the legacy app. |

The full role and access analysis is in [stakeholders.md](stakeholders.md).

## 6. Business requirements

Priorities use MoSCoW: **M** must, **S** should, **C** could.

| ID | Priority | Requirement |
| --- | --- | --- |
| BR-01 | M | Analytics must remain inside the existing SafeBite application and preserve all existing roles and flows. |
| BR-02 | M | Only authenticated users with the `food_officer` role may open the intelligence workspace or download exports. |
| BR-03 | M | The workspace must provide 13 governed KPIs covering premises, risk, inspections, violations and complaints. |
| BR-04 | M | Every KPI must show a current value, an equal-length previous-period value, and whether movement is favourable or adverse for that KPI. |
| BR-05 | M | Global filters must apply consistently to KPIs, charts, risk ranking, districts, process and reports. |
| BR-06 | M | The risk register must rank premises by deterministic score and explain the contribution of each factor. |
| BR-07 | M | Risk history must use stored snapshots as of a date and must never back-fill a historical score from today's register. |
| BR-08 | M | District comparison must include premises, high-risk count, average risk, inspections, findings, complaints, resolutions and overdue backlog. |
| BR-09 | M | Data quality must use real validation rules, show affected records, and avoid false positives for legitimate anonymous complaints. |
| BR-10 | M | Process analytics must use available lifecycle timestamps, show stage durations and funnel losses, and explicitly name stages that cannot be measured. |
| BR-11 | M | Reports must export the currently filtered dataset to CSV, and provide a management PDF summary. |
| BR-12 | M | CSV exports must protect against spreadsheet formula injection and must not include citizen identities or complaint narratives. |
| BR-13 | M | The system must expose its definitions and caveats in-app so users can interpret the numbers correctly. |
| BR-14 | S | A documented SQL library must run against the demo database with SQLite/PostgreSQL parity and bound parameters. |
| BR-15 | S | Power BI-ready CSV extracts and documentation must allow an analyst to rebuild the KPIs outside the app. |
| BR-16 | S | A Python toolkit must reproduce the KPIs and risk views and reconcile data-quality counts. |
| BR-17 | S | The delivery must include business documentation, a data dictionary, process analysis and a testing strategy. |
| BR-18 | C | Trend grouping (day/week/month) should adapt to the selected period and remain user-selectable. |
| BR-19 | C | The legacy `/officer/analytics` page should continue to work unchanged. |
| BR-20 | C | Synthetic/demo data should be labelled wherever analytics are presented or exported. |

## 7. Non-functional requirements

| Area | Requirement |
| --- | --- |
| Security | Server-side role checks on pages, server actions and export routes. No analytics data in the citizen or business-owner experience. |
| Privacy | Extract only the fields needed. Exclude complaint descriptions, citizen IDs, emails and password hashes from external datasets. |
| Performance | Load the filtered dataset once per request, compute aggregates server-side, and render charts from aggregate arrays. Avoid one query per business. |
| Auditability | Deterministic risk function with an explicit `asOf`; snapshot history records factor breakdowns. |
| Reliability | Exports fail closed with 403/404 responses; invalid report names are rejected. |
| Data integrity | Quality findings are shown, not auto-repaired. Impossible lifecycles are excluded from resolution metrics and surfaced in data quality. |
| Accessibility | Semantic tables, visible labels, keyboard-operable controls, colour plus text for risk tiers, descriptive empty states. |
| Localization | Existing language switcher remains available; analytical labels are English in this phase. |
| Compatibility | SQLite for local demo; PostgreSQL schema and SQL dialect provided for deployment. |
| Maintainability | Shared KPI engine, typed interfaces, documented formulas and automated tests. |

## 8. Assumptions and constraints

- The demo uses SQLite (`file:./dev.db`). A PostgreSQL schema and SQL dialect are
  supplied but not exercised by the local demo database.
- Existing roles are `food_officer`, `citizen` and `business_owner`; no admin role
  exists. Supervisor views therefore use the officer role rather than inventing
  an authorisation model.
- The schema has no acknowledgement, on-site inspection duration, laboratory,
  report-approval or enforcement timestamps. Process analytics name these gaps
  instead of estimating them.
- Complaint SLA targets are calendar days, not business days.
- Business status is current status; historical status changes are not modelled.
- The seed anchors dates relative to "now", so exact KPI values move when the
  seed is rerun on a different date. Row counts and definitions remain stable.
- The risk model is policy-driven and deterministic. It must never be described
  as trained, predictive or a medical probability.

## 9. Success metrics

| Metric | Target |
| --- | --- |
| KPI coverage | 13/13 defined and rendered. |
| KPI reproduction | SQL and Python reproduce the documented definitions; SQL validator executes 26/26 queries. |
| Data-quality coverage | 20 rules, with anonymous-complaint false-positive control tested. |
| Export coverage | 7 CSV report types plus PDF summary. |
| Automated tests | Risk, filters/periods, KPI calculations, CSV injection and anonymity rules pass. |
| Build quality | `tsc`, lint, tests and production build pass. |
| Documentation | Business, analytical, Power BI and Python guides delivered. |

## 10. Approval

This BRD describes the delivered demo scope. Production rollout requires a
privacy impact assessment, records-retention review, accessibility audit, formal
role design, and sign-off from the responsible food-safety authority. No
government endorsement is implied by this document.
