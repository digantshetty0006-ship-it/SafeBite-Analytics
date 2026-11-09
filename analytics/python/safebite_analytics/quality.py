"""Data-quality checks on the exported CSV extracts.

The authoritative quality score is produced by the app's Prisma-level engine
(``src/lib/quality.ts``). This module re-evaluates the rules that can be tested
from the exported facts, so analysts can confirm the extract has not drifted.
Rules whose source tables are not exported are marked **not evaluable** rather
than being silently reported as passing.

Important false-positive control: a complaint is only an anonymity conflict when
it is flagged anonymous **and** has a citizen link. Legitimate anonymous
complaints (no citizen identity) are valid and never flagged.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

import pandas as pd

from .loader import Datasets, risk_band

SEVERITY_PENALTY = {"critical": 6, "high": 4, "medium": 2, "low": 1}

RULES = {
    "C-RES-MISSING": (
        "Resolved complaint without resolution timestamp",
        "Complaints",
        "critical",
    ),
    "C-RES-NEGATIVE": (
        "Resolution before complaint creation",
        "Complaints",
        "critical",
    ),
    "C-TIMELINE": (
        "Complaint lifecycle out of order",
        "Complaints",
        "high",
    ),
    "C-ANON-CONFLICT": (
        "Contradictory anonymity and identity",
        "Complaints",
        "high",
    ),
    "C-TYPE-MISSING": ("Complaint type missing", "Complaints", "medium"),
    "C-SLA-INVALID": ("Invalid complaint SLA target", "Complaints", "medium"),
    "C-STATUS-INVALID": ("Unknown complaint status", "Complaints", "high"),
    "I-DATE-ORDER": (
        "Inspection completed before it was scheduled",
        "Inspections",
        "high",
    ),
    "I-COMPLETE-MISSING": (
        "Completed inspection without completion timestamp",
        "Inspections",
        "critical",
    ),
    "I-STATUS-CONFLICT": (
        "Inspection status conflicts with completion date",
        "Inspections",
        "high",
    ),
    "I-CHECKLIST-EMPTY": (
        "Completed inspection has an empty checklist",
        "Inspections",
        "medium",
    ),
    "B-LICENCE-DUPLICATE": (
        "Duplicate business licence number",
        "Businesses",
        "high",
    ),
    "B-LICENCE-MISSING": ("Business licence number missing", "Businesses", "critical"),
    "B-COORDS-INVALID": (
        "Coordinates outside the operating region",
        "Businesses",
        "medium",
    ),
    "B-RISK-MISMATCH": ("Risk score or tier inconsistent", "Businesses", "high"),
    "B-STATUS-INVALID": ("Unknown business status", "Businesses", "medium"),
    "D-EXPIRY-ORDER": (
        "Document expires before it was uploaded",
        "Documents",
        "critical",
    ),
    "R-SCORE-RANGE": ("Risk snapshot score outside 0–100", "Risk snapshots", "high"),
    "R-TIER-MISMATCH": ("Risk snapshot tier inconsistent", "Risk snapshots", "high"),
    "S-LICENCE-MISSING": ("Supplier licence missing", "Suppliers", "medium"),
}

NOT_EVALUABLE = {
    "I-CHECKLIST-EMPTY": "The checklist JSON is not part of the Power BI extract.",
    "D-EXPIRY-ORDER": "The Document table is not part of the Power BI extract.",
    "S-LICENCE-MISSING": "The Supplier table is not part of the Power BI extract.",
}


@dataclass
class QualityReport:
    generated_at: pd.Timestamp
    findings: list[dict]
    passed: list[str]
    not_evaluable: dict[str, str]
    rules_evaluated: int
    issues: int
    notes: list[str] = field(default_factory=list)

    @property
    def failed_ids(self) -> set[str]:
        return {finding["ruleId"] for finding in self.findings}

    def by_severity(self, severity: str) -> int:
        return sum(1 for finding in self.findings if finding["severity"] == severity)


def _evaluators() -> dict[str, Callable[[Datasets], list[str]]]:
    def complaint_ids(datasets: Datasets, mask: pd.Series) -> list[str]:
        return datasets.complaints.loc[mask, "complaintId"].tolist()

    def inspection_ids(datasets: Datasets, mask: pd.Series) -> list[str]:
        return datasets.inspections.loc[mask, "inspectionId"].tolist()

    def business_ids(datasets: Datasets, mask: pd.Series) -> list[str]:
        return datasets.businesses.loc[mask, "businessId"].tolist()

    def resolved_missing(datasets: Datasets) -> list[str]:
        complaints = datasets.complaints
        return complaint_ids(datasets, (complaints["status"] == "resolved") & complaints["resolvedAt"].isna())

    def resolved_negative(datasets: Datasets) -> list[str]:
        complaints = datasets.complaints
        return complaint_ids(
            datasets,
            complaints["resolvedAt"].notna()
            & complaints["createdAt"].notna()
            & (complaints["resolvedAt"] < complaints["createdAt"]),
        )

    def timeline(datasets: Datasets) -> list[str]:
        stages = ["createdAt", "assignedAt", "investigationStartedAt", "inspectionAt", "resolvedAt"]
        mask = []
        for _, row in datasets.complaints.iterrows():
            values = [row[column] for column in stages if pd.notna(row[column])]
            mask.append(any(later < earlier for earlier, later in zip(values, values[1:])))
        return complaint_ids(datasets, pd.Series(mask, index=datasets.complaints.index))

    def anonymity_conflict(datasets: Datasets) -> list[str]:
        complaints = datasets.complaints
        return complaint_ids(
            datasets,
            (complaints["anonymous"] == 1) & (complaints["hasCitizenLink"] == 1),
        )

    def type_missing(datasets: Datasets) -> list[str]:
        complaints = datasets.complaints
        mask = complaints["complaintType"].isna() | (
            complaints["complaintType"].astype("string").str.strip() == ""
        ) | (complaints["complaintType"] == "unspecified")
        # "unspecified" is surfaced by the exporter for a missing type, so it is
        # the exported representation of the same defect.
        return complaint_ids(datasets, mask)

    def sla_invalid(datasets: Datasets) -> list[str]:
        complaints = datasets.complaints
        return complaint_ids(
            datasets, (complaints["slaDays"] < 1) | (complaints["slaDays"] > 30)
        )

    def status_invalid(datasets: Datasets) -> list[str]:
        complaints = datasets.complaints
        allowed = {"submitted", "under_review", "inspection_scheduled", "resolved"}
        return complaint_ids(datasets, ~complaints["status"].isin(allowed))

    def inspection_date_order(datasets: Datasets) -> list[str]:
        inspections = datasets.inspections
        return inspection_ids(
            datasets,
            inspections["completedAt"].notna()
            & inspections["scheduledAt"].notna()
            & (inspections["completedAt"] < inspections["scheduledAt"]),
        )

    def inspection_complete_missing(datasets: Datasets) -> list[str]:
        inspections = datasets.inspections
        return inspection_ids(
            datasets, (inspections["status"] == "completed") & inspections["completedAt"].isna()
        )

    def inspection_status_conflict(datasets: Datasets) -> list[str]:
        inspections = datasets.inspections
        return inspection_ids(
            datasets,
            inspections["status"].isin(["scheduled", "missed"]) & inspections["completedAt"].notna(),
        )

    def duplicate_licence(datasets: Datasets) -> list[str]:
        businesses = datasets.businesses
        key = businesses["licenseNumber"].fillna("").astype(str).str.strip().str.lower()
        counts = key[key != ""].value_counts()
        duplicates = set(counts[counts > 1].index)
        if not duplicates:
            return []
        mask = key.isin(duplicates)
        return business_ids(datasets, mask)

    def licence_missing(datasets: Datasets) -> list[str]:
        businesses = datasets.businesses
        mask = businesses["licenseNumber"].isna() | (
            businesses["licenseNumber"].astype("string").str.strip() == ""
        )
        return business_ids(datasets, mask)

    def coords_invalid(datasets: Datasets) -> list[str]:
        businesses = datasets.businesses
        lat = pd.to_numeric(businesses["lat"], errors="coerce")
        lng = pd.to_numeric(businesses["lng"], errors="coerce")
        mask = lat.isna() | lng.isna() | ~lat.between(6, 38) | ~lng.between(68, 98)
        return business_ids(datasets, mask)

    def risk_mismatch(datasets: Datasets) -> list[str]:
        businesses = datasets.businesses
        scores = pd.to_numeric(businesses["riskScore"], errors="coerce")
        expected = scores.map(risk_band)
        mask = scores.isna() | ~scores.between(0, 100) | (expected != businesses["riskTier"])
        return business_ids(datasets, mask)

    def business_status_invalid(datasets: Datasets) -> list[str]:
        businesses = datasets.businesses
        return business_ids(datasets, ~businesses["status"].isin(["active", "suspended", "closed"]))

    def snapshot_score_range(datasets: Datasets) -> list[str]:
        snapshots = datasets.snapshots
        scores = pd.to_numeric(snapshots["score"], errors="coerce")
        mask = scores.isna() | ~scores.between(0, 100)
        return snapshots.loc[mask, "snapshotId"].tolist()

    def snapshot_tier_mismatch(datasets: Datasets) -> list[str]:
        snapshots = datasets.snapshots
        scores = pd.to_numeric(snapshots["score"], errors="coerce")
        expected = scores.map(risk_band)
        mask = scores.notna() & (expected != snapshots["tier"])
        return snapshots.loc[mask, "snapshotId"].tolist()

    return {
        "C-RES-MISSING": resolved_missing,
        "C-RES-NEGATIVE": resolved_negative,
        "C-TIMELINE": timeline,
        "C-ANON-CONFLICT": anonymity_conflict,
        "C-TYPE-MISSING": type_missing,
        "C-SLA-INVALID": sla_invalid,
        "C-STATUS-INVALID": status_invalid,
        "I-DATE-ORDER": inspection_date_order,
        "I-COMPLETE-MISSING": inspection_complete_missing,
        "I-STATUS-CONFLICT": inspection_status_conflict,
        "B-LICENCE-DUPLICATE": duplicate_licence,
        "B-LICENCE-MISSING": licence_missing,
        "B-COORDS-INVALID": coords_invalid,
        "B-RISK-MISMATCH": risk_mismatch,
        "B-STATUS-INVALID": business_status_invalid,
        "R-SCORE-RANGE": snapshot_score_range,
        "R-TIER-MISMATCH": snapshot_tier_mismatch,
    }


def evaluate_quality(datasets: Datasets) -> QualityReport:
    """Run every rule that can be evaluated from the extracts."""

    evaluators = _evaluators()
    findings: list[dict] = []
    for rule_id, evaluator in evaluators.items():
        name, category, severity = RULES[rule_id]
        records = evaluator(datasets)
        if records:
            findings.append(
                {
                    "ruleId": rule_id,
                    "rule": name,
                    "category": category,
                    "severity": severity,
                    "affectedRecords": len(records),
                    "sampleIds": records[:10],
                }
            )

    failed = {finding["ruleId"] for finding in findings}
    passed = [
        rule_id
        for rule_id in RULES
        if rule_id not in failed and rule_id not in NOT_EVALUABLE
    ]
    notes = [
        "Anonymous complaints without a citizen link are valid and are not flagged.",
        "Only contradictory anonymity data (anonymous flag plus a citizen identity) is a finding.",
        "Rules that need the checklists, documents or supplier tables are marked not evaluable from the extracts.",
        "The app's Prisma-level engine remains the authoritative quality score.",
    ]
    return QualityReport(
        generated_at=datasets.generated_at,
        findings=sorted(
            findings,
            key=lambda finding: list(SEVERITY_PENALTY).index(finding["severity"]),
        ),
        passed=passed,
        not_evaluable=dict(NOT_EVALUABLE),
        rules_evaluated=len(evaluators),
        issues=sum(finding["affectedRecords"] for finding in findings),
        notes=notes,
    )


def compare_with_export(datasets: Datasets, report: QualityReport) -> pd.DataFrame:
    """Compare extract-level counts with the app's exported findings."""

    exported = datasets.quality_rules.copy()
    exported["exportedCount"] = pd.to_numeric(
        exported["affectedRecords"], errors="coerce"
    ).fillna(0)
    lookup = {
        str(row["ruleId"]): row for _, row in exported.iterrows()
    }

    rows = []
    for rule_id, (name, category, severity) in RULES.items():
        if rule_id in report.not_evaluable:
            status = "Not evaluable"
            python_count = None
            exported_count = (
                int(lookup[rule_id]["exportedCount"]) if rule_id in lookup else None
            )
        else:
            finding = next(
                (item for item in report.findings if item["ruleId"] == rule_id), None
            )
            python_count = finding["affectedRecords"] if finding else 0
            exported_count = (
                int(lookup[rule_id]["exportedCount"]) if rule_id in lookup else None
            )
            status = "Match" if exported_count == python_count else "Mismatch"
        rows.append(
            {
                "ruleId": rule_id,
                "rule": name,
                "category": category,
                "severity": severity,
                "pythonCount": python_count,
                "exportedCount": exported_count,
                "status": status,
            }
        )
    return pd.DataFrame(rows)
