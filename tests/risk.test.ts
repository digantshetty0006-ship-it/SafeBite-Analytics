import test from "node:test";
import assert from "node:assert/strict";
import type { Complaint, Document, Inspection, Violation } from "@prisma/client";
import {
  calculateRiskScore,
  RISK_WEIGHTS,
  scoreToTier,
} from "../src/lib/risk";

const AS_OF = new Date("2026-11-08T00:00:00.000Z");

function violation(overrides: Partial<Violation> = {}): Violation {
  return {
    id: "v1",
    inspectionId: "i1",
    type: "pest_control",
    severity: "critical",
    description: "Pest activity",
    ...overrides,
  };
}

function inspection(
  overrides: Partial<Inspection> & { violations?: Violation[] } = {}
): Inspection & { violations?: Violation[] } {
  return {
    id: "i1",
    businessId: "b1",
    officerId: "o1",
    scheduledAt: new Date("2026-10-01T00:00:00.000Z"),
    completedAt: new Date("2026-10-02T00:00:00.000Z"),
    checklist: [],
    notes: null,
    photos: "[]",
    aiSummary: null,
    riskDelta: null,
    status: "completed",
    ...overrides,
  } as Inspection & { violations?: Violation[] };
}

function complaint(overrides: Partial<Complaint> = {}): Complaint {
  return {
    id: "c1",
    businessId: "b1",
    citizenId: null,
    assignedOfficerId: null,
    anonymous: false,
    description: "Test complaint",
    type: "hygiene",
    photos: "[]",
    status: "submitted",
    createdAt: new Date("2026-10-20T00:00:00.000Z"),
    assignedAt: null,
    investigationStartedAt: null,
    inspectionAt: null,
    resolvedAt: null,
    slaDays: 7,
    lat: null,
    lng: null,
    address: null,
    district: null,
    aiAnalysis: null,
    ...overrides,
  } as Complaint;
}

function document(overrides: Partial<Document> = {}): Document {
  return {
    id: "d1",
    businessId: "b1",
    type: "licence",
    fileUrl: "/licence.pdf",
    uploadedAt: new Date("2026-01-01T00:00:00.000Z"),
    expiresAt: new Date("2027-01-01T00:00:00.000Z"),
    ...overrides,
  } as Document;
}

test("tier bands match the documented policy thresholds", () => {
  assert.equal(scoreToTier(0), "A");
  assert.equal(scoreToTier(25), "A");
  assert.equal(scoreToTier(25.1), "B");
  assert.equal(scoreToTier(50), "B");
  assert.equal(scoreToTier(50.1), "C");
  assert.equal(scoreToTier(75), "C");
  assert.equal(scoreToTier(75.1), "D");
  assert.equal(scoreToTier(100), "D");
});

test("factor weights total 100 points", () => {
  const total = Object.values(RISK_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(total, 100);
  assert.deepEqual(RISK_WEIGHTS, {
    violations: 40,
    complaints: 25,
    inspectionTimeliness: 15,
    documents: 10,
    category: 10,
  });
});

test("a business with no history receives timeliness and category risk only", () => {
  const result = calculateRiskScore({ category: "restaurant" }, AS_OF);
  assert.equal(result.factors.inspectionTimeliness, 15);
  assert.equal(result.factors.category, 6);
  assert.equal(result.factors.documents, 4);
  assert.equal(result.factors.violations, 0);
  assert.equal(result.factors.complaints, 0);
  assert.equal(result.score, 25);
  assert.equal(result.tier, "A");
  assert.ok(result.explainers.some((line) => line.includes("never been inspected")));
});

test("scoring is reproducible for the same asOf and input", () => {
  const input = {
    category: "street_vendor",
    inspections: [inspection({ violations: [violation()] })],
    complaints: [complaint()],
    documents: [document()],
  };
  const first = calculateRiskScore(input, AS_OF);
  const second = calculateRiskScore(input, AS_OF);
  assert.deepEqual(first, second);
  assert.equal(first.asOf, AS_OF.toISOString());
});

test("violations decay with age and are capped at the factor budget", () => {
  const recent = calculateRiskScore(
    {
      category: "restaurant",
      inspections: [
        inspection({
          completedAt: new Date("2026-11-01T00:00:00.000Z"),
          violations: [violation({ severity: "critical" })],
        }),
      ],
    },
    AS_OF
  );
  const old = calculateRiskScore(
    {
      category: "restaurant",
      inspections: [
        inspection({
          completedAt: new Date("2025-11-01T00:00:00.000Z"),
          violations: [violation({ severity: "critical" })],
        }),
      ],
    },
    AS_OF
  );
  assert.ok(recent.factors.violations > old.factors.violations);

  const many = calculateRiskScore(
    {
      category: "restaurant",
      inspections: [
        inspection({
          completedAt: new Date("2026-11-01T00:00:00.000Z"),
          violations: Array.from({ length: 12 }, (_, index) =>
            violation({ id: `v${index}`, type: `type-${index}` })
          ),
        }),
      ],
    },
    AS_OF
  );
  assert.equal(many.factors.violations, 40);
});

test("complaints outside the 90-day window are ignored and the factor is capped", () => {
  const old = calculateRiskScore(
    {
      category: "restaurant",
      complaints: [
        complaint({ createdAt: new Date("2026-01-01T00:00:00.000Z") }),
      ],
    },
    AS_OF
  );
  assert.equal(old.factors.complaints, 0);

  const recent = calculateRiskScore(
    {
      category: "restaurant",
      complaints: [
        complaint({ id: "c1", status: "submitted" }),
        complaint({ id: "c2", status: "under_review" }),
      ],
    },
    AS_OF
  );
  assert.equal(recent.factors.complaints, 11);

  const many = calculateRiskScore(
    {
      category: "restaurant",
      complaints: Array.from({ length: 10 }, (_, index) =>
        complaint({ id: `c${index}`, status: "resolved" })
      ),
    },
    AS_OF
  );
  assert.equal(many.factors.complaints, 25);
});

test("expired documents add points and the factor is capped", () => {
  const valid = calculateRiskScore(
    { category: "restaurant", documents: [document()] },
    AS_OF
  );
  assert.equal(valid.factors.documents, 0);

  const expired = calculateRiskScore(
    {
      category: "restaurant",
      documents: [
        document({ id: "d1", expiresAt: new Date("2026-10-01T00:00:00.000Z") }),
        document({ id: "d2", expiresAt: new Date("2026-10-02T00:00:00.000Z") }),
        document({ id: "d3", expiresAt: new Date("2026-10-03T00:00:00.000Z") }),
      ],
    },
    AS_OF
  );
  assert.equal(expired.factors.documents, 10);

  const missing = calculateRiskScore({ category: "restaurant" }, AS_OF);
  assert.equal(missing.factors.documents, 4);
});

test("inspection timeliness penalises gaps and rewards a scheduled follow-up", () => {
  const stale = calculateRiskScore(
    {
      category: "restaurant",
      inspections: [
        inspection({ completedAt: new Date("2025-11-08T00:00:00.000Z") }),
      ],
    },
    AS_OF
  );
  assert.equal(stale.factors.inspectionTimeliness, 15);

  const followUp = calculateRiskScore(
    {
      category: "restaurant",
      inspections: [
        inspection({ completedAt: new Date("2025-11-08T00:00:00.000Z") }),
        inspection({
          id: "i2",
          status: "scheduled",
          completedAt: null,
          scheduledAt: new Date("2026-12-01T00:00:00.000Z"),
        }),
      ],
    },
    AS_OF
  );
  assert.equal(followUp.factors.inspectionTimeliness, 11);
  assert.ok(followUp.explainers.some((line) => line.includes("-4 point mitigation")));
});

test("category baselines are policy weights, never learned coefficients", () => {
  const vendor = calculateRiskScore({ category: "street_vendor" }, AS_OF);
  const retail = calculateRiskScore({ category: "packaged_retail" }, AS_OF);
  assert.equal(vendor.factors.category, 9);
  assert.equal(retail.factors.category, 3);
  assert.ok(vendor.factors.category < RISK_WEIGHTS.category);
});
