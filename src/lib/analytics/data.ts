import type { Prisma } from "@prisma/client";
import { db } from "../db";
import { parseAnalyticsFilters, resolvePeriod } from "./filters";
import type {
  AnalyticsDataset,
  AnalyticsSearchParams,
  BusinessAnalyticsRecord,
  BusinessComplaintRecord,
  BusinessInspectionRecord,
  RiskSnapshotRecord,
} from "./types";

function asFactorRecord(value: Prisma.JsonValue): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === "number" && Number.isFinite(raw)) out[key] = raw;
  }
  return out;
}

/**
 * Load the analytics universe for the requested filters.
 *
 * The district filter is deliberately applied in the KPI layer rather than in
 * SQL so the district comparison table can keep peer districts visible while
 * the selected district is being inspected. Category and risk-tier filters do
 * change the business universe because they define which premises are in scope.
 *
 * Only aggregate figures are returned to the browser by callers; this loader
 * runs on the server.
 */
export async function loadAnalyticsDataset(
  params: AnalyticsSearchParams,
  now: Date = new Date()
): Promise<AnalyticsDataset> {
  const filters = parseAnalyticsFilters(params);
  const period = resolvePeriod(filters, now);

  const businessWhere: Prisma.BusinessWhereInput = {};
  if (filters.category) businessWhere.category = filters.category;
  if (filters.riskTier) businessWhere.riskTier = filters.riskTier;

  const [businessRows, allBusinesses, typeRows, officers] = await Promise.all([
    db.business.findMany({
      where: businessWhere,
      select: {
        id: true,
        name: true,
        category: true,
        district: true,
        licenseNumber: true,
        status: true,
        riskScore: true,
        riskTier: true,
        registeredAt: true,
      },
      orderBy: { name: "asc" },
    }),
    db.business.findMany({ select: { district: true, category: true } }),
    db.complaint.findMany({
      where: { type: { not: null } },
      distinct: ["type"],
      select: { type: true },
    }),
    db.user.findMany({
      where: { role: "food_officer" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const businesses: BusinessAnalyticsRecord[] = businessRows;
  const businessIds = businesses.map((b) => b.id);

  const complaintWhere: Prisma.ComplaintWhereInput = {};
  if (filters.category || filters.riskTier) {
    // Unattached complaints cannot be attributed to a category or risk tier.
    complaintWhere.businessId = { in: businessIds };
  } else {
    complaintWhere.OR = [
      { businessId: { in: businessIds } },
      { businessId: null },
    ];
  }
  if (filters.complaintStatus) complaintWhere.status = filters.complaintStatus;

  const inspectionWhere: Prisma.InspectionWhereInput = {
    businessId: { in: businessIds },
  };
  if (filters.inspectionStatus) inspectionWhere.status = filters.inspectionStatus;

  const [complaintRows, inspectionRows, snapshotRows] = await Promise.all([
    db.complaint.findMany({
      where: complaintWhere,
      select: {
        id: true,
        businessId: true,
        status: true,
        assignedOfficerId: true,
        anonymous: true,
        type: true,
        district: true,
        createdAt: true,
        assignedAt: true,
        investigationStartedAt: true,
        inspectionAt: true,
        resolvedAt: true,
        slaDays: true,
        business: {
          select: { id: true, name: true, district: true, category: true, riskTier: true },
        },
        assignedOfficer: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.inspection.findMany({
      where: inspectionWhere,
      select: {
        id: true,
        businessId: true,
        officerId: true,
        status: true,
        scheduledAt: true,
        completedAt: true,
        business: {
          select: { id: true, name: true, district: true, category: true, riskTier: true },
        },
        officer: { select: { id: true, name: true } },
        violations: {
          select: { id: true, type: true, severity: true, description: true },
        },
      },
      orderBy: { scheduledAt: "desc" },
    }),
    db.riskSnapshot.findMany({
      where: { businessId: { in: businessIds } },
      select: {
        id: true,
        businessId: true,
        score: true,
        tier: true,
        factors: true,
        snapshotAt: true,
      },
      orderBy: { snapshotAt: "asc" },
    }),
  ]);

  const complaints: BusinessComplaintRecord[] = complaintRows;
  const inspections: BusinessInspectionRecord[] = inspectionRows;
  const snapshots: RiskSnapshotRecord[] = snapshotRows.map((s) => ({
    id: s.id,
    businessId: s.businessId,
    score: s.score,
    tier: s.tier,
    factors: asFactorRecord(s.factors),
    snapshotAt: s.snapshotAt,
  }));

  const districts = [...new Set(allBusinesses.map((b) => b.district))].sort((a, b) =>
    a.localeCompare(b)
  );
  const categories = [...new Set(allBusinesses.map((b) => b.category))].sort((a, b) =>
    a.localeCompare(b)
  );
  const complaintTypes = typeRows
    .map((t) => t.type)
    .filter((t): t is string => !!t)
    .sort((a, b) => a.localeCompare(b));

  return {
    filters,
    period,
    generatedAt: now,
    businesses,
    complaints,
    inspections,
    snapshots,
    options: { districts, categories, complaintTypes, officers },
  };
}
