# SafeBite documentation

This directory contains the business, analytical and technical documentation for
the SafeBite Risk Intelligence, Business Analytics & Decision Support workspace.

> **Demo disclaimer.** SafeBite is a Smart India Hackathon demonstration. The
> seeded dataset is synthetic. Nothing in this repository is official government
> statistics, a regulatory determination, or an endorsement by FSSAI, Maharashtra
> FDA or any government body. Risk scores are deterministic weighted policy
> rules, not a trained machine-learning model and not a probability of illness.

## Start here

| Document | Audience | Purpose |
| --- | --- | --- |
| [BRD](BRD.md) | Product owner, reviewers | Problem, objectives, scope, requirements and success measures. |
| [Stakeholders](stakeholders.md) | Delivery team | Roles, access model, RACI and engagement notes. |
| [User stories](user-stories.md) | Product, design, engineering | Prioritised user outcomes with story IDs. |
| [Acceptance criteria](acceptance-criteria.md) | QA, reviewers | Given/When/Then checks for the delivered scope. |
| [KPI definitions](kpi-definitions.md) | Analysts, officers | The 13 governed KPIs, formulas, sources and caveats. |
| [Data dictionary](data-dictionary.md) | Engineers, analysts | Tables, fields, derived measures and quality rules. |
| [Process analysis](process-analysis.md) | Operations, supervisors | Complaint and inspection stage timings, bottlenecks and unavailable stages. |
| [Architecture](architecture.md) | Engineers, security reviewers | Components, data flow, access control and deployment notes. |
| [Testing strategy](testing-strategy.md) | QA, maintainers | Automated, manual and reconciliation testing. |
| [Roadmap](roadmap.md) | Product owner | Phase 2 and Phase 3 work with dependencies. |
| [Power BI guide](powerbi/README.md) | BI developers | CSV extracts, model, relationships and refresh. |
| [Power BI data model](powerbi/data_model.md) | BI developers | Star schema and table dictionaries. |
| [DAX measures](powerbi/dax_measures.md) | BI developers | Measures mirroring the governed KPIs. |

## Delivery boundaries

- The original SafeBite application and live URL (`https://safebite-demo.vercel.app`)
  are untouched. All analytics work lives in the `SafeBite-Analytics` copy.
- The intelligence workspace is available to authenticated Food Safety Officers
  at `/officer/intelligence`. The legacy `/officer/analytics` page still works.
- Existing citizen and business-owner flows are unchanged.
- The system supports the roles that exist in the schema: `food_officer`,
  `citizen` and `business_owner`. There is no separate `admin` role in the demo.
- Exports respect the same role check and the active dashboard filters. CSV cells
  are protected against spreadsheet formula injection.
- Complaint narratives, citizen identities, passwords and emails are excluded
  from the Power BI and Python extracts.

## Documentation conventions

- **Current** means the value at the end of the selected period.
- **Previous** means the immediately preceding window of equal length.
- **Snapshot** means the latest stored `RiskSnapshot` on or before a date; it is
  never back-filled from today's register.
- **Valid resolution** means `resolvedAt` is present and `resolvedAt >= createdAt`.
- All user-facing day boundaries use Asia/Kolkata (IST, UTC+05:30).
