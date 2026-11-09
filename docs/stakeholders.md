# Stakeholder and access analysis

## 1. Stakeholder map

| Stakeholder | Primary need | What they use | Access |
| --- | --- | --- | --- |
| Food Safety Officer | Decide which premises and complaints need attention first. | Intelligence overview, risk register, process page, complaint and inspection workflows. | Authenticated `food_officer` only. |
| Supervisor / programme manager | Monitor district performance, SLA and backlog; share results. | District comparison, KPI cards, CSV/PDF reports. | Uses the `food_officer` demo role; a production supervisor role is Phase 2. |
| Data / BI analyst | Reproduce and extend the KPIs without redefining them. | SQL library, Power BI extracts, Python toolkit, methodology page. | Receives exported files, not application credentials. |
| Citizen | Report a problem and track the response. | Citizen complaint portal and "My complaints". | `citizen` role; no analytics routes. |
| Business owner | See own business profile and inspection outcomes. | Business-owner dashboard. | `business_owner` role; no analytics routes. |
| Engineering maintainer | Change definitions safely. | Source, tests, documentation, SQL validator. | Repository access. |
| Reviewer / evaluator | Verify claims, trace numbers to records, check limitations. | Documentation, methodology, exports, tests. | Read-only repository/demo access. |

## 2. Role and permission model

| Capability | Citizen | Business owner | Food Safety Officer |
| --- | --- | --- | --- |
| Register/log in | Yes | Yes | Yes |
| Submit complaint | Yes | No | No |
| View own complaints/business | Yes | Yes | No (officer sees operational records) |
| View queue and inspections | No | No | Yes |
| Open `/officer/intelligence` | No | No | Yes |
| View risk register and district comparison | No | No | Yes |
| View data quality and process analytics | No | No | Yes |
| Download CSV/PDF reports | No | No | Yes |
| Change complaint/inspection status | No | No | Yes |

The application has no `admin` role. The implementation does not invent one.
Where a document refers to an "administrator", it means a person operating the
deployment, not an in-app role.

### Enforcement points

- `src/app/(app)/officer/layout.tsx` (or the officer route guard) requires the
  officer role before rendering the workspace.
- `/officer/intelligence/export/[report]` re-checks the session and returns 403
  for non-officers.
- Server actions use `requireRole("food_officer")`.
- The Power BI and Python extracts carry no credentials and no row-level security.
  Workspace permissions are the access boundary outside the app.

## 3. RACI for the analytics delivery

R = responsible, A = accountable, C = consulted, I = informed.

| Activity | Product owner | Food Safety Officer | Engineering | Data/BI analyst | QA |
| --- | --- | --- | --- | --- | --- |
| KPI definitions | A | C | R | C | C |
| Risk scoring rules | A | C | R | C | C |
| Dashboard UX | C | C | R | I | C |
| Data-quality rules | A | C | R | C | C |
| Process analysis | C | C | R | I | C |
| SQL library | I | I | R | C | C |
| Power BI extracts | I | I | R | A | C |
| Python toolkit | I | I | R | A | C |
| Privacy review | A | C | C | C | C |
| Acceptance testing | A | C | C | C | R |
| Production rollout | A | C | R | C | C |

## 4. Engagement notes

### Food Safety Officers

- They need prioritisation, not more raw data. The first screen answers "what
  changed and where should I look?"; drill-down is one click away.
- They distrust unexplainable scores. Every risk row exposes factor points and a
  top driver, and the methodology page states the weights and caps.
- They need to know when data is wrong. Data-quality findings link to the
  affected complaint, inspection or business where possible.

### Supervisors

- They compare districts of different sizes. The district table shows counts and
  averages side by side; the UI does not rank solely on a percentage from a tiny
  denominator.
- They export to share in meetings. CSV respects the active filters; the PDF
  summary states the period, filters, generated-by user and disclaimer.

### Analysts

- They need one definition, not three. The app, SQL, Power BI and Python are
  documented against the same KPI catalogue.
- They need stable keys. Power BI extracts expose business, inspection,
  violation, complaint and snapshot IDs.
- They must understand the IST/UTC boundary difference before reconciling totals.

### Citizens and business owners

- They are deliberately excluded from analytics. This protects complaint
  identities and prevents business-owner access to competitor data.

## 5. Communication and escalation

| Event | Audience | Channel |
| --- | --- | --- |
| KPI definition change | Officers, analysts, engineering | Change note + methodology update + test update |
| Risk weight change | Officers, supervisors | Release note + snapshot version note |
| Data-quality defect | Data owner | Quality finding with affected records |
| Export permission issue | Security owner | Incident review; exports fail closed |
| Production incident | Programme manager | Operational escalation process (outside demo) |

## 6. Production role design (Phase 2)

A production deployment should add:

- a `supervisor` or `analyst` role with read-only, district-scoped analytics;
- an explicit mapping from officer to district for row-level security;
- an audit log for exports and risk-weight changes;
- a data-steward role for resolving quality findings;
- separation between operational edit rights and analytical read rights.

These are out of scope for the demo because they would require schema and
authorisation changes beyond the existing role model.
