# SafeBite Python analytics toolkit

A small, typed pandas toolkit for analysts who want to reproduce and extend the
SafeBite BI figures outside the Next.js application. It reads the same CSV
extracts that power the Power BI dataset, so there is one set of facts and no
second database connection to secure.

> **Synthetic demo data.** The seeded dataset is not official government
> statistics and does not imply government endorsement. Risk scores are
> deterministic weighted policy rules, not a trained machine-learning model and
> not a probability of illness.

## Install

From the repository root:

```powershell
# Windows (the demo environment uses the `py` launcher)
py -m pip install -r analytics/python/requirements.txt

# macOS / Linux
python3 -m pip install -r analytics/python/requirements.txt
```

pandas and numpy are the only runtime dependencies. The optional notebook also
needs JupyterLab (`py -m pip install jupyterlab`).

Generate fresh extracts before the first run:

```powershell
npm run db:seed
npm run analytics:datasets
```

## Run

The package lives in `analytics/python`, so run the module from there:

```powershell
cd analytics/python

# Metadata and row counts
py -m safebite_analytics info

# 13 governed KPIs, trailing 90 days, with an equal-length previous period
py -m safebite_analytics kpis --period last90

# Explicit IST dates and filters
py -m safebite_analytics kpis --period custom --from 2026-08-11 --to 2026-11-08 --district Mumbai
py -m safebite_analytics kpis --period last90 --category bakery --tier C

# Risk tiers, highest-risk premises, district comparison, factor profile and movers
py -m safebite_analytics risk --top 10
py -m safebite_analytics risk --as-of 2026-10-31 --top 5

# Data-quality checks and reconciliation with the app export
py -m safebite_analytics quality

# Toolkit self-tests against the real extracts
py -m safebite_analytics self-test

# Machine-readable output
py -m safebite_analytics kpis --json
```

If the extracts live elsewhere, pass `--data-dir` **before** the subcommand:

```powershell
py -m safebite_analytics --data-dir C:\path\to\csv kpis --period last30
```

## What is calculated

| Module | Purpose |
| --- | --- |
| `kpis.py` | The 13 governed KPIs, previous-period comparison, risk snapshot semantics, event-window metrics. |
| `risk.py` | Latest snapshot per business, tier distribution, factor profile, district risk, movers, monthly score history. |
| `quality.py` | 17 of the app's 20 data-quality rules that can be evaluated from the extract, plus a count reconciliation against `data_quality_findings.csv`. |
| `loader.py` | Typed CSV loading, datetime/number coercion, risk bands and factor weights. |
| `selftest.py` | Assertions over the real extract, including the anonymous-complaint false-positive control. |

The application (`src/lib/analytics/kpis.ts` and `src/lib/quality.ts`) remains the
source of truth. If a definition changes, update the app, the SQL library, the
Power BI DAX documentation and this toolkit together.

### Time boundaries

The dashboard resolves periods in **Asia/Kolkata (UTC+05:30)**. CSV timestamps
are UTC. The toolkit converts IST day boundaries to UTC before filtering, so the
Python and dashboard windows match. This matters for records created between
18:30 and midnight UTC.

`--from` / `--to` are IST calendar dates. `--as-of` on the risk command is
interpreted as the end of that UTC day, because the export has no timezone
context beyond UTC.

### Snapshot semantics

Risk measures use the latest snapshot **on or before** the as-of date. Python
never back-fills a historical score from today's register. The live register is
only used when the as-of date is effectively the extract timestamp, mirroring
the app's current-date fallback. Premises with no snapshot remain unrated.

### Data quality false positives

The toolkit deliberately does **not** flag:

- anonymous complaints that have no citizen identity (a legitimate anonymous
  complaint);
- expired compliance documents (a regulatory follow-up, not a data defect);
- supplier licence gaps as an analytics error (supplier-master follow-up).

The only anonymity finding is `anonymous = 1 AND hasCitizenLink = 1`. The
self-test constructs both a legitimate anonymous case and a contradictory case
to prove the rule behaves correctly.

Three rules cannot be evaluated from the CSV extract because the checklist,
document and supplier tables are not exported. They are reported as **not
evaluable** rather than silently passing.

## Notebook

`notebooks/safebite_exploration.ipynb` loads the extract, prints the KPI table,
shows the risk register, factor profile, district comparison and quality
reconciliation. Open it from `analytics/python`:

```powershell
py -m jupyter lab notebooks/safebite_exploration.ipynb
```

The notebook resolves the repository root from its own location, so it works
without changing directory as long as it is opened in place.

## Extending

1. Add a KPI to both the app engine and `kpis.py`.
2. Add the same definition to `analytics/sql/` in both dialects.
3. Add a DAX measure to `docs/powerbi/dax_measures.md` if Power BI consumers
   need it.
4. Add an assertion to `selftest.py` and run `py -m safebite_analytics self-test`.

Keep calculations vectorised where practical, but prefer readable pandas over
clever one-liners. The demo extract is small; correctness and auditability matter
more than micro-optimisation.

## Limitations

- The CSV extract is a static snapshot, not a live connection. Re-run
  `npm run analytics:datasets` after database changes.
- Complaint SLA durations are calendar days, not business days.
- No acknowledgement, on-site inspection duration, laboratory, report-approval
  or enforcement timestamps exist in the source schema.
- Business status is current status; historical status changes are not modelled.
- The Python quality view is a reconciliation aid, not the authoritative score.
- The toolkit does not contain citizen identities, complaint narratives,
  passwords or emails.
