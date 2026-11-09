"""Self-tests for the Python toolkit.

Run with ``py -m safebite_analytics self-test``. These tests use the real
extracts, not synthetic KPI values, and fail loudly when the CSV export drifts
from the application's governed definitions.
"""

from __future__ import annotations

from dataclasses import replace
from pathlib import Path

import pandas as pd

from .kpis import KPI_ORDER, compute_kpis, event_metrics, make_scope, resolve_period
from .loader import RISK_WEIGHTS, load_datasets, risk_band
from .quality import _evaluators, compare_with_export, evaluate_quality
from .risk import latest_risk, tier_summary


def run_self_test(data_dir: Path | None = None) -> int:
    failures: list[str] = []
    passes: list[str] = []

    def check(name: str, condition: bool, detail: str = "") -> None:
        if condition:
            passes.append(name)
            print(f"PASS  {name}")
        else:
            failures.append(f"{name}{': ' + detail if detail else ''}")
            print(f"FAIL  {name}{' — ' + detail if detail else ''}")

    datasets = load_datasets(data_dir)
    check(
        "Extract contains all core tables",
        all(
            len(frame) > 0
            for frame in [
                datasets.businesses,
                datasets.inspections,
                datasets.violations,
                datasets.complaints,
                datasets.snapshots,
            ]
        ),
        f"{datasets.data_dir}",
    )
    check(
        "Extract timestamp is present",
        pd.notna(datasets.generated_at),
        str(datasets.generated_at),
    )

    period = resolve_period("last90", now=datasets.generated_at)
    check(
        "Previous period is equal length",
        (period.end - period.start) == (period.previous_end - period.previous_start),
        f"{period.start} → {period.end}",
    )

    rows = compute_kpis(datasets, period)
    check(
        "Exactly 13 governed KPIs are returned",
        len(rows) == 13 and [row["id"] for row in rows] == KPI_ORDER,
        f"{len(rows)} rows",
    )
    check(
        "KPI values are numeric or explicitly unavailable",
        all(
            row["value"] is None or isinstance(row["value"], (int, float))
            for row in rows
        ),
    )

    check(
        "Risk factor weights sum to 100",
        sum(RISK_WEIGHTS.values()) == 100,
        str(sum(RISK_WEIGHTS.values())),
    )
    check(
        "Risk tier bands follow policy",
        [risk_band(score) for score in [0, 25, 25.1, 50, 50.1, 75, 75.1, 100]]
        == ["A", "A", "B", "B", "C", "C", "D", "D"],
    )

    ranked = latest_risk(datasets, datasets.generated_at)
    tiers = tier_summary(datasets, datasets.generated_at)
    check(
        "Tier distribution covers every rated premises",
        int(tiers["businesses"].sum()) == len(ranked),
        f"{int(tiers['businesses'].sum())} vs {len(ranked)}",
    )
    check(
        "Rated premises are within 0-100",
        bool(ranked["score"].between(0, 100).all()),
    )

    complaints = datasets.complaints
    legit = complaints[(complaints["anonymous"] == 1) & (complaints["hasCitizenLink"] == 0)]
    flagged = set(_evaluators()["C-ANON-CONFLICT"](datasets))
    check(
        "Legitimate anonymous complaints are not flagged",
        not (flagged & set(legit["complaintId"])),
        f"{len(legit)} anonymous complaints checked",
    )

    # Explicit synthetic case for the false-positive control.
    base = complaints.iloc[[0]].copy()
    base["complaintId"] = "synthetic-anon"
    base["anonymous"] = 1
    base["hasCitizenLink"] = 0
    legit_case = replace(datasets, complaints=pd.concat([complaints, base], ignore_index=True))
    conflict = base.copy()
    conflict["complaintId"] = "synthetic-conflict"
    conflict["hasCitizenLink"] = 1
    conflict_case = replace(
        datasets, complaints=pd.concat([complaints, conflict], ignore_index=True)
    )
    check(
        "Synthetic anonymous-only complaint passes",
        "synthetic-anon" not in _evaluators()["C-ANON-CONFLICT"](legit_case),
    )
    check(
        "Synthetic anonymous complaint with citizen link fails",
        "synthetic-conflict" in _evaluators()["C-ANON-CONFLICT"](conflict_case),
    )

    report = evaluate_quality(datasets)
    comparison = compare_with_export(datasets, report)
    mismatches = comparison[comparison["status"] == "Mismatch"]
    check(
        "Extract-level quality counts reconcile with the app export",
        mismatches.empty,
        "; ".join(
            f"{row.ruleId}: python={row.pythonCount} exported={row.exportedCount}"
            for row in mismatches.itertuples()
        ),
    )

    scope = make_scope(datasets)
    metrics = event_metrics(datasets, scope, period.start, period.end)
    check(
        "Resolution time excludes impossible lifecycles",
        metrics["average_resolution_days"] is None or metrics["average_resolution_days"] >= 0,
        str(metrics["average_resolution_days"]),
    )

    print()
    print(f"{len(passes)} passed, {len(failures)} failed.")
    if failures:
        print("\nFailures:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    return 0
