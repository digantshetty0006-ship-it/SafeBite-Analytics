import { db } from "./db";
import { scoreToTier } from "./risk";

export type QualitySeverity = "critical" | "high" | "medium" | "low";
export type QualityCategory =
  | "Complaints"
  | "Inspections"
  | "Businesses"
  | "Documents"
  | "Risk snapshots"
  | "Suppliers";

export interface DataQualityRule {
  id: string;
  name: string;
  description: string;
  category: QualityCategory;
  severity: QualitySeverity;
  recommendation: string;
  /** The check expression, written for non-technical readers. */
  check: string;
}

export interface DataQualityRecord {
  id: string;
  label: string;
  detail: string;
  href?: string;
}

export interface DataQualityFinding {
  rule: DataQualityRule;
  count: number;
  records: DataQualityRecord[];
  truncated: boolean;
}

export interface DataQualityReport {
  generatedAt: Date;
  score: number;
  grade: "Healthy" | "Good" | "Watch" | "Needs attention";
  penalty: number;
  totals: {
    checkedRecords: number;
    rulesEvaluated: number;
    rulesFailed: number;
    rulesPassed: number;
    issues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  findings: DataQualityFinding[];
  passedRules: DataQualityRule[];
  notes: string[];
}

/**
 * A complaint is only an anonymity conflict when it is flagged anonymous *and*
 * carries a citizen identity. Anonymous complaints with no citizen link are
 * legitimate and must never be flagged.
 */
export function isAnonymityConflict(complaint: {
  anonymous: boolean;
  citizenId: string | null;
}): boolean {
  return complaint.anonymous && complaint.citizenId !== null;
}

const RULES: Record<string, DataQualityRule> = {
  "C-RES-MISSING": {
    id: "C-RES-MISSING",
    name: "Resolved complaint without resolution timestamp",
    description:
      "A complaint is marked resolved but has no resolvedAt value, so resolution time and SLA cannot be calculated.",
    category: "Complaints",
    severity: "critical",
    recommendation:
      "Backfill resolvedAt from the case file or revert the status to the last known stage.",
    check: "status = 'resolved' AND resolvedAt IS NULL",
  },
  "C-RES-NEGATIVE": {
    id: "C-RES-NEGATIVE",
    name: "Resolution before complaint creation",
    description: "The resolution timestamp is earlier than the complaint creation timestamp.",
    category: "Complaints",
    severity: "critical",
    recommendation: "Correct the timestamp at source and add a database constraint if possible.",
    check: "resolvedAt < createdAt",
  },
  "C-TIMELINE": {
    id: "C-TIMELINE",
    name: "Complaint lifecycle out of order",
    description:
      "Assignment, investigation, inspection or resolution timestamps are earlier than the preceding stage.",
    category: "Complaints",
    severity: "high",
    recommendation:
      "Enforce stage transitions in the application workflow so each timestamp can only move forward.",
    check: "createdAt ≤ assignedAt ≤ investigationStartedAt ≤ inspectionAt ≤ resolvedAt",
  },
  "C-ANON-CONFLICT": {
    id: "C-ANON-CONFLICT",
    name: "Contradictory anonymity and identity",
    description:
      "A complaint is flagged anonymous but also stores a citizen identity. Legitimate anonymous complaints have no citizen link and are not flagged.",
    category: "Complaints",
    severity: "high",
    recommendation:
      "Remove the citizen link for anonymous cases, or clear the anonymous flag with the reporter's consent.",
    check: "anonymous = true AND citizenId IS NOT NULL",
  },
  "C-TYPE-MISSING": {
    id: "C-TYPE-MISSING",
    name: "Complaint type missing",
    description:
      "The complaint has no category, so it cannot contribute to complaint-type analytics.",
    category: "Complaints",
    severity: "medium",
    recommendation: "Triage the complaint and set a type using the controlled complaint taxonomy.",
    check: "type IS NULL OR TRIM(type) = ''",
  },
  "C-SLA-INVALID": {
    id: "C-SLA-INVALID",
    name: "Invalid complaint SLA target",
    description: "The SLA target is outside the permitted 1–30 calendar-day policy range.",
    category: "Complaints",
    severity: "medium",
    recommendation: "Set the SLA from the approved complaint-type policy table.",
    check: "slaDays < 1 OR slaDays > 30",
  },
  "C-STATUS-INVALID": {
    id: "C-STATUS-INVALID",
    name: "Unknown complaint status",
    description: "The status is not one of the supported workflow states.",
    category: "Complaints",
    severity: "high",
    recommendation: "Migrate the record to a supported status after review.",
    check: "status NOT IN ('submitted','under_review','inspection_scheduled','resolved')",
  },
  "I-DATE-ORDER": {
    id: "I-DATE-ORDER",
    name: "Inspection completed before it was scheduled",
    description:
      "completedAt is earlier than scheduledAt, which is normally impossible and distorts turnaround metrics.",
    category: "Inspections",
    severity: "high",
    recommendation: "Correct the completion date or the original scheduled date after checking field notes.",
    check: "completedAt < scheduledAt",
  },
  "I-COMPLETE-MISSING": {
    id: "I-COMPLETE-MISSING",
    name: "Completed inspection without completion timestamp",
    description: "The inspection status is completed but completedAt is empty.",
    category: "Inspections",
    severity: "critical",
    recommendation: "Recover the completion date from the signed checklist and backfill it.",
    check: "status = 'completed' AND completedAt IS NULL",
  },
  "I-STATUS-CONFLICT": {
    id: "I-STATUS-CONFLICT",
    name: "Inspection status conflicts with completion date",
    description:
      "A scheduled or missed inspection still carries a completion timestamp, so event counts and queue views disagree.",
    category: "Inspections",
    severity: "high",
    recommendation: "Align the status with the completion record after officer confirmation.",
    check: "status IN ('scheduled','missed') AND completedAt IS NOT NULL",
  },
  "I-CHECKLIST-EMPTY": {
    id: "I-CHECKLIST-EMPTY",
    name: "Completed inspection has an empty checklist",
    description:
      "A completed inspection stores no checklist items, reducing auditability of the finding.",
    category: "Inspections",
    severity: "medium",
    recommendation: "Attach the signed checklist or reconstruct it from the inspection record.",
    check: "status = 'completed' AND checklist has zero entries",
  },
  "B-LICENCE-DUPLICATE": {
    id: "B-LICENCE-DUPLICATE",
    name: "Duplicate business licence number",
    description: "The same licence number is attached to more than one business record.",
    category: "Businesses",
    severity: "high",
    recommendation: "Verify the licence against the register and correct or merge the duplicate record.",
    check: "COUNT(licenseNumber) > 1 after trimming and case-folding",
  },
  "B-LICENCE-MISSING": {
    id: "B-LICENCE-MISSING",
    name: "Business licence number missing",
    description: "A business record has an empty licence number.",
    category: "Businesses",
    severity: "critical",
    recommendation: "Obtain and record the FSSAI licence number from the application file.",
    check: "TRIM(licenseNumber) = ''",
  },
  "B-COORDS-INVALID": {
    id: "B-COORDS-INVALID",
    name: "Coordinates outside the operating region",
    description:
      "Latitude or longitude falls outside the India bounding box, which breaks map placement and district joins.",
    category: "Businesses",
    severity: "medium",
    recommendation: "Recapture the premises location or geocode the registered address.",
    check: "lat NOT BETWEEN 6 AND 38 OR lng NOT BETWEEN 68 AND 98",
  },
  "B-RISK-MISMATCH": {
    id: "B-RISK-MISMATCH",
    name: "Risk score or tier inconsistent",
    description:
      "The stored risk score is outside 0–100, or the stored tier does not match the score band.",
    category: "Businesses",
    severity: "high",
    recommendation: "Recalculate risk for the business and persist the engine result.",
    check: "riskScore NOT BETWEEN 0 AND 100 OR riskTier <> tier(riskScore)",
  },
  "B-STATUS-INVALID": {
    id: "B-STATUS-INVALID",
    name: "Unknown business status",
    description: "The business status is not one of the supported register states.",
    category: "Businesses",
    severity: "medium",
    recommendation: "Set the status to active, suspended or closed after review.",
    check: "status NOT IN ('active','suspended','closed')",
  },
  "D-EXPIRY-ORDER": {
    id: "D-EXPIRY-ORDER",
    name: "Document expires before it was uploaded",
    description: "The document expiry date precedes its upload date.",
    category: "Documents",
    severity: "critical",
    recommendation: "Correct the dates from the source document and re-upload if necessary.",
    check: "expiresAt < uploadedAt",
  },
  "R-SCORE-RANGE": {
    id: "R-SCORE-RANGE",
    name: "Risk snapshot score outside 0–100",
    description: "A stored snapshot has an impossible risk score.",
    category: "Risk snapshots",
    severity: "high",
    recommendation: "Recompute the snapshot with the current engine and archive the corrupt row.",
    check: "score NOT BETWEEN 0 AND 100",
  },
  "R-TIER-MISMATCH": {
    id: "R-TIER-MISMATCH",
    name: "Risk snapshot tier inconsistent",
    description: "The snapshot tier does not match the tier band implied by its score.",
    category: "Risk snapshots",
    severity: "high",
    recommendation: "Regenerate the snapshot through the risk service rather than editing it manually.",
    check: "tier <> tier(score)",
  },
  "S-LICENCE-MISSING": {
    id: "S-LICENCE-MISSING",
    name: "Supplier licence missing",
    description:
      "A supplier record has no licence number. This is a supplier-master completeness issue, not a defect in the analytics pipeline.",
    category: "Suppliers",
    severity: "medium",
    recommendation: "Collect the supplier licence and attach it to the supplier master record.",
    check: "licenceNumber IS NULL OR TRIM(licenceNumber) = ''",
  },
};

const SEVERITY_PENALTY: Record<QualitySeverity, number> = {
  critical: 6,
  high: 4,
  medium: 2,
  low: 1,
};

const MAX_RECORDS = 12;

function snippet(id: string): string {
  return `#${id.slice(-6)}`;
}

function makeRecord(
  id: string,
  label: string,
  detail: string,
  href?: string
): DataQualityRecord {
  return { id, label, detail, href };
}

function finalize(
  ruleId: string,
  records: DataQualityRecord[]
): DataQualityFinding | null {
  if (records.length === 0) return null;
  return {
    rule: RULES[ruleId],
    count: records.length,
    records: records.slice(0, MAX_RECORDS),
    truncated: records.length > MAX_RECORDS,
  };
}

export async function runDataQualityChecks(): Promise<DataQualityReport> {
  const [complaints, inspections, businesses, documents, snapshots, suppliers] =
    await Promise.all([
      db.complaint.findMany({
        select: {
          id: true,
          businessId: true,
          citizenId: true,
          anonymous: true,
          status: true,
          type: true,
          createdAt: true,
          assignedAt: true,
          investigationStartedAt: true,
          inspectionAt: true,
          resolvedAt: true,
          slaDays: true,
          business: { select: { name: true } },
        },
      }),
      db.inspection.findMany({
        select: {
          id: true,
          businessId: true,
          status: true,
          scheduledAt: true,
          completedAt: true,
          checklist: true,
          business: { select: { name: true } },
        },
      }),
      db.business.findMany({
        select: {
          id: true,
          name: true,
          licenseNumber: true,
          district: true,
          status: true,
          riskScore: true,
          riskTier: true,
          lat: true,
          lng: true,
        },
      }),
      db.document.findMany({
        select: {
          id: true,
          type: true,
          uploadedAt: true,
          expiresAt: true,
          business: { select: { name: true } },
        },
      }),
      db.riskSnapshot.findMany({
        select: { id: true, score: true, tier: true, business: { select: { name: true } } },
      }),
      db.supplier.findMany({
        select: {
          id: true,
          name: true,
          licenceNumber: true,
          business: { select: { name: true } },
        },
      }),
    ]);

  const findings: (DataQualityFinding | null)[] = [];

  // ---- Complaint rules ----
  findings.push(
    finalize(
      "C-RES-MISSING",
      complaints
        .filter((c) => c.status === "resolved" && !c.resolvedAt)
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            c.business?.name ?? "Unattached complaint",
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "C-RES-NEGATIVE",
      complaints
        .filter((c) => c.resolvedAt && c.resolvedAt < c.createdAt)
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            `${c.business?.name ?? "Unattached"} · resolved ${Math.abs(
              Math.round((c.resolvedAt!.getTime() - c.createdAt.getTime()) / 86_400_000)
            )} day(s) before creation`,
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "C-TIMELINE",
      complaints
        .filter((c) => {
          const stages = [
            c.createdAt,
            c.assignedAt,
            c.investigationStartedAt,
            c.inspectionAt,
            c.resolvedAt,
          ].filter((d): d is Date => !!d);
          for (let i = 1; i < stages.length; i += 1) {
            if (stages[i].getTime() < stages[i - 1].getTime()) return true;
          }
          return false;
        })
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            `${c.business?.name ?? "Unattached"} · lifecycle timestamps are not monotonic`,
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "C-ANON-CONFLICT",
      complaints
        .filter((c) => isAnonymityConflict(c))
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            `${c.business?.name ?? "Unattached"} · anonymous flag with citizen identity linked`,
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "C-TYPE-MISSING",
      complaints
        .filter((c) => !c.type || c.type.trim() === "")
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            c.business?.name ?? "Unattached complaint",
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "C-SLA-INVALID",
      complaints
        .filter((c) => c.slaDays < 1 || c.slaDays > 30)
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            `${c.business?.name ?? "Unattached"} · SLA ${c.slaDays} days`,
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  const complaintStatuses = new Set(["submitted", "under_review", "inspection_scheduled", "resolved"]);
  findings.push(
    finalize(
      "C-STATUS-INVALID",
      complaints
        .filter((c) => !complaintStatuses.has(c.status))
        .map((c) =>
          makeRecord(
            c.id,
            `Complaint ${snippet(c.id)}`,
            `${c.business?.name ?? "Unattached"} · status "${c.status}"`,
            `/officer/complaint/${c.id}`
          )
        )
    )
  );

  // ---- Inspection rules ----
  findings.push(
    finalize(
      "I-DATE-ORDER",
      inspections
        .filter((i) => i.completedAt && i.completedAt < i.scheduledAt)
        .map((i) =>
          makeRecord(
            i.id,
            `Inspection ${snippet(i.id)}`,
            `${i.business.name} · completed before its scheduled date`,
            `/officer/inspection/${i.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "I-COMPLETE-MISSING",
      inspections
        .filter((i) => i.status === "completed" && !i.completedAt)
        .map((i) =>
          makeRecord(
            i.id,
            `Inspection ${snippet(i.id)}`,
            `${i.business.name} · completed status without completion date`,
            `/officer/inspection/${i.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "I-STATUS-CONFLICT",
      inspections
        .filter((i) => (i.status === "scheduled" || i.status === "missed") && !!i.completedAt)
        .map((i) =>
          makeRecord(
            i.id,
            `Inspection ${snippet(i.id)}`,
            `${i.business.name} · status ${i.status} but completion date is set`,
            `/officer/inspection/${i.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "I-CHECKLIST-EMPTY",
      inspections
        .filter(
          (i) =>
            i.status === "completed" &&
            (!Array.isArray(i.checklist) || (i.checklist as unknown[]).length === 0)
        )
        .map((i) =>
          makeRecord(
            i.id,
            `Inspection ${snippet(i.id)}`,
            `${i.business.name} · empty checklist`,
            `/officer/inspection/${i.id}`
          )
        )
    )
  );

  // ---- Business rules ----
  const licenceGroups = new Map<string, typeof businesses>();
  for (const b of businesses) {
    const key = b.licenseNumber.trim().toLowerCase();
    if (!key) continue;
    const group = licenceGroups.get(key) ?? [];
    group.push(b);
    licenceGroups.set(key, group);
  }
  const duplicateLicenceRecords: DataQualityRecord[] = [];
  for (const [licence, group] of licenceGroups) {
    if (group.length < 2) continue;
    for (const b of group) {
      duplicateLicenceRecords.push(
        makeRecord(
          b.id,
          b.name,
          `${b.district} · licence ${licence} shared by ${group.length} businesses`,
          `/officer/business/${b.id}`
        )
      );
    }
  }
  findings.push(finalize("B-LICENCE-DUPLICATE", duplicateLicenceRecords));

  findings.push(
    finalize(
      "B-LICENCE-MISSING",
      businesses
        .filter((b) => b.licenseNumber.trim() === "")
        .map((b) =>
          makeRecord(b.id, b.name, `${b.district} · licence number empty`, `/officer/business/${b.id}`)
        )
    )
  );

  findings.push(
    finalize(
      "B-COORDS-INVALID",
      businesses
        .filter(
          (b) =>
            !Number.isFinite(b.lat) ||
            !Number.isFinite(b.lng) ||
            b.lat < 6 ||
            b.lat > 38 ||
            b.lng < 68 ||
            b.lng > 98
        )
        .map((b) =>
          makeRecord(
            b.id,
            b.name,
            `${b.district} · coordinates ${b.lat.toFixed(3)}, ${b.lng.toFixed(3)}`,
            `/officer/business/${b.id}`
          )
        )
    )
  );

  findings.push(
    finalize(
      "B-RISK-MISMATCH",
      businesses
        .filter(
          (b) =>
            !Number.isFinite(b.riskScore) ||
            b.riskScore < 0 ||
            b.riskScore > 100 ||
            scoreToTier(b.riskScore) !== b.riskTier
        )
        .map((b) =>
          makeRecord(
            b.id,
            b.name,
            `${b.district} · score ${b.riskScore}, tier ${b.riskTier}`,
            `/officer/business/${b.id}`
          )
        )
    )
  );

  const businessStatuses = new Set(["active", "suspended", "closed"]);
  findings.push(
    finalize(
      "B-STATUS-INVALID",
      businesses
        .filter((b) => !businessStatuses.has(b.status))
        .map((b) =>
          makeRecord(
            b.id,
            b.name,
            `${b.district} · status "${b.status}"`,
            `/officer/business/${b.id}`
          )
        )
    )
  );

  // ---- Document rules ----
  findings.push(
    finalize(
      "D-EXPIRY-ORDER",
      documents
        .filter((d) => d.expiresAt && d.expiresAt < d.uploadedAt)
        .map((d) =>
          makeRecord(
            d.id,
            `${d.type.replace(/_/g, " ")} · ${d.business.name}`,
            "expiry date earlier than upload date"
          )
        )
    )
  );

  // ---- Risk snapshot rules ----
  findings.push(
    finalize(
      "R-SCORE-RANGE",
      snapshots
        .filter((s) => !Number.isFinite(s.score) || s.score < 0 || s.score > 100)
        .map((s) => makeRecord(s.id, `Snapshot ${snippet(s.id)}`, s.business.name))
    )
  );

  findings.push(
    finalize(
      "R-TIER-MISMATCH",
      snapshots
        .filter((s) => scoreToTier(s.score) !== s.tier)
        .map((s) =>
          makeRecord(
            s.id,
            `Snapshot ${snippet(s.id)}`,
            `${s.business.name} · score ${s.score}, tier ${s.tier}`
          )
        )
    )
  );

  // ---- Supplier master completeness ----
  findings.push(
    finalize(
      "S-LICENCE-MISSING",
      suppliers
        .filter((s) => !s.licenceNumber || s.licenceNumber.trim() === "")
        .map((s) => makeRecord(s.id, s.name, `${s.business.name} · supplier licence missing`))
    )
  );

  const failed = findings.filter((f): f is DataQualityFinding => f !== null);
  const failedIds = new Set(failed.map((f) => f.rule.id));
  const passedRules = Object.values(RULES).filter((r) => !failedIds.has(r.id));

  const penalty = Math.min(
    100,
    failed.reduce((sum, finding) => sum + SEVERITY_PENALTY[finding.rule.severity], 0)
  );
  const score = Math.max(0, 100 - penalty);
  const grade: DataQualityReport["grade"] =
    score >= 95 ? "Healthy" : score >= 85 ? "Good" : score >= 70 ? "Watch" : "Needs attention";

  const severityCount = (severity: QualitySeverity) =>
    failed.filter((f) => f.rule.severity === severity).length;

  const notes: string[] = [
    "Anonymous complaints without a citizen identity are valid and are not flagged. Only contradictory anonymity data is a finding.",
    "Expired compliance documents are a regulatory follow-up, not a data-quality defect, so they are excluded from this score.",
    "The score deducts 6 points per critical rule, 4 per high, 2 per medium and 1 per low-severity rule that fails. Rules pass or fail once, regardless of how many records they affect.",
    "This workspace evaluates the full dataset, not the selected reporting period, so quality issues are not hidden by a narrow date filter.",
  ];
  if (failed.some((f) => f.rule.category === "Suppliers")) {
    notes.push(
      "Supplier licence gaps are shown for completeness but reflect supplier-master follow-up rather than an analytics calculation error."
    );
  }

  return {
    generatedAt: new Date(),
    score,
    grade,
    penalty,
    totals: {
      checkedRecords:
        complaints.length +
        inspections.length +
        businesses.length +
        documents.length +
        snapshots.length +
        suppliers.length,
      rulesEvaluated: Object.keys(RULES).length,
      rulesFailed: failed.length,
      rulesPassed: passedRules.length,
      issues: failed.reduce((sum, f) => sum + f.count, 0),
      critical: severityCount("critical"),
      high: severityCount("high"),
      medium: severityCount("medium"),
      low: severityCount("low"),
    },
    findings: failed.sort((a, b) => {
      const order: Record<QualitySeverity, number> = { critical: 0, high: 1, medium: 2, low: 3 };
      return order[a.rule.severity] - order[b.rule.severity];
    }),
    passedRules,
    notes,
  };
}

export const DATA_QUALITY_RULES = RULES;
