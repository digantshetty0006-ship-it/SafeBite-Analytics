import test from "node:test";
import assert from "node:assert/strict";
import { buildAnalyticsView } from "../src/lib/analytics/kpis";
import { parseAnalyticsFilters, resolvePeriod } from "../src/lib/analytics/filters";
import type {
  AnalyticsDataset,
  BusinessAnalyticsRecord,
  BusinessComplaintRecord,
  BusinessInspectionRecord,
  RiskSnapshotRecord,
} from "../src/lib/analytics/types";

function business(
  id: string,
  overrides: Partial<BusinessAnalyticsRecord> = {}
): BusinessAnalyticsRecord {
  return {
    id,
    name: `Business ${id}`,
    category: "restaurant",
    district: "Pune",
    licenseNumber: `LIC-${id}`,
    status: "active",
    riskScore: 20,
    riskTier: "A",
    registeredAt: new Date("2025-12-01T00:00:00.000Z"),
    ...overrides,
  };
}

function inspection(
  id: string,
  businessId: string,
  scheduledAt: string,
  completedAt: string | null,
  violations: { id: string; type: string; severity: string }[] = [],
  status = completedAt ? "completed" : "scheduled"
): BusinessInspectionRecord {
  return {
    id,
    businessId,
    officerId: "o1",
    status,
    scheduledAt: new Date(scheduledAt),
    completedAt: completedAt ? new Date(completedAt) : null,
    business: {
      id: businessId,
      name: `Business ${businessId}`,
      district: "Pune",
      category: "restaurant",
      riskTier: "A",
    },
    officer: { id: "o1", name: "Officer One" },
    violations: violations.map((v) => ({ ...v, description: "Test finding" })),
  };
}

function complaint(
  id: string,
  createdAt: string,
  overrides: Partial<BusinessComplaintRecord> = {}
): BusinessComplaintRecord {
  return {
    id,
    businessId: "b1",
    status: "submitted",
    assignedOfficerId: null,
    anonymous: false,
    type: "hygiene",
    district: "Pune",
    createdAt: new Date(createdAt),
    assignedAt: null,
    investigationStartedAt: null,
    inspectionAt: null,
    resolvedAt: null,
    slaDays: 7,
    business: {
      id: "b1",
      name: "Business b1",
      district: "Pune",
      category: "restaurant",
      riskTier: "A",
    },
    assignedOfficer: null,
    ...overrides,
  };
}

function snapshot(
  id: string,
  businessId: string,
  score: number,
  tier: string,
  snapshotAt: string
): RiskSnapshotRecord {
  return {
    id,
    businessId,
    score,
    tier,
    factors: {
      violations: 0,
      complaints: 0,
      inspectionTimeliness: 0,
      documents: 0,
      category: 0,
    },
    snapshotAt: new Date(snapshotAt),
  };
}

function dataset(): AnalyticsDataset {
  const filters = parseAnalyticsFilters({
    period: "custom",
    from: "2026-01-01",
    to: "2026-01-31",
  });
  const businesses = [
    business("b1", { riskScore: 80, riskTier: "C" }),
    business("b2", { name: "Business b2" }),
    business("b3", {
      name: "Future business",
      riskScore: 90,
      riskTier: "D",
      registeredAt: new Date("2026-02-02T00:00:00.000Z"),
    }),
  ];
  const inspections = [
    inspection("i0", "b1", "2025-12-10T06:00:00.000Z", "2025-12-20T06:00:00.000Z", [
      { id: "v0", type: "pest_control", severity: "high" },
    ]),
    inspection("i1", "b1", "2026-01-05T06:00:00.000Z", "2026-01-10T06:00:00.000Z", [
      { id: "v1", type: "pest_control", severity: "high" },
      { id: "v2", type: "hygiene", severity: "critical" },
    ]),
    inspection("i2", "b2", "2026-01-10T06:00:00.000Z", "2026-01-15T06:00:00.000Z"),
    inspection("i3", "b2", "2026-01-20T06:00:00.000Z", null),
    inspection("i4", "b2", "2026-02-05T06:00:00.000Z", null),
  ];
  const complaints = [
    complaint("c1", "2026-01-05T06:00:00.000Z", {
      status: "resolved",
      resolvedAt: new Date("2026-01-10T06:00:00.000Z"),
      slaDays: 7,
    }),
    complaint("c2", "2026-01-06T06:00:00.000Z", {
      status: "resolved",
      resolvedAt: new Date("2026-01-08T06:00:00.000Z"),
      slaDays: 2,
    }),
    complaint("c3", "2026-01-07T06:00:00.000Z", {
      status: "resolved",
      resolvedAt: new Date("2026-01-03T06:00:00.000Z"),
      slaDays: 7,
    }),
    complaint("c4", "2026-01-09T06:00:00.000Z", { status: "resolved" }),
    complaint("c5", "2025-12-28T06:00:00.000Z", {
      status: "resolved",
      resolvedAt: new Date("2026-01-05T06:00:00.000Z"),
      slaDays: 7,
    }),
    complaint("c6", "2026-01-20T06:00:00.000Z", { slaDays: 5 }),
    complaint("c7", "2026-01-29T06:00:00.000Z", { slaDays: 5 }),
  ];
  const snapshots = [
    snapshot("s1", "b1", 70, "C", "2025-12-01T00:00:00.000Z"),
    snapshot("s2", "b2", 15, "A", "2025-12-01T00:00:00.000Z"),
    snapshot("s3", "b1", 80, "C", "2026-01-01T00:00:00.000Z"),
    snapshot("s4", "b2", 20, "A", "2026-01-01T00:00:00.000Z"),
    snapshot("s5", "b3", 90, "D", "2026-01-01T00:00:00.000Z"),
  ];

  return {
    filters,
    period: resolvePeriod(filters, new Date("2026-02-01T00:00:00.000Z")),
    generatedAt: new Date("2026-02-01T00:00:00.000Z"),
    businesses,
    complaints,
    inspections,
    snapshots,
    options: {
      districts: ["Pune"],
      categories: ["restaurant"],
      complaintTypes: ["hygiene"],
      officers: [{ id: "o1", name: "Officer One" }],
    },
  };
}

test("the analytics view returns the full governed KPI set", () => {
  const view = buildAnalyticsView(dataset());
  assert.equal(view.kpis.length, 13);
  assert.deepEqual(
    view.kpis.map((kpi) => kpi.definition.id),
    [
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
  );
  assert.equal(view.scope.businesses, 3);
});

test("inspection, violation and repeat metrics use the event window", () => {
  const view = buildAnalyticsView(dataset());
  const kpi = (id: string) => view.kpis.find((item) => item.definition.id === id)!;

  assert.equal(kpi("inspections_completed").value, 2);
  assert.equal(kpi("inspection_completion_rate").value, (2 / 3) * 100);
  assert.equal(kpi("critical_violations").value, 1);
  assert.equal(kpi("violations_per_inspection").value, 1);
  assert.equal(kpi("repeat_violation_rate").value, 50);
});

test("invalid complaint lifecycles are excluded from resolution and SLA metrics", () => {
  const view = buildAnalyticsView(dataset());
  const kpi = (id: string) => view.kpis.find((item) => item.definition.id === id)!;

  assert.equal(kpi("complaints_received").value, 6);
  assert.equal(kpi("complaints_resolved").value, 3);
  assert.equal(kpi("average_resolution_days").value, 5);
  assert.equal(kpi("sla_compliance").value, (2 / 3) * 100);
  assert.equal(kpi("overdue_open_complaints").value, 1);
  assert.ok(view.notes.some((note) => note.includes("impossible or incomplete resolution lifecycle")));
});

test("risk metrics use the latest snapshot on or before the period end", () => {
  const view = buildAnalyticsView(dataset());
  const kpi = (id: string) => view.kpis.find((item) => item.definition.id === id)!;

  assert.equal(kpi("registered_businesses").value, 2);
  assert.equal(kpi("high_risk_premises").value, 1);
  assert.equal(kpi("average_risk_score").value, 50);
  assert.equal(view.tierDistribution.find((slice) => slice.key === "C")?.count, 1);
  assert.equal(view.tierDistribution.find((slice) => slice.key === "A")?.count, 1);
});

test("the view scope counts all registered businesses, not just rated ones", () => {
  const view = buildAnalyticsView(dataset());
  assert.equal(view.scope.businesses, 3);
  assert.deepEqual(view.scope.snapshotCoverage, { rated: 2, total: 2 });
});
