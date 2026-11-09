"""Command-line interface for the SafeBite analytics toolkit."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import pandas as pd

from .kpis import compute_kpis, kpi_frame, resolve_period
from .loader import RISK_WEIGHTS, Datasets, load_datasets
from .quality import compare_with_export, evaluate_quality
from .risk import district_risk, factor_profile, latest_risk, risk_movers, tier_summary


def _markdown(frame: pd.DataFrame) -> str:
    if frame.empty:
        return "_No rows._"
    columns = [str(column) for column in frame.columns]
    lines = [
        "| " + " | ".join(columns) + " |",
        "| " + " | ".join("---" for _ in columns) + " |",
    ]
    for _, row in frame.iterrows():
        cells = []
        for column in frame.columns:
            value = row[column]
            if value is None or (isinstance(value, float) and pd.isna(value)):
                cells.append("—")
            elif isinstance(value, float):
                cells.append(f"{value:,.2f}".rstrip("0").rstrip("."))
            else:
                cells.append(str(value))
        lines.append("| " + " | ".join(cells) + " |")
    return "\n".join(lines)


def _jsonable(value: object) -> object:
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if isinstance(value, float) and pd.isna(value):
        return None
    if hasattr(value, "item"):
        return value.item()
    return value


def _print_json(payload: object) -> None:
    print(json.dumps(payload, indent=2, default=_jsonable))


def _load(args: argparse.Namespace) -> Datasets:
    data_dir = Path(args.data_dir) if args.data_dir else None
    return load_datasets(data_dir)


def command_info(args: argparse.Namespace) -> int:
    datasets = _load(args)
    summary = {
        "data_dir": str(datasets.data_dir),
        "generated_at": datasets.generated_at.isoformat(),
        "rows": {
            "businesses": len(datasets.businesses),
            "inspections": len(datasets.inspections),
            "violations": len(datasets.violations),
            "complaints": len(datasets.complaints),
            "snapshots": len(datasets.snapshots),
            "quality_rules": len(datasets.quality_rules),
        },
        "latest_snapshot": datasets.snapshots["snapshotAt"].max().isoformat(),
        "risk_weights": RISK_WEIGHTS,
    }
    if args.json:
        _print_json(summary)
        return 0

    print(f"Data directory: {summary['data_dir']}")
    print(f"Extract generated: {summary['generated_at']}")
    print(f"Latest snapshot: {summary['latest_snapshot']}")
    print()
    print(_markdown(pd.DataFrame([summary["rows"]]).T.rename(columns={0: "rows"})))
    print("\nRisk weights (deterministic policy rules, not ML):")
    for key, value in RISK_WEIGHTS.items():
        print(f"- {key}: {value} points")
    return 0


def command_kpis(args: argparse.Namespace) -> int:
    datasets = _load(args)
    period = resolve_period(
        period=args.period,
        from_date=args.start,
        to_date=args.end,
        now=datasets.generated_at,
    )
    rows = compute_kpis(
        datasets,
        period=period,
        district=args.district,
        category=args.category,
        risk_tier=args.tier,
    )
    frame = kpi_frame(rows)[
        [
            "name",
            "current_display",
            "previous_display",
            "absolute_change",
            "percent_change",
            "assessment",
        ]
    ].rename(
        columns={
            "name": "KPI",
            "current_display": "Current",
            "previous_display": "Previous",
            "absolute_change": "Change",
            "percent_change": "Change %",
            "assessment": "Assessment",
        }
    )

    if args.json:
        _print_json(
            {
                "period": {
                    "key": period.key,
                    "label": period.label,
                    "start": period.start,
                    "end": period.end,
                    "previous_label": period.previous_label,
                    "days": period.days,
                },
                "filters": {
                    "district": args.district,
                    "category": args.category,
                    "risk_tier": args.tier,
                },
                "kpis": rows,
            }
        )
        return 0

    print(f"Period: {period.label} ({period.days} days)")
    print(f"Comparison: {period.previous_label}")
    if args.district or args.category or args.tier:
        print(
            "Filters: "
            + ", ".join(
                value
                for value in [
                    f"district={args.district}" if args.district else "",
                    f"category={args.category}" if args.category else "",
                    f"tier={args.tier}" if args.tier else "",
                ]
                if value
            )
        )
    print()
    print(_markdown(frame))
    print("\nIST day boundaries are converted to UTC before filtering, matching the dashboard.")
    return 0


def command_risk(args: argparse.Namespace) -> int:
    datasets = _load(args)
    as_of = pd.Timestamp(args.as_of, tz="UTC") + pd.Timedelta(hours=23, minutes=59, seconds=59) if args.as_of else datasets.generated_at
    tiers = tier_summary(datasets, as_of)
    top = latest_risk(datasets, as_of).head(args.top)[
        ["name", "district", "category", "score", "tier", "topFactor"]
    ]
    districts = district_risk(datasets, as_of)
    factors = factor_profile(datasets, as_of)
    movers = risk_movers(datasets, as_of, days=args.days, limit=args.top)[
        ["name", "district", "priorScore", "currentScore", "scoreChange", "direction"]
    ]

    if args.json:
        _print_json(
            {
                "as_of": as_of,
                "tier_summary": tiers.to_dict(orient="records"),
                "top_risk": top.to_dict(orient="records"),
                "districts": districts.to_dict(orient="records"),
                "factor_profile": factors.to_dict(orient="records"),
                "movers": movers.to_dict(orient="records"),
            }
        )
        return 0

    print(f"As of: {as_of.isoformat()}")
    print("\n## Tier distribution\n")
    print(_markdown(tiers))
    print("\n## Highest-risk premises\n")
    print(_markdown(top))
    print("\n## District comparison\n")
    print(_markdown(districts))
    print("\n## Factor profile (latest snapshots)\n")
    print(_markdown(factors))
    print(f"\n## Largest {args.days}-day increases\n")
    print(_markdown(movers))
    print(
        "\nScores are deterministic weighted policy rules (0–100, higher = riskier), "
        "not a trained model or a probability of illness."
    )
    return 0


def command_quality(args: argparse.Namespace) -> int:
    datasets = _load(args)
    report = evaluate_quality(datasets)
    comparison = compare_with_export(datasets, report)

    if args.json:
        _print_json(
            {
                "generated_at": report.generated_at,
                "rules_evaluated": report.rules_evaluated,
                "issues": report.issues,
                "findings": report.findings,
                "not_evaluable": report.not_evaluable,
                "notes": report.notes,
                "comparison": comparison.to_dict(orient="records"),
            }
        )
        return 0

    print(f"Extract generated: {report.generated_at.isoformat()}")
    print(f"Rules evaluated from extracts: {report.rules_evaluated}")
    print(f"Issues found: {report.issues}")
    print("\n## Findings\n")
    if report.findings:
        print(
            _markdown(
                pd.DataFrame(report.findings)[
                    ["ruleId", "rule", "severity", "affectedRecords"]
                ]
            )
        )
    else:
        print("_No evaluable rule failed._")
    print("\n## Not evaluable from the CSV extracts\n")
    print(_markdown(pd.DataFrame(
        [{"ruleId": key, "reason": value} for key, value in report.not_evaluable.items()]
    )))
    print("\n## Comparison with the app export\n")
    print(_markdown(comparison[["ruleId", "pythonCount", "exportedCount", "status"]]))
    mismatches = comparison[comparison["status"] == "Mismatch"]
    if not mismatches.empty:
        print(
            f"\n{len(mismatches)} rule(s) do not reconcile. Re-run "
            "`npm run analytics:datasets` and investigate before using the extract."
        )
        return 1
    print("\nAll evaluable rules reconcile with the app's exported findings.")
    print("\n" + "\n".join(f"- {note}" for note in report.notes))
    return 0


def command_self_test(args: argparse.Namespace) -> int:
    from .selftest import run_self_test

    return run_self_test(Path(args.data_dir) if args.data_dir else None)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="safebite-analytics",
        description=(
            "SafeBite analytics toolkit. Reads the Power BI CSV extracts and "
            "reproduces the governed KPIs, risk views and data-quality checks."
        ),
    )
    parser.add_argument(
        "--data-dir",
        help="Directory containing the CSV extracts (default: public/powerbi).",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    info = sub.add_parser("info", help="Show extract metadata and row counts.")
    info.add_argument("--json", action="store_true")
    info.set_defaults(func=command_info)

    kpis = sub.add_parser("kpis", help="Compute the 13 governed KPIs.")
    kpis.add_argument(
        "--period",
        default="last90",
        choices=["last7", "last30", "last90", "current_month", "previous_month", "custom"],
    )
    kpis.add_argument("--from", dest="start", help="Custom start date (YYYY-MM-DD, IST).")
    kpis.add_argument("--to", dest="end", help="Custom end date (YYYY-MM-DD, IST).")
    kpis.add_argument("--district")
    kpis.add_argument("--category")
    kpis.add_argument("--tier", help="Risk tier filter (A/B/C/D).")
    kpis.add_argument("--json", action="store_true")
    kpis.set_defaults(func=command_kpis)

    risk = sub.add_parser("risk", help="Risk tiers, rankings, districts, factors and movers.")
    risk.add_argument("--as-of", help="Point-in-time date (YYYY-MM-DD, interpreted as end of day UTC).")
    risk.add_argument("--top", type=int, default=10)
    risk.add_argument("--days", type=int, default=30, help="Mover comparison window.")
    risk.add_argument("--json", action="store_true")
    risk.set_defaults(func=command_risk)

    quality = sub.add_parser("quality", help="Run extract-level data-quality checks.")
    quality.add_argument("--json", action="store_true")
    quality.set_defaults(func=command_quality)

    selftest = sub.add_parser("self-test", help="Run toolkit self-tests against the extracts.")
    selftest.set_defaults(func=command_self_test)
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except (FileNotFoundError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
