import "./load-env";
import fs from "node:fs/promises";
import path from "node:path";
import type { Prisma } from "@prisma/client";
import { db } from "../src/lib/db";
import { closeDatabase } from "./sql-lib";
import { KPI_DEFINITIONS } from "../src/lib/analytics/kpis";
import { rowsToCsv, type CsvRow } from "../src/lib/analytics/reports";
import { runDataQualityChecks } from "../src/lib/quality";

/**
 * Export denormalised, Power BI-friendly CSV extracts from the live database.
 *
 * Output: public/powerbi/
 * - dim_business.csv
 * - dim_date.csv
 * - dim_officer.csv
 * - fact_inspections.csv
 * - fact_violations.csv
 * - fact_complaints.csv
 * - fact_risk_snapshots.csv
 * - kpi_definitions.csv
 * - data_quality_findings.csv
 * - district_scorecard.csv
 * - dataset_manifest.csv
 *
 * The files are raw snapshots (no dashboard filters) so Power BI owns the
 * filter context. Strings are protected against spreadsheet formula injection
 * by the shared CSV writer.
 */

const OUT_DIR = path.join(process.cwd(), "public", "powerbi");
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function iso(value: Date | null | undefined): string {
  return value ? value.toISOString() : "";
}

function dateOnly(value: Date | null | undefined): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

function daysBetween(from: Date | null, to: Date | null): number | "" {
  if (!from || !to) return "";
  const days = (to.getTime() - from.getTime()) / MS_PER_DAY;
  return days >= 0 ? Number(days.toFixed(2)) : "";
}

function factorRecord(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
  }
  return out;
}

function buildDateDimension(startYear = 2024, endYear = 2027): CsvRow[] {
  const rows: CsvRow[] = [];
  const cursor = new Date(Date.UTC(startYear, 0, 1));
  const end = new Date(Date.UTC(endYear, 11, 31));
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  while (cursor <= end) {
    const date = cursor.toISOString().slice(0, 10);
    const year = cursor.getUTCFullYear();
    const month = cursor.getUTCMonth() + 1;
    const day = cursor.getUTCDate();
    const dayOfWeek = cursor.getUTCDay();
    rows.push([
      date,
      year,
      Math.floor((month - 1) / 3) + 1,
      month,
      monthNames[month - 1],
      monthNames[month - 1].slice(0, 3),
      `${year}-${String(month).padStart(2, "0")}`,
      Math.ceil((day + new Date(Date.UTC(year, month - 1, 1)).getUTCDay()) / 7),
      dayOfWeek,
      dayNames[dayOfWeek],
      dayOfWeek === 0 || dayOfWeek === 6 ? 1 : 0,
    ]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const generatedAt = new Date().toISOString();

  const [businesses, inspections, violations, complaints, snapshots, officers, quality] =
    await Promise.all([
      db.business.findMany({ orderBy: { name: "asc" } }),
      db.inspection.findMany({
        include: { business: true, officer: true, violations: true },
        orderBy: { scheduledAt: "asc" },
      }),
      db.violation.findMany({
        include: { inspection: { include: { business: true, officer: true } } },
        orderBy: { id: "asc" },
      }),
      db.complaint.findMany({
        include: { business: true, assignedOfficer: true },
        orderBy: { createdAt: "asc" },
      }),
      db.riskSnapshot.findMany({
        include: { business: true },
        orderBy: { snapshotAt: "asc" },
      }),
      db.user.findMany({
        where: { role: "food_officer" },
        orderBy: { name: "asc" },
      }),
      runDataQualityChecks(),
    ]);

  const manifest: CsvRow[] = [
    ["file", "grain", "rows", "description", "generatedAt"],
  ];
  const write = async (file: string, rows: CsvRow[], grain: string, description: string) => {
    await fs.writeFile(path.join(OUT_DIR, file), rowsToCsv(rows), "utf8");
    manifest.push([file, grain, rows.length - 1, description, generatedAt]);
    console.log(`${file.padEnd(30)} ${rows.length - 1} rows`);
  };

  // ---- Dimensions ---------------------------------------------------------
  await write(
    "dim_business.csv",
    [
      [
        "businessId",
        "name",
        "category",
        "district",
        "licenseNumber",
        "address",
        "status",
        "riskScore",
        "riskTier",
        "registeredAt",
        "registeredDate",
        "lat",
        "lng",
      ],
      ...businesses.map((b) => [
        b.id,
        b.name,
        b.category,
        b.district,
        b.licenseNumber,
        b.address,
        b.status,
        b.riskScore,
        b.riskTier,
        iso(b.registeredAt),
        dateOnly(b.registeredAt),
        b.lat,
        b.lng,
      ]),
    ],
    "one row per business",
    "Business register with current deterministic risk values."
  );

  await write(
    "dim_date.csv",
    [
      [
        "date",
        "year",
        "quarter",
        "monthNumber",
        "month",
        "monthShort",
        "yearMonth",
        "weekOfMonth",
        "dayOfWeek",
        "dayName",
        "isWeekend",
      ],
      ...buildDateDimension(),
    ],
    "one row per calendar date",
    "2024-01-01 to 2027-12-31 date dimension. Dates are UTC calendar dates."
  );

  await write(
    "dim_officer.csv",
    [
      ["officerId", "name", "district", "role"],
      ...officers.map((officer) => [officer.id, officer.name, officer.district ?? "", officer.role]),
    ],
    "one row per Food Safety Officer",
    "Officer dimension for inspection assignment analysis."
  );

  // ---- Inspection facts ---------------------------------------------------
  await write(
    "fact_inspections.csv",
    [
      [
        "inspectionId",
        "businessId",
        "businessName",
        "district",
        "category",
        "officerId",
        "officerName",
        "status",
        "scheduledAt",
        "scheduledDate",
        "completedAt",
        "completedDate",
        "turnaroundDays",
        "violationCount",
        "criticalViolationCount",
      ],
      ...inspections.map((inspection) => [
        inspection.id,
        inspection.businessId,
        inspection.business.name,
        inspection.business.district,
        inspection.business.category,
        inspection.officerId,
        inspection.officer.name,
        inspection.status,
        iso(inspection.scheduledAt),
        dateOnly(inspection.scheduledAt),
        iso(inspection.completedAt),
        dateOnly(inspection.completedAt),
        daysBetween(inspection.scheduledAt, inspection.completedAt),
        inspection.violations.length,
        inspection.violations.filter((violation) => violation.severity === "critical").length,
      ]),
    ],
    "one row per inspection",
    "Inspection events with planned and completed dates plus finding counts."
  );

  // Repeat flag uses prior completed inspections at the same business, matching
  // the KPI engine's definition (same violation type seen before the event).
  const priorFindings = new Set<string>();
  const repeatByViolation = new Map<string, 0 | 1>();
  const chronological = [...inspections].sort((a, b) => {
    const left = a.completedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const right = b.completedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
    return left - right;
  });
  for (const inspection of chronological) {
    if (!inspection.completedAt) continue;
    for (const violation of inspection.violations) {
      const key = `${inspection.businessId}|${violation.type}`;
      repeatByViolation.set(violation.id, priorFindings.has(key) ? 1 : 0);
      priorFindings.add(key);
    }
  }

  await write(
    "fact_violations.csv",
    [
      [
        "violationId",
        "inspectionId",
        "businessId",
        "businessName",
        "district",
        "category",
        "officerName",
        "completedAt",
        "completedDate",
        "violationType",
        "severity",
        "description",
        "isRepeat",
      ],
      ...violations.map((violation) => {
        const inspection = violation.inspection;
        return [
          violation.id,
          violation.inspectionId,
          inspection.businessId,
          inspection.business.name,
          inspection.business.district,
          inspection.business.category,
          inspection.officer.name,
          iso(inspection.completedAt),
          dateOnly(inspection.completedAt),
          violation.type,
          violation.severity,
          violation.description,
          repeatByViolation.get(violation.id) ?? "",
        ];
      }),
    ],
    "one row per violation finding",
    "Findings linked to inspection completion date. isRepeat = same type previously seen at the business."
  );

  // ---- Complaint facts ----------------------------------------------------
  await write(
    "fact_complaints.csv",
    [
      [
        "complaintId",
        "businessId",
        "businessName",
        "district",
        "complaintType",
        "status",
        "anonymous",
        "hasCitizenLink",
        "createdAt",
        "createdDate",
        "assignedAt",
        "investigationStartedAt",
        "inspectionAt",
        "resolvedAt",
        "resolvedDate",
        "slaDays",
        "resolutionDays",
        "slaWithinTarget",
        "assignedOfficerName",
      ],
      ...complaints.map((complaint) => {
        const validResolution =
          complaint.resolvedAt && complaint.resolvedAt >= complaint.createdAt
            ? complaint.resolvedAt
            : null;
        const resolutionDays = validResolution
          ? Number(((validResolution.getTime() - complaint.createdAt.getTime()) / MS_PER_DAY).toFixed(2))
          : "";
        return [
          complaint.id,
          complaint.businessId ?? "",
          complaint.business?.name ?? "",
          complaint.business?.district ?? complaint.district ?? "",
          complaint.type ?? "unspecified",
          complaint.status,
          complaint.anonymous ? 1 : 0,
          complaint.citizenId ? 1 : 0,
          iso(complaint.createdAt),
          dateOnly(complaint.createdAt),
          iso(complaint.assignedAt),
          iso(complaint.investigationStartedAt),
          iso(complaint.inspectionAt),
          iso(complaint.resolvedAt),
          dateOnly(complaint.resolvedAt),
          complaint.slaDays,
          resolutionDays,
          resolutionDays === "" ? "" : resolutionDays <= complaint.slaDays ? 1 : 0,
          complaint.assignedOfficer?.name ?? "",
        ];
      }),
    ],
    "one row per complaint",
    "Complaint lifecycle facts. resolutionDays and SLA outcome are blank for invalid lifecycles."
  );

  await write(
    "fact_risk_snapshots.csv",
    [
      [
        "snapshotId",
        "businessId",
        "businessName",
        "district",
        "category",
        "score",
        "tier",
        "snapshotAt",
        "snapshotDate",
        "factorViolations",
        "factorComplaints",
        "factorInspectionTimeliness",
        "factorDocuments",
        "factorCategory",
      ],
      ...snapshots.map((snapshot) => {
        const factors = factorRecord(snapshot.factors);
        return [
          snapshot.id,
          snapshot.businessId,
          snapshot.business.name,
          snapshot.business.district,
          snapshot.business.category,
          snapshot.score,
          snapshot.tier,
          iso(snapshot.snapshotAt),
          dateOnly(snapshot.snapshotAt),
          factors.violations ?? 0,
          factors.complaints ?? 0,
          factors.inspectionTimeliness ?? 0,
          factors.documents ?? 0,
          factors.category ?? 0,
        ];
      }),
    ],
    "one row per stored risk snapshot",
    "Point-in-time deterministic risk scores with factor contributions."
  );

  // ---- Definition and quality tables -------------------------------------
  await write(
    "kpi_definitions.csv",
    [
      [
        "kpiId",
        "name",
        "category",
        "measurement",
        "unit",
        "desiredDirection",
        "formula",
        "description",
        "caveat",
      ],
      ...KPI_DEFINITIONS.map((definition) => [
        definition.id,
        definition.name,
        definition.category,
        definition.measurement,
        definition.unit,
        definition.desiredDirection,
        definition.formula,
        definition.description,
        definition.caveat ?? "",
      ]),
    ],
    "one row per KPI definition",
    "Governed KPI catalogue. Use with docs/powerbi/dax_measures.md."
  );

  await write(
    "data_quality_findings.csv",
    [
      [
        "ruleId",
        "rule",
        "category",
        "severity",
        "status",
        "affectedRecords",
        "checkExpression",
        "recommendation",
      ],
      ...quality.findings.map((finding) => [
        finding.rule.id,
        finding.rule.name,
        finding.rule.category,
        finding.rule.severity,
        "Finding",
        finding.count,
        finding.rule.check,
        finding.rule.recommendation,
      ]),
      ...quality.passedRules.map((rule) => [
        rule.id,
        rule.name,
        rule.category,
        rule.severity,
        "Pass",
        0,
        rule.check,
        rule.recommendation,
      ]),
    ],
    "one row per data-quality rule",
    `Current quality score ${quality.score}/100 (${quality.grade}).`
  );

  // District scorecard for the trailing 90 days, useful as a ready-made visual.
  const districtMap = new Map<
    string,
    {
      premises: number;
      highRisk: number;
      scores: number[];
      inspections: number;
      findings: number;
      complaints: number;
      resolved: number;
      overdue: number;
    }
  >();
  const asOf = new Date();
  const windowStart = new Date(asOf.getTime() - 90 * MS_PER_DAY);

  for (const business of businesses) {
    if (business.status === "closed") continue;
    const entry =
      districtMap.get(business.district) ??
      {
        premises: 0,
        highRisk: 0,
        scores: [],
        inspections: 0,
        findings: 0,
        complaints: 0,
        resolved: 0,
        overdue: 0,
      };
    entry.premises += 1;
    if (business.riskTier === "C" || business.riskTier === "D") entry.highRisk += 1;
    entry.scores.push(business.riskScore);
    districtMap.set(business.district, entry);
  }
  for (const inspection of inspections) {
    if (!inspection.completedAt) continue;
    if (inspection.completedAt < windowStart || inspection.completedAt > asOf) continue;
    const entry = districtMap.get(inspection.business.district);
    if (!entry) continue;
    entry.inspections += 1;
    entry.findings += inspection.violations.length;
  }
  for (const complaint of complaints) {
    const district = complaint.business?.district ?? complaint.district;
    if (!district) continue;
    const entry = districtMap.get(district);
    if (!entry) continue;
    if (complaint.createdAt >= windowStart && complaint.createdAt <= asOf) entry.complaints += 1;
    if (
      complaint.resolvedAt &&
      complaint.resolvedAt >= complaint.createdAt &&
      complaint.resolvedAt >= windowStart &&
      complaint.resolvedAt <= asOf
    ) {
      entry.resolved += 1;
    }
    if (
      complaint.createdAt < asOf &&
      (!complaint.resolvedAt || complaint.resolvedAt >= asOf) &&
      complaint.createdAt.getTime() + complaint.slaDays * MS_PER_DAY < asOf.getTime()
    ) {
      entry.overdue += 1;
    }
  }

  await write(
    "district_scorecard.csv",
    [
      [
        "district",
        "asOf",
        "premises",
        "highRiskPremises",
        "averageRiskScore",
        "inspectionsCompletedLast90Days",
        "findingsLast90Days",
        "complaintsReceivedLast90Days",
        "complaintsResolvedLast90Days",
        "overdueOpenComplaints",
      ],
      ...[...districtMap.entries()]
        .sort((a, b) => b[1].premises - a[1].premises)
        .map(([district, entry]) => [
          district,
          asOf.toISOString(),
          entry.premises,
          entry.highRisk,
          Number((entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length).toFixed(1)),
          entry.inspections,
          entry.findings,
          entry.complaints,
          entry.resolved,
          entry.overdue,
        ]),
    ],
    "one row per district",
    "Prepared trailing-90-day district scorecard. Power BI can recompute from facts instead."
  );

  await write(
    "dataset_manifest.csv",
    manifest,
    "one row per exported file",
    "Extract manifest with row counts, grain, descriptions and generation time."
  );

  await fs.writeFile(
    path.join(OUT_DIR, "README.txt"),
    [
      "SafeBite Power BI extracts",
      `Generated: ${generatedAt}`,
      "",
      "These files are synthetic demonstration data, not official government statistics.",
      "Load dim_* tables as dimensions and fact_* tables as facts. See docs/powerbi/ for the",
      "recommended model, relationships and DAX measures.",
      "",
      "Regenerate with: npm run analytics:datasets",
      "Do not commit edited copies of these files back into the database.",
    ].join("\n"),
    "utf8"
  );

  console.log(`\nDataset export complete: ${OUT_DIR}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
