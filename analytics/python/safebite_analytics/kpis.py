"""KPI calculations for the Python toolkit.

This module mirrors the governed definitions in ``src/lib/analytics/kpis.ts``
using the Power BI CSV extracts. The application remains the source of truth for
the dashboard; these calculations exist so analysts can reproduce, reconcile and
extend the numbers outside Next.js.

Time boundaries
---------------
The application resolves reporting periods in Asia/Kolkata (IST, UTC+05:30).
The CSV timestamps are UTC. Functions here convert IST day boundaries to UTC
before filtering, so a "last 90 days" window in Python matches the dashboard.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import pandas as pd

from .loader import Datasets

DAY = pd.Timedelta(days=1)
IST = "Asia/Kolkata"
UTC = "UTC"

KPI_ORDER = [
    "registered_businesses",
    "high_risk_premises",
    "average_risk_score",
    "inspections_completed",
    "inspection_completion_rate",
    "critical_violations",
    "violations_per_inspection",
    "repeat_violation_rate",
    "complaints_received",
    "complaints_resolved",
    "average_resolution_days",
    "sla_compliance",
    "overdue_open_complaints",
]

KPI_META = {
    "registered_businesses": {
        "name": "Registered businesses",
        "unit": "count",
        "desired": "neutral",
    },
    "high_risk_premises": {
        "name": "High-risk premises (C + D)",
        "unit": "count",
        "desired": "down",
    },
    "average_risk_score": {
        "name": "Average risk score",
        "unit": "score",
        "desired": "down",
    },
    "inspections_completed": {
        "name": "Inspections completed",
        "unit": "count",
        "desired": "up",
    },
    "inspection_completion_rate": {
        "name": "Inspection completion rate",
        "unit": "percent",
        "desired": "up",
    },
    "critical_violations": {
        "name": "Critical violations",
        "unit": "count",
        "desired": "down",
    },
    "violations_per_inspection": {
        "name": "Violations per inspection",
        "unit": "rate",
        "desired": "down",
    },
    "repeat_violation_rate": {
        "name": "Repeat violation share",
        "unit": "percent",
        "desired": "down",
    },
    "complaints_received": {
        "name": "Complaints received",
        "unit": "count",
        "desired": "neutral",
    },
    "complaints_resolved": {
        "name": "Complaints resolved",
        "unit": "count",
        "desired": "up",
    },
    "average_resolution_days": {
        "name": "Average resolution time",
        "unit": "days",
        "desired": "down",
    },
    "sla_compliance": {
        "name": "Complaint SLA compliance",
        "unit": "percent",
        "desired": "up",
    },
    "overdue_open_complaints": {
        "name": "Overdue open complaints",
        "unit": "count",
        "desired": "down",
    },
}


@dataclass(frozen=True)
class Period:
    key: str
    start: pd.Timestamp
    end: pd.Timestamp
    previous_start: pd.Timestamp
    previous_end: pd.Timestamp
    days: int
    label: str
    previous_label: str


@dataclass(frozen=True)
class Scope:
    business_ids: frozenset[str]
    district: str | None
    allow_unattached: bool
    businesses: pd.DataFrame = field(repr=False)


def _as_utc(value: str | pd.Timestamp) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        return timestamp.tz_localize(UTC)
    return timestamp.tz_convert(UTC)


def start_of_ist_day(value: str | pd.Timestamp) -> pd.Timestamp:
    """Midnight IST for a date or timestamp, returned as a UTC timestamp."""

    if isinstance(value, str) and len(value) == 10:
        return pd.Timestamp(f"{value}T00:00:00+05:30").tz_convert(UTC)
    return _as_utc(value).tz_convert(IST).normalize().tz_convert(UTC)


def _start_of_ist_month(value: str | pd.Timestamp) -> pd.Timestamp:
    local = _as_utc(value).tz_convert(IST)
    return local.replace(day=1, hour=0, minute=0, second=0, microsecond=0).tz_convert(UTC)


def _add_months(value: pd.Timestamp, months: int) -> pd.Timestamp:
    local = value.tz_convert(IST)
    month_index = local.year * 12 + (local.month - 1) + months
    year, month = divmod(month_index, 12)
    return pd.Timestamp(year=year, month=month + 1, day=1, tz=IST).tz_convert(UTC)


def _format_ist(value: pd.Timestamp) -> str:
    return value.tz_convert(IST).strftime("%d %b %Y")


def resolve_period(
    period: str = "last90",
    from_date: str | None = None,
    to_date: str | None = None,
    now: pd.Timestamp | None = None,
) -> Period:
    """Resolve a reporting period and its equal-length comparison window.

    Supported presets: ``last7``, ``last30``, ``last90``, ``current_month``,
    ``previous_month`` and ``custom`` (requires ``from_date`` and ``to_date``).
    """

    current = _as_utc(now) if now is not None else pd.Timestamp.now(tz=UTC)
    key = period

    if period == "last7":
        start = start_of_ist_day(current) - 6 * DAY
        end = current
    elif period == "last30":
        start = start_of_ist_day(current) - 29 * DAY
        end = current
    elif period == "last90":
        start = start_of_ist_day(current) - 89 * DAY
        end = current
    elif period == "current_month":
        start = _start_of_ist_month(current)
        end = current
    elif period == "previous_month":
        start = _add_months(_start_of_ist_month(current), -1)
        end = _start_of_ist_month(current)
    elif period == "custom":
        if not from_date or not to_date:
            raise ValueError("Custom period requires both from_date and to_date (YYYY-MM-DD).")
        start = start_of_ist_day(from_date)
        end = start_of_ist_day(to_date) + DAY
    else:
        raise ValueError(
            f"Unknown period preset '{period}'. Use last7, last30, last90, "
            "current_month, previous_month or custom."
        )

    if start > end:
        start, end = end, start
        key = "custom"

    duration = max(DAY, end - start)
    previous_end = start
    previous_start = start - duration
    days = max(1, int((duration + DAY - pd.Timedelta(microseconds=1)) // DAY))

    return Period(
        key=key,
        start=start,
        end=end,
        previous_start=previous_start,
        previous_end=previous_end,
        days=days,
        label=f"{_format_ist(start)} - {_format_ist(end - pd.Timedelta(milliseconds=1))}",
        previous_label=(
            f"{_format_ist(previous_start)} - "
            f"{_format_ist(previous_end - pd.Timedelta(milliseconds=1))}"
        ),
    )


def make_scope(
    datasets: Datasets,
    district: str | None = None,
    category: str | None = None,
    risk_tier: str | None = None,
) -> Scope:
    businesses = datasets.businesses
    if district:
        businesses = businesses[businesses["district"] == district]
    if category:
        businesses = businesses[businesses["category"] == category]
    if risk_tier:
        businesses = businesses[businesses["riskTier"] == risk_tier.upper()]
    return Scope(
        business_ids=frozenset(businesses["businessId"].dropna()),
        district=district or None,
        allow_unattached=not category and not risk_tier,
        businesses=businesses,
    )


def _in_window(values: pd.Series, start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    return values.notna() & (values >= start) & (values < end)


def _scope_complaints(datasets: Datasets, scope: Scope) -> pd.DataFrame:
    complaints = datasets.complaints
    attached = complaints["businessId"].isin(scope.business_ids)
    if scope.allow_unattached:
        unattached = complaints["businessId"].isna() | (complaints["businessId"] == "")
        if scope.district:
            unattached = unattached & (complaints["district"] == scope.district)
        return complaints[attached | unattached]
    return complaints[attached]


def _scope_inspections(datasets: Datasets, scope: Scope) -> pd.DataFrame:
    return datasets.inspections[datasets.inspections["businessId"].isin(scope.business_ids)]


def _mean(values: Iterable[float]) -> float | None:
    series = pd.Series(list(values), dtype="float64").dropna()
    return float(series.mean()) if len(series) else None


def _percent(numerator: int | float, denominator: int | float) -> float | None:
    if denominator is None or denominator == 0:
        return None
    return float(numerator) / float(denominator) * 100.0


def _none_if_nan(value: float | int | None) -> float | None:
    if value is None or pd.isna(value):
        return None
    return float(value)


def event_metrics(datasets: Datasets, scope: Scope, start: pd.Timestamp, end: pd.Timestamp) -> dict:
    """Event-window metrics for inspections, violations and complaints."""

    inspections = _scope_inspections(datasets, scope)
    complaints = _scope_complaints(datasets, scope)

    # Inspections only count as "due" once their planned date has arrived.
    due_end = min(end, datasets.generated_at)
    due = inspections[
        _in_window(inspections["scheduledAt"], start, due_end)
    ]
    completed_due = due[
        due["completedAt"].notna() & (due["completedAt"] < end)
    ]
    completed = inspections[_in_window(inspections["completedAt"], start, end)]

    completed_ids = set(completed["inspectionId"])
    violations = datasets.violations[datasets.violations["inspectionId"].isin(completed_ids)]

    prior = inspections[inspections["completedAt"].notna() & (inspections["completedAt"] < start)]
    prior_ids = set(prior["inspectionId"])
    prior_findings = set(
        zip(
            datasets.violations.loc[
                datasets.violations["inspectionId"].isin(prior_ids), "businessId"
            ],
            datasets.violations.loc[
                datasets.violations["inspectionId"].isin(prior_ids), "violationType"
            ],
        )
    )
    repeat = sum(
        1
        for business_id, violation_type in zip(
            violations["businessId"], violations["violationType"]
        )
        if (business_id, violation_type) in prior_findings
    )

    received = complaints[_in_window(complaints["createdAt"], start, end)]
    resolved_window = complaints[_in_window(complaints["resolvedAt"], start, end)]
    invalid = 0
    no_timestamp = complaints[
        (complaints["status"] == "resolved") & complaints["resolvedAt"].isna()
    ]
    invalid += len(no_timestamp)
    negative = resolved_window[
        resolved_window["resolvedAt"].notna()
        & (resolved_window["resolvedAt"] < resolved_window["createdAt"])
    ]
    invalid += len(negative)
    valid = resolved_window[
        resolved_window["resolvedAt"].notna()
        & (resolved_window["resolvedAt"] >= resolved_window["createdAt"])
    ]
    durations = (
        (valid["resolvedAt"] - valid["createdAt"]).dt.total_seconds() / 86400.0
    )
    within_sla = int((durations <= valid["slaDays"]).sum()) if len(valid) else 0

    return {
        "inspections_completed": int(len(completed)),
        "due_inspections": int(len(due)),
        "completed_due_inspections": int(len(completed_due)),
        "inspection_completion_rate": _percent(len(completed_due), len(due)),
        "total_violations": int(len(violations)),
        "critical_violations": int((violations["severity"] == "critical").sum()),
        "violations_per_inspection": (
            float(len(violations)) / len(completed) if len(completed) else None
        ),
        "repeat_violations": int(repeat),
        "repeat_violation_rate": _percent(repeat, len(violations)),
        "complaints_received": int(len(received)),
        "complaints_resolved": int(len(valid)),
        "average_resolution_days": _mean(durations),
        "sla_compliant": within_sla,
        "sla_evaluated": int(len(valid)),
        "sla_compliance": _percent(within_sla, len(valid)),
        "invalid_complaints": int(invalid),
    }


def _latest_snapshot_frame(datasets: Datasets, as_of: pd.Timestamp) -> pd.DataFrame:
    eligible = datasets.snapshots[
        datasets.snapshots["snapshotAt"].notna()
        & (datasets.snapshots["snapshotAt"] <= as_of)
    ].sort_values("snapshotAt")
    return eligible.groupby("businessId", as_index=False).tail(1)


def snapshot_metrics(
    datasets: Datasets, scope: Scope, as_of: pd.Timestamp
) -> dict:
    """Point-in-time register, risk and overdue metrics at ``as_of``."""

    businesses = scope.businesses
    registered = businesses[
        businesses["registeredAt"].notna()
        & (businesses["registeredAt"] < as_of)
        & (businesses["status"] != "closed")
    ]
    latest = _latest_snapshot_frame(datasets, as_of)
    rated = registered.merge(
        latest[["businessId", "score", "tier"]], on="businessId", how="left"
    )

    # Match the dashboard fallback: the live register is only used when the
    # as-of date is effectively "now". Historical gaps stay unrated.
    if as_of >= datasets.generated_at - pd.Timedelta(seconds=60):
        rated["score"] = rated["score"].fillna(rated["riskScore"])
        rated["tier"] = rated["tier"].fillna(rated["riskTier"])

    scored = rated[rated["score"].notna()]
    high_risk = int(scored["tier"].isin(["C", "D"]).sum())

    complaints = _scope_complaints(datasets, scope)
    open_before = complaints[
        complaints["createdAt"].notna() & (complaints["createdAt"] < as_of)
    ]
    invalid_overdue = int(
        ((open_before["status"] == "resolved") & open_before["resolvedAt"].isna()).sum()
    )
    active = open_before[
        ~((open_before["status"] == "resolved") & open_before["resolvedAt"].isna())
    ]
    active = active[active["resolvedAt"].isna() | (active["resolvedAt"] >= as_of)]
    due_at = active["createdAt"] + pd.to_timedelta(active["slaDays"], unit="D")
    overdue = int((due_at < as_of).sum())

    return {
        "registered_businesses": int(len(registered)),
        "rated_businesses": int(len(scored)),
        "high_risk_premises": high_risk,
        "average_risk_score": _mean(scored["score"]),
        "overdue_open_complaints": overdue,
        "invalid_overdue": invalid_overdue,
    }


def _comparison(current: float | None, previous: float | None, desired: str) -> dict:
    if current is None or previous is None:
        return {
            "previous": previous,
            "absolute_change": None,
            "percent_change": None,
            "direction": "none",
            "favourable": "none",
        }
    absolute = round(current - previous, 3)
    percent = None if previous == 0 else round((current - previous) / abs(previous) * 100, 1)
    if abs(absolute) < 0.0001:
        direction = "flat"
    else:
        direction = "up" if absolute > 0 else "down"

    if direction == "flat":
        favourable = "flat"
    elif desired == "neutral":
        favourable = "none"
    elif desired == "down":
        favourable = "up" if direction == "down" else "down"
    else:
        favourable = direction

    return {
        "previous": previous,
        "absolute_change": absolute,
        "percent_change": percent,
        "direction": direction,
        "favourable": favourable,
    }


def compute_kpis(
    datasets: Datasets,
    period: Period | None = None,
    district: str | None = None,
    category: str | None = None,
    risk_tier: str | None = None,
) -> list[dict]:
    """Compute the 13 governed KPIs with equal-length previous-period values."""

    period = period or resolve_period("last90", now=datasets.generated_at)
    scope = make_scope(datasets, district=district, category=category, risk_tier=risk_tier)

    current = event_metrics(datasets, scope, period.start, period.end)
    previous = event_metrics(datasets, scope, period.previous_start, period.previous_end)
    current_snap = snapshot_metrics(datasets, scope, period.end)
    previous_snap = snapshot_metrics(datasets, scope, period.previous_end)

    values = {
        "registered_businesses": (
            current_snap["registered_businesses"],
            previous_snap["registered_businesses"],
            current_snap["registered_businesses"],
            None,
        ),
        "high_risk_premises": (
            current_snap["high_risk_premises"],
            previous_snap["high_risk_premises"],
            current_snap["high_risk_premises"],
            current_snap["rated_businesses"],
        ),
        "average_risk_score": (
            current_snap["average_risk_score"],
            previous_snap["average_risk_score"],
            None,
            current_snap["rated_businesses"],
        ),
        "inspections_completed": (
            current["inspections_completed"],
            previous["inspections_completed"],
            current["inspections_completed"],
            None,
        ),
        "inspection_completion_rate": (
            current["inspection_completion_rate"],
            previous["inspection_completion_rate"],
            current["completed_due_inspections"],
            current["due_inspections"],
        ),
        "critical_violations": (
            current["critical_violations"],
            previous["critical_violations"],
            current["critical_violations"],
            current["total_violations"],
        ),
        "violations_per_inspection": (
            current["violations_per_inspection"],
            previous["violations_per_inspection"],
            current["total_violations"],
            current["inspections_completed"],
        ),
        "repeat_violation_rate": (
            current["repeat_violation_rate"],
            previous["repeat_violation_rate"],
            current["repeat_violations"],
            current["total_violations"],
        ),
        "complaints_received": (
            current["complaints_received"],
            previous["complaints_received"],
            current["complaints_received"],
            None,
        ),
        "complaints_resolved": (
            current["complaints_resolved"],
            previous["complaints_resolved"],
            current["complaints_resolved"],
            current["complaints_received"],
        ),
        "average_resolution_days": (
            current["average_resolution_days"],
            previous["average_resolution_days"],
            current["complaints_resolved"],
            None,
        ),
        "sla_compliance": (
            current["sla_compliance"],
            previous["sla_compliance"],
            current["sla_compliant"],
            current["sla_evaluated"],
        ),
        "overdue_open_complaints": (
            current_snap["overdue_open_complaints"],
            previous_snap["overdue_open_complaints"],
            current_snap["overdue_open_complaints"],
            None,
        ),
    }

    rows: list[dict] = []
    for kpi_id in KPI_ORDER:
        meta = KPI_META[kpi_id]
        value, previous_value, numerator, denominator = values[kpi_id]
        comparison = _comparison(
            _none_if_nan(value), _none_if_nan(previous_value), meta["desired"]
        )
        rows.append(
            {
                "id": kpi_id,
                "name": meta["name"],
                "unit": meta["unit"],
                "desired_direction": meta["desired"],
                "value": _none_if_nan(value),
                "numerator": numerator,
                "denominator": denominator,
                **comparison,
            }
        )
    return rows


def format_value(value: float | None, unit: str) -> str:
    if value is None or pd.isna(value):
        return "—"
    if unit == "count":
        return f"{value:,.0f}"
    if unit == "percent":
        return f"{value:.1f}%"
    if unit == "days":
        return f"{value:.1f} d"
    if unit == "score":
        return f"{value:.1f}/100"
    return f"{value:.2f}"


def kpi_frame(rows: list[dict]) -> pd.DataFrame:
    frame = pd.DataFrame(rows)
    frame["current_display"] = [
        format_value(value, unit) for value, unit in zip(frame["value"], frame["unit"])
    ]
    frame["previous_display"] = [
        format_value(value, unit)
        for value, unit in zip(frame["previous"], frame["unit"])
    ]
    frame["assessment"] = frame["favourable"].map(
        {
            "up": "Favourable",
            "down": "Adverse",
            "flat": "Flat",
            "none": "No baseline / neutral",
        }
    )
    return frame
