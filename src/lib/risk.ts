import type { Business, Complaint, Document, Inspection, Violation } from "@prisma/client";

export type BusinessWithRelations = Business & {
  inspections?: (Inspection & { violations?: Violation[] })[];
  complaints?: Complaint[];
  documents?: Document[];
};

/**
 * Severity points are intentionally simple and deterministic. They express
 * inspection severity as a risk load, not a probability of harm.
 */
const SEVERITY_WEIGHT: Record<string, number> = {
  critical: 10,
  high: 6,
  medium: 3,
  low: 1,
};

/**
 * Category baselines represent structural handling risk differences.
 * They are policy weights, not coefficients learned from data.
 */
const CATEGORY_BASELINE: Record<string, number> = {
  street_vendor: 9,
  meat_poultry: 8,
  restaurant: 6,
  catering: 6,
  manufacturer: 5,
  bakery: 4,
  warehouse: 4,
  packaged_retail: 3,
};

export const RISK_WEIGHTS = {
  violations: 40,
  complaints: 25,
  inspectionTimeliness: 15,
  documents: 10,
  category: 10,
} as const;

export type RiskFactorKey = keyof typeof RISK_WEIGHTS;

export const RISK_FACTOR_KEYS: RiskFactorKey[] = [
  "violations",
  "complaints",
  "inspectionTimeliness",
  "documents",
  "category",
];

export const RISK_FACTOR_LABELS: Record<RiskFactorKey, string> = {
  violations: "Previous violations",
  complaints: "Recent complaints",
  inspectionTimeliness: "Inspection delays",
  documents: "Document compliance",
  category: "Business category baseline",
};

export const RISK_TIER_LABELS: Record<string, string> = {
  A: "Low risk",
  B: "Moderate risk",
  C: "High risk",
  D: "Critical risk",
};

export interface RiskBreakdown {
  score: number;
  tier: string;
  factors: Record<RiskFactorKey, number>;
  max: typeof RISK_WEIGHTS;
  explainers: string[];
  /** The timestamp used for recency calculations. Makes scoring reproducible. */
  asOf: string;
  /** Unrounded weighted total before the 0-100 clamp. Useful for audit. */
  rawScore: number;
}

/** Decay factor: older violations count for less over a 12 month window. */
function recencyDecay(date: Date, now: Date): number {
  const months = (now.getTime() - date.getTime()) / (30.44 * 24 * 3600 * 1000);
  if (months <= 0) return 1;
  return Math.max(0, Math.pow(0.95, months));
}

export function scoreToTier(score: number): string {
  const clamped = Math.min(100, Math.max(0, score));
  if (clamped <= 25) return "A";
  if (clamped <= 50) return "B";
  if (clamped <= 75) return "C";
  return "D";
}

export function tierForBusiness(score: number): string {
  return scoreToTier(score);
}

function factorViolations(
  inspections: (Inspection & { violations?: Violation[] })[] | undefined,
  explainers: string[],
  now: Date
): number {
  if (!inspections || inspections.length === 0) {
    explainers.push("No inspection history on record.");
    return 0;
  }
  let total = 0;
  let weightSum = 0;
  const byType = new Map<string, { weight: number; severity: string; count: number }>();

  for (const insp of inspections) {
    const inspectedAt = insp.completedAt ?? insp.scheduledAt;
    // Ignore inspections that had not happened at the scoring date so the
    // same function can reproduce historical snapshots.
    if (inspectedAt > now) continue;
    for (const v of insp.violations ?? []) {
      const w = (SEVERITY_WEIGHT[v.severity] ?? 3) * recencyDecay(inspectedAt, now);
      total += w;
      weightSum += w;
      const cur = byType.get(v.type) ?? { weight: 0, severity: v.severity, count: 0 };
      cur.weight += w;
      cur.count += 1;
      byType.set(v.type, cur);
    }
  }
  total = Math.min(total, RISK_WEIGHTS.violations);
  if (total > 0) {
    const worst = [...byType.entries()].sort((a, b) => b[1].weight - a[1].weight)[0];
    const pct = Math.round((total / RISK_WEIGHTS.violations) * 100);
    explainers.push(
      `${worst[1].count}x "${worst[0]}" violation${worst[1].count > 1 ? "s" : ""} (${worst[1].severity}) contributing ~${pct}% of this factor's risk budget.`
    );
    if (weightSum > RISK_WEIGHTS.violations) {
      explainers.push("Violation load exceeds the cap for this factor; the score is capped at 40 points.");
    }
  } else {
    explainers.push("No violations logged across inspections.");
  }
  return Math.round(total * 10) / 10;
}

function factorComplaints(
  complaints: Complaint[] | undefined,
  explainers: string[],
  now: Date
): number {
  if (!complaints || complaints.length === 0) {
    explainers.push("No citizen complaints filed.");
    return 0;
  }
  const windowMs = 90 * 24 * 3600 * 1000;
  const recent = complaints.filter(
    (c) => c.createdAt <= now && now.getTime() - c.createdAt.getTime() <= windowMs
  );
  if (recent.length === 0) {
    explainers.push("No complaints in the 90 days before the scoring date.");
    return 0;
  }
  const substantiated = recent.filter((c) => c.status !== "submitted").length;
  const unsubstantiated = recent.length - substantiated;
  let total = unsubstantiated * 4 + substantiated * 7;
  total = Math.min(total, RISK_WEIGHTS.complaints);
  explainers.push(
    `${recent.length} complaint${recent.length > 1 ? "s" : ""} in the 90 days before the scoring date (${substantiated} substantiated / in review, ${unsubstantiated} new).`
  );
  return Math.round(total * 10) / 10;
}

function factorInspectionTimeliness(
  inspections: (Inspection & { violations?: Violation[] })[] | undefined,
  explainers: string[],
  now: Date
): number {
  const completed = inspections?.filter((i) => i.status === "completed") ?? [];
  const lastCompleted = completed
    .map((i) => i.completedAt ?? i.scheduledAt)
    .filter((d) => d <= now)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  if (!lastCompleted) {
    explainers.push("Business has never been inspected before the scoring date - highest timeliness risk.");
    return RISK_WEIGHTS.inspectionTimeliness;
  }
  const months = (now.getTime() - lastCompleted.getTime()) / (30.44 * 24 * 3600 * 1000);
  let pts = Math.max(0, months - 6) * 2.5;
  pts = Math.min(pts, RISK_WEIGHTS.inspectionTimeliness);
  if (pts > 0) {
    explainers.push(`Last inspection ${months.toFixed(1)} months ago (target: within 6 months).`);
  } else {
    explainers.push("Inspected within the 6 months before the scoring date.");
  }

  const hasUpcoming = (inspections ?? []).some(
    (i) => i.status === "scheduled" && i.scheduledAt > now
  );
  if (hasUpcoming) {
    pts = Math.max(0, pts - 4);
    explainers.push("A follow-up inspection is already scheduled (-4 point mitigation).");
  }
  return Math.round(pts * 10) / 10;
}

function factorDocuments(documents: Document[] | undefined, explainers: string[], now: Date): number {
  const onFile = (documents ?? []).filter((d) => d.uploadedAt <= now);
  if (onFile.length === 0) {
    explainers.push("No compliance documents on file (+4 risk points).");
    return 4;
  }
  const expired = onFile.filter((d) => d.expiresAt && d.expiresAt < now);
  let pts = expired.length * 4;
  pts = Math.min(pts, RISK_WEIGHTS.documents);
  if (expired.length > 0) {
    explainers.push(`${expired.length} expired document${expired.length > 1 ? "s" : ""} (licence / certificate).`);
  } else {
    explainers.push("All compliance documents are valid at the scoring date.");
  }
  return Math.round(pts * 10) / 10;
}

function factorCategory(category: string, explainers: string[]): number {
  const base = CATEGORY_BASELINE[category] ?? 5;
  const reasons: Record<string, string> = {
    street_vendor: "Street vending carries a high baseline handling risk.",
    meat_poultry: "Raw meat handling starts with elevated baseline risk.",
    restaurant: "Restaurants have moderate baseline handling risk.",
  };
  if (reasons[category]) explainers.push(reasons[category]);
  return base;
}

export interface RiskInput extends Partial<Business> {
  inspections?: (Inspection & { violations?: Violation[] })[];
  complaints?: Complaint[];
  documents?: Document[];
}

/**
 * Deterministic, explainable risk score 0-100 (higher = riskier).
 * Weighted factors: violations 40%, complaints 25%, inspection timeliness 15%,
 * document compliance 10%, category baseline 10%.
 *
 * This is a policy-driven rules model, not a trained machine-learning model.
 * `asOf` makes the calculation reproducible for tests and historical snapshots.
 */
export function calculateRiskScore(business: RiskInput, asOf: Date = new Date()): RiskBreakdown {
  const now = new Date(asOf.getTime());
  const explainers: string[] = [];
  const factors: Record<RiskFactorKey, number> = {
    violations: factorViolations(business.inspections, explainers, now),
    complaints: factorComplaints(business.complaints, explainers, now),
    inspectionTimeliness: factorInspectionTimeliness(business.inspections, explainers, now),
    documents: factorDocuments(business.documents, explainers, now),
    category: factorCategory(business.category ?? "restaurant", explainers),
  };
  const rawScore = Math.round(
    (factors.violations +
      factors.complaints +
      factors.inspectionTimeliness +
      factors.documents +
      factors.category) *
      10
  ) / 10;
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));
  return {
    score,
    tier: scoreToTier(score),
    factors,
    max: RISK_WEIGHTS,
    explainers,
    asOf: now.toISOString(),
    rawScore,
  };
}

/** Relative contribution of each factor, useful for explainability tables. */
export function factorContributions(breakdown: RiskBreakdown) {
  return RISK_FACTOR_KEYS.map((key) => ({
    key,
    label: RISK_FACTOR_LABELS[key],
    points: breakdown.factors[key],
    max: breakdown.max[key],
    shareOfTotal: breakdown.score > 0 ? (breakdown.factors[key] / breakdown.score) * 100 : 0,
    utilisation: breakdown.max[key] > 0 ? (breakdown.factors[key] / breakdown.max[key]) * 100 : 0,
  }));
}
