"""Risk analytics for the SafeBite Python toolkit.

The score is a deterministic weighted policy rule set (violations 40, recent
complaints 25, inspection timeliness 15, document compliance 10, category
baseline 10). It is **not** a trained machine-learning model and must not be
described as a probability of illness.
"""

from __future__ import annotations

import pandas as pd

from .loader import (
    FACTOR_COLUMNS,
    RISK_FACTOR_LABELS,
    RISK_TIER_LABELS,
    RISK_WEIGHTS,
    Datasets,
    risk_band,
)

DAY = pd.Timedelta(days=1)


def _as_utc(value: str | pd.Timestamp) -> pd.Timestamp:
    timestamp = pd.Timestamp(value)
    if timestamp.tzinfo is None:
        return timestamp.tz_localize("UTC")
    return timestamp.tz_convert("UTC")


def latest_risk(datasets: Datasets, as_of: str | pd.Timestamp | None = None) -> pd.DataFrame:
    """Latest snapshot per business at or before ``as_of`` with labels."""

    current = _as_utc(as_of) if as_of else datasets.generated_at
    eligible = datasets.snapshots[
        datasets.snapshots["snapshotAt"].notna()
        & (datasets.snapshots["snapshotAt"] <= current)
    ].sort_values("snapshotAt")
    latest = eligible.groupby("businessId", as_index=False).tail(1)

    frame = latest.merge(
        datasets.businesses[
            ["businessId", "name", "category", "status", "riskTier", "riskScore"]
        ],
        on="businessId",
        how="left",
        suffixes=("", "_register"),
    )
    frame = frame[frame["status"] != "closed"].copy()
    frame["tierLabel"] = frame["tier"].map(RISK_TIER_LABELS).fillna(frame["tier"])
    frame["scoreBand"] = frame["score"].map(risk_band)

    factor_share = frame[FACTOR_COLUMNS].div(frame["score"].replace(0, pd.NA), axis=0) * 100
    factor_share = factor_share.fillna(0)
    frame["topFactor"] = factor_share.idxmax(axis=1).map(RISK_FACTOR_LABELS)
    frame["topFactorPoints"] = frame[FACTOR_COLUMNS].max(axis=1)
    return frame.sort_values("score", ascending=False).reset_index(drop=True)


def tier_summary(datasets: Datasets, as_of: str | pd.Timestamp | None = None) -> pd.DataFrame:
    """Business count, share and average score by current risk tier."""

    frame = latest_risk(datasets, as_of)
    total = len(frame)
    rows = []
    for tier in ["A", "B", "C", "D"]:
        subset = frame[frame["tier"] == tier]
        rows.append(
            {
                "tier": tier,
                "label": RISK_TIER_LABELS[tier],
                "businesses": len(subset),
                "share_percent": round(len(subset) / total * 100, 1) if total else None,
                "average_score": round(float(subset["score"].mean()), 1) if len(subset) else None,
            }
        )
    return pd.DataFrame(rows)


def factor_profile(
    datasets: Datasets, as_of: str | pd.Timestamp | None = None
) -> pd.DataFrame:
    """Average points and budget utilisation for each risk factor."""

    frame = latest_risk(datasets, as_of)
    rows = []
    for column in FACTOR_COLUMNS:
        maximum = RISK_WEIGHTS[column]
        average = float(frame[column].mean()) if len(frame) else 0.0
        rows.append(
            {
                "factor": RISK_FACTOR_LABELS[column],
                "key": column,
                "average_points": round(average, 1),
                "max_points": maximum,
                "average_utilisation_percent": round(average / maximum * 100, 1),
                "businesses_at_cap": int((frame[column] >= maximum).sum()),
            }
        )
    return pd.DataFrame(rows)


def risk_movers(
    datasets: Datasets,
    as_of: str | pd.Timestamp | None = None,
    days: int = 30,
    limit: int = 10,
) -> pd.DataFrame:
    """Largest score increases between ``as_of - days`` and ``as_of``."""

    current_date = _as_utc(as_of) if as_of else datasets.generated_at
    prior_date = current_date - days * DAY

    current = latest_risk(datasets, current_date)[
        ["businessId", "name", "district", "category", "score", "tier"]
    ].rename(columns={"score": "currentScore", "tier": "currentTier"})
    prior = latest_risk(datasets, prior_date)[
        ["businessId", "score"]
    ].rename(columns={"score": "priorScore"})

    merged = current.merge(prior, on="businessId", how="left")
    merged["scoreChange"] = (merged["currentScore"] - merged["priorScore"]).round(1)
    merged["direction"] = merged["scoreChange"].map(
        lambda value: "increase" if pd.notna(value) and value > 0 else (
            "decrease" if pd.notna(value) and value < 0 else "flat"
        )
    )
    return (
        merged.sort_values("scoreChange", ascending=False)
        .head(max(1, limit))
        .reset_index(drop=True)
    )


def district_risk(
    datasets: Datasets, as_of: str | pd.Timestamp | None = None
) -> pd.DataFrame:
    """Premises, high-risk share and average score by district."""

    frame = latest_risk(datasets, as_of)
    if frame.empty:
        return pd.DataFrame(
            columns=[
                "district",
                "premises",
                "highRisk",
                "highRiskSharePercent",
                "averageRiskScore",
            ]
        )
    grouped = frame.groupby("district", as_index=False).agg(
        premises=("businessId", "count"),
        highRisk=("tier", lambda tiers: int(tiers.isin(["C", "D"]).sum())),
        averageRiskScore=("score", "mean"),
    )
    grouped["highRiskSharePercent"] = (
        grouped["highRisk"] / grouped["premises"] * 100
    ).round(1)
    grouped["averageRiskScore"] = grouped["averageRiskScore"].round(1)
    return grouped.sort_values(
        ["highRisk", "premises"], ascending=[False, False]
    ).reset_index(drop=True)


def score_history(datasets: Datasets, as_of: str | pd.Timestamp | None = None) -> pd.DataFrame:
    """Monthly mean and maximum snapshot score, for trend validation."""

    current = _as_utc(as_of) if as_of else datasets.generated_at
    snapshots = datasets.snapshots[
        datasets.snapshots["snapshotAt"].notna()
        & (datasets.snapshots["snapshotAt"] <= current)
    ].copy()
    snapshots["month"] = snapshots["snapshotAt"].dt.strftime("%Y-%m")
    grouped = snapshots.groupby("month", as_index=False).agg(
        ratedBusinesses=("businessId", "nunique"),
        averageScore=("score", "mean"),
        highestScore=("score", "max"),
    )
    grouped["averageScore"] = grouped["averageScore"].round(1)
    return grouped
