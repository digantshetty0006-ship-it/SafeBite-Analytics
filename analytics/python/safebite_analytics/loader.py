"""CSV loader and shared helpers for the SafeBite analytics toolkit.

The toolkit reads the Power BI extracts in ``public/powerbi`` by default. Run
``npm run analytics:datasets`` before using it so the files match the database.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import pandas as pd

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[3] / "public" / "powerbi"

BUSINESS_COLUMNS = [
    "businessId",
    "name",
    "category",
    "district",
    "licenseNumber",
    "status",
    "riskScore",
    "riskTier",
    "registeredAt",
]

INSPECTION_COLUMNS = [
    "inspectionId",
    "businessId",
    "district",
    "status",
    "scheduledAt",
    "completedAt",
    "turnaroundDays",
]

VIOLATION_COLUMNS = [
    "violationId",
    "inspectionId",
    "businessId",
    "district",
    "severity",
    "violationType",
    "isRepeat",
    "completedAt",
]

COMPLAINT_COLUMNS = [
    "complaintId",
    "businessId",
    "district",
    "complaintType",
    "status",
    "anonymous",
    "hasCitizenLink",
    "createdAt",
    "assignedAt",
    "investigationStartedAt",
    "inspectionAt",
    "resolvedAt",
    "slaDays",
    "resolutionDays",
    "slaWithinTarget",
]

SNAPSHOT_COLUMNS = [
    "snapshotId",
    "businessId",
    "district",
    "score",
    "tier",
    "snapshotAt",
    "factorViolations",
    "factorComplaints",
    "factorInspectionTimeliness",
    "factorDocuments",
    "factorCategory",
]

FACTOR_COLUMNS = [
    "factorViolations",
    "factorComplaints",
    "factorInspectionTimeliness",
    "factorDocuments",
    "factorCategory",
]

RISK_WEIGHTS = {
    "factorViolations": 40,
    "factorComplaints": 25,
    "factorInspectionTimeliness": 15,
    "factorDocuments": 10,
    "factorCategory": 10,
}

RISK_FACTOR_LABELS = {
    "factorViolations": "Previous violations",
    "factorComplaints": "Recent complaints",
    "factorInspectionTimeliness": "Inspection delays",
    "factorDocuments": "Document compliance",
    "factorCategory": "Business category baseline",
}

RISK_TIER_LABELS = {
    "A": "Low risk",
    "B": "Moderate risk",
    "C": "High risk",
    "D": "Critical risk",
}


@dataclass(frozen=True)
class Datasets:
    """Loaded CSV extracts plus the rules catalogue exported by the app."""

    businesses: pd.DataFrame
    inspections: pd.DataFrame
    violations: pd.DataFrame
    complaints: pd.DataFrame
    snapshots: pd.DataFrame
    quality_rules: pd.DataFrame
    manifest: pd.DataFrame
    data_dir: Path
    generated_at: pd.Timestamp


def _read_required(path: Path, required: list[str]) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(
            f"Missing {path}. Run `npm run analytics:datasets` from the repository root first."
        )
    frame = pd.read_csv(path)
    missing = [column for column in required if column not in frame.columns]
    if missing:
        raise ValueError(f"{path.name} is missing required columns: {', '.join(missing)}")
    return frame


def _to_datetime(frame: pd.DataFrame, columns: list[str]) -> None:
    for column in columns:
        if column in frame.columns:
            frame[column] = pd.to_datetime(frame[column], errors="coerce", utc=True)


def _to_number(frame: pd.DataFrame, columns: list[str]) -> None:
    for column in columns:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")


def load_datasets(data_dir: str | Path | None = None) -> Datasets:
    """Load and type the exported CSVs.

    Parameters
    ----------
    data_dir:
        Directory containing the ``dim_*`` / ``fact_*`` files. Defaults to
        ``public/powerbi`` next to the repository root.
    """

    directory = Path(data_dir) if data_dir else DEFAULT_DATA_DIR

    businesses = _read_required(directory / "dim_business.csv", BUSINESS_COLUMNS)
    inspections = _read_required(directory / "fact_inspections.csv", INSPECTION_COLUMNS)
    violations = _read_required(directory / "fact_violations.csv", VIOLATION_COLUMNS)
    complaints = _read_required(directory / "fact_complaints.csv", COMPLAINT_COLUMNS)
    snapshots = _read_required(directory / "fact_risk_snapshots.csv", SNAPSHOT_COLUMNS)
    quality_rules = _read_required(
        directory / "data_quality_findings.csv",
        ["ruleId", "rule", "category", "severity", "status", "affectedRecords"],
    )
    manifest = _read_required(
        directory / "dataset_manifest.csv", ["file", "grain", "rows", "description"]
    )

    _to_datetime(
        businesses,
        ["registeredAt", "registeredDate"],
    )
    _to_number(
        businesses,
        ["riskScore", "lat", "lng"],
    )
    for column in ["licenseNumber", "category", "district", "status", "riskTier"]:
        businesses[column] = businesses[column].astype("string")

    _to_datetime(
        inspections,
        ["scheduledAt", "completedAt", "scheduledDate", "completedDate"],
    )
    _to_number(inspections, ["turnaroundDays", "violationCount", "criticalViolationCount"])

    _to_datetime(violations, ["completedAt", "completedDate"])
    _to_number(violations, ["isRepeat"])

    _to_datetime(
        complaints,
        [
            "createdAt",
            "createdDate",
            "assignedAt",
            "investigationStartedAt",
            "inspectionAt",
            "resolvedAt",
            "resolvedDate",
        ],
    )
    _to_number(
        complaints,
        ["anonymous", "hasCitizenLink", "slaDays", "resolutionDays", "slaWithinTarget"],
    )

    _to_datetime(snapshots, ["snapshotAt", "snapshotDate"])
    _to_number(snapshots, ["score", *FACTOR_COLUMNS])

    _to_number(quality_rules, ["affectedRecords"])

    # The manifest records one export timestamp per file. Use the latest one so
    # "as of now" is the moment the extract was written, not when Python ran.
    manifest["generatedAt"] = pd.to_datetime(manifest.get("generatedAt"), errors="coerce", utc=True)
    generated_at = manifest["generatedAt"].max()
    if pd.isna(generated_at):
        generated_at = snapshots["snapshotAt"].max()
    if pd.isna(generated_at):
        generated_at = pd.Timestamp.now(tz="UTC")

    return Datasets(
        businesses=businesses,
        inspections=inspections,
        violations=violations,
        complaints=complaints,
        snapshots=snapshots,
        quality_rules=quality_rules,
        manifest=manifest,
        data_dir=directory,
        generated_at=pd.Timestamp(generated_at),
    )


def risk_band(score: float | int | None) -> str | None:
    """Map a deterministic score to the policy tier bands used by the app."""

    if score is None or pd.isna(score):
        return None
    if score <= 25:
        return "A"
    if score <= 50:
        return "B"
    if score <= 75:
        return "C"
    return "D"


def latest_snapshots(datasets: Datasets, as_of: pd.Timestamp) -> pd.DataFrame:
    """Latest snapshot per business at or before ``as_of``.

    Returns snapshot columns plus business name, district, category and status.
    Businesses with no snapshot at or before the date are absent rather than
    back-filled from the current register.
    """

    as_of = pd.Timestamp(as_of)
    if as_of.tzinfo is None:
        as_of = as_of.tz_localize("UTC")
    eligible = datasets.snapshots[datasets.snapshots["snapshotAt"] <= as_of].sort_values(
        "snapshotAt"
    )
    latest = eligible.groupby("businessId", as_index=False).tail(1)
    business_fields = datasets.businesses[
        ["businessId", "name", "district", "category", "status", "riskScore", "riskTier"]
    ].rename(columns={"district": "businessDistrict", "riskScore": "registerRiskScore"})
    return latest.merge(business_fields, on="businessId", how="left", suffixes=("", "_business"))
