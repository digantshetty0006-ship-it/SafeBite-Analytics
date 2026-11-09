# Testing strategy

## 1. Goals

Testing the analytics workspace protects four things that are easy to break and
hard to notice:

1. **Definition drift** — the same KPI silently meaning different things in the
   app, SQL, Power BI and Python.
2. **Boundary errors** — IST/UTC or inclusive/exclusive mistakes that shift counts
   by a day.
3. **False confidence** — impossible lifecycles, missing snapshots or tiny
   denominators presented as real performance.
4. **Safety regressions** — role checks, CSV formula injection, or privacy leaks.

The strategy is deliberately layered: fast pure-function tests for logic, SQL
execution validation against the seeded database, a Python reconciliation suite
against the exported extracts, and a manual visual checklist for the UI.

## 2. Test layers

| Layer | Command | What it proves |
| --- | --- | --- |
| Type checking | `npx tsc --noEmit` | No type errors across app, scripts and tests. |
| Lint | `npm run lint` | No lint errors (warnings are pre-existing and tracked). |
| Unit/integration (Node test runner) | `npm test` | Risk scoring, periods/filters, KPI calculations, CSV safety, anonymity rules. 31 tests. |
| Production build | `npm run build` | Next.js compiles, routes render, Prisma client generates. |
| SQL structural + execution validation | `npm run analytics:sql:validate` | 26 queries parse, run, return documented columns and have dialect parity. |
| Engine smoke check | `npm run analytics:smoke` | The real database loads and the 13 KPIs compute without error. |
| Dataset export | `npm run analytics:datasets` | 11 CSVs regenerate with the documented row counts. |
| Python self-test | `py -m safebite_analytics self-test` | Extract reproduces 13 KPIs, risk bands, false-positive control and quality reconciliation. 14 checks. |
| Manual UI checklist | See [acceptance-criteria.md](acceptance-criteria.md) | Visual, responsive and permission behaviour that unit tests cannot see. |

## 3. Automated suites

### 3.1 Risk scoring — `tests/risk.test.ts` (9 tests)

- Tier bands at the exact policy boundaries (25/25.1, 50/50.1, 75/75.1).
- Factor weights total 100 and equal the documented values (40/25/15/10/10).
- A business with no history receives only the deterministic baselines.
- Scoring is reproducible for the same input and `asOf`.
- Violation points decay with age and cap at 40.
- Complaints outside the 90-day window are ignored; the factor caps at 25.
- Expired documents add points; the document factor caps at 10.
- Inspection gaps penalise and a scheduled follow-up mitigates.
- Category baselines are policy weights, not learned coefficients.

These tests use hand-built Prisma-shaped objects, so they run without a database.

### 3.2 Periods and filters — `tests/filters.test.ts` (8 tests)

- IST midnight converts to the correct UTC instant.
- `last90` produces an equal-length previous window and the expected label.
- Custom ranges include the whole end date in IST.
- Invalid custom dates fall back to `last30` with `custom = false`.
- Current and previous month resolve to the correct IST month starts.
- Trend grouping defaults to weekly for a long range when unset.
- Query parsing clamps unknown values, trims district and normalises tier case.
- Percentage/average helpers return `null` for empty denominators.

Fixed `now` values are injected; tests never depend on the wall clock.

### 3.3 KPI engine — `tests/kpis.test.ts` (5 tests)

The fixture is a small, fully controlled dataset covering:

- all 13 KPIs in the documented order;
- event-window inspection, violation and repeat metrics;
- invalid complaint lifecycles excluded from resolution and SLA metrics;
- latest-snapshot semantics for risk KPIs and tier distribution;
- scope counts registered businesses separately from rated businesses.

These are integration tests for `buildAnalyticsView`; they do not need a database.

### 3.4 Reports and CSV safety — `tests/reports.test.ts` (4 tests)

- Formula injection characters (`=`, `+`, `-`, `@`, tab, CR) are neutralised.
- Normal text is quoted and embedded quotes are doubled.
- CSV output has a UTF-8 BOM and CRLF line endings.
- Filenames include report, district slug and date.

### 3.5 Data quality — `tests/quality.test.ts` (5 tests)

- The catalogue exposes exactly 20 rules with unique IDs.
- Anonymous with no citizen link is **not** a conflict.
- Identified complaints are not anonymous conflicts.
- Anonymous plus a citizen link **is** a conflict.
- Rule descriptions document the false-positive control.

The false-positive control is the critical privacy test: legitimate anonymous
complaints must never be treated as data errors.

## 4. SQL validation

`npm run analytics:sql:validate` performs four checks:

1. **Dialect parity** — both files declare the same query names, parameters and
   descriptions.
2. **Structure** — every query has a header block and expected result columns.
3. **Execution** — every query runs against the seeded SQLite database.
4. **Result shape** — returned columns match `EXPECTED_COLUMNS` in
   `scripts/validate-sql.ts`.

Parameters are bound by Prisma; the validator and runner never concatenate user
input into SQL. `:limit` is clamped to 1–1000.

Current result: **26/26 queries pass**.

## 5. Python reconciliation

From `analytics/python`, after `npm run analytics:datasets`:

```powershell
py -m safebite_analytics --data-dir ..\..\public\powerbi self-test
```

The suite checks:

- all core tables and the extract timestamp are present;
- the previous period is equal length;
- exactly 13 governed KPIs are returned;
- KPI values are numeric or explicitly unavailable;
- risk weights sum to 100 and tier bands follow policy;
- tier distribution covers every rated premises;
- rated scores are within 0–100;
- legitimate anonymous complaints are not flagged;
- a synthetic anonymous-only complaint passes;
- a synthetic anonymous-plus-identity complaint fails;
- extract-level quality counts reconcile with the app export;
- resolution time excludes impossible lifecycles.

Current result: **14/14 pass**.

The manual comparison is equally important: `npm run analytics:smoke` and
`py -m safebite_analytics kpis --period last90` should agree on the seeded extract
date. Small edge differences are possible because the app uses IST boundaries and
the extract uses UTC dates.

## 6. Data-quality test data

The seed deliberately creates known defects so the quality page is never empty in
the demo:

| Defect | Rule exercised |
| --- | --- |
| Resolved complaint without `resolvedAt` | `C-RES-MISSING` |
| Resolution before creation | `C-RES-NEGATIVE` |
| Out-of-order lifecycle | `C-TIMELINE` |
| Anonymous complaint with a citizen link | `C-ANON-CONFLICT` |
| Inspection completed before scheduled | `I-DATE-ORDER` |
| Duplicate licence number | `B-LICENCE-DUPLICATE` |

Reseeding restores them. Do not "fix" the seed to make the quality score look
better; the anomalies prove the rules work.

## 7. What is not automated

| Area | Reason | Mitigation |
| --- | --- | --- |
| Browser E2E (login, filters, charts) | No Playwright/Cypress dependency in the demo. | Manual checklist in acceptance criteria. |
| PDF pixel output | jsPDF runs in the browser. | Manual open-and-read check each release. |
| Power BI DAX execution | Requires Power BI Desktop. | DAX is documented and reviewed; CSV extracts are tested. |
| Excel rendering of CSV | Requires a spreadsheet application. | Formula-injection unit tests plus a manual spot check. |
| PostgreSQL execution | Local demo runs SQLite. | Dialect parity is checked structurally; run PG validation in a staging environment. |
| Accessibility audit | Requires assistive technology. | Semantic tables, labels and keyboard controls; formal audit deferred to Phase 2. |
| Load/performance testing | Demo dataset is small. | Batch loading and server-side aggregation designed in; measure with production volume. |

## 8. Release gate

Run in this order from the repository root:

```powershell
npm run db:seed
npm run analytics:datasets
npx tsc --noEmit
npm run lint
npm test
npm run build
npm run analytics:sql:validate
npm run analytics:smoke
```

Then from `analytics/python`:

```powershell
py -m safebite_analytics --data-dir ..\..\public\powerbi self-test
```

A release is not ready if any of these fail. Lint warnings are acceptable only if
they are the pre-existing set; no new warnings should be introduced.

## 9. Regression checklist for definition changes

When a KPI, weight or rule changes:

1. Update the engine and the methodology page.
2. Update both SQL dialects and the validator's expected columns.
3. Update the Power BI DAX documentation and, if columns changed, the extract.
4. Update the Python toolkit.
5. Update the KPI definitions and data dictionary.
6. Add or adjust unit tests.
7. Run the full release gate.
8. Record the change and its effective date in the release note.
