import {
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  RISK_TIER_LABELS,
  RISK_WEIGHTS,
  type RiskFactorKey,
} from "../risk";
import {
  addDays,
  addMonths,
  average,
  formatIstDate,
  istWeekStart,
  pct,
  startOfIstDay,
  startOfIstMonth,
} from "./filters";
import type {
  AnalyticsDataset,
  BusinessAnalyticsRecord,
  BusinessComplaintRecord,
  BusinessInspectionRecord,
  RiskSnapshotRecord,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export type KpiUnit = "count" | "percent" | "days" | "score" | "rate";
export type KpiCategory = "Premises" | "Inspections" | "Complaints" | "Risk";
export type DesiredDirection = "up" | "down" | "neutral";

export interface KpiDefinition {
  id: string;
  name: string;
  shortName: string;
  category: KpiCategory;
  description: string;
  formula: string;
  unit: KpiUnit;
  measurement: "event" | "snapshot";
  desiredDirection: DesiredDirection;
  caveat?: string;
}

export const KPI_DEFINITIONS: KpiDefinition[] = [
  {
    id: "registered_businesses",
    name: "Registered businesses",
    shortName: "Registered",
    category: "Premises",
    description:
      "Food businesses on the register at the end of the selected period, excluding closed premises.",
    formula: "COUNT(businesses WHERE registeredAt < period end AND status <> 'closed')",
    unit: "count",
    measurement: "snapshot",
    desiredDirection: "neutral",
    caveat: "Current register status is applied to historical dates; status history is not tracked.",
  },
  {
    id: "high_risk_premises",
    name: "High-risk premises (C + D)",
    shortName: "High risk",
    category: "Risk",
    description:
      "Premises whose latest risk snapshot on or before the period end is tier C (high) or D (critical).",
    formula: "COUNT(latestRiskSnapshot <= period end WHERE tier IN ('C','D'))",
    unit: "count",
    measurement: "snapshot",
    desiredDirection: "down",
    caveat: "Uses the latest deterministic risk snapshot on or before the date; premises without a snapshot are excluded.",
  },
  {
    id: "average_risk_score",
    name: "Average risk score",
    shortName: "Avg risk",
    category: "Risk",
    description:
      "Mean deterministic risk score (0 = low, 100 = critical) across rated premises at the period end.",
    formula: "AVG(latestRiskSnapshot.score) for premises on the register",
    unit: "score",
    measurement: "snapshot",
    desiredDirection: "down",
    caveat: "Risk scores are weighted policy rules, not a trained machine-learning prediction.",
  },
  {
    id: "inspections_completed",
    name: "Inspections completed",
    shortName: "Completed",
    category: "Inspections",
    description: "Inspections with a completion timestamp inside the selected period.",
    formula: "COUNT(inspections WHERE completedAt IN [period start, period end))",
    unit: "count",
    measurement: "event",
    desiredDirection: "up",
  },
  {
    id: "inspection_completion_rate",
    name: "Inspection completion rate",
    shortName: "Completion rate",
    category: "Inspections",
    description:
      "Inspections completed by the period end as a share of inspections that fell due in the period.",
    formula: "completed due inspections / inspections scheduled in the period",
    unit: "percent",
    measurement: "event",
    desiredDirection: "up",
    caveat: "Future-dated inspections in the current period are excluded from the denominator until they are due.",
  },
  {
    id: "critical_violations",
    name: "Critical violations",
    shortName: "Critical findings",
    category: "Inspections",
    description:
      "Critical-severity violations recorded during inspections completed in the selected period.",
    formula: "COUNT(violations WHERE severity = 'critical' AND parent inspection completed in period)",
    unit: "count",
    measurement: "event",
    desiredDirection: "down",
  },
  {
    id: "violations_per_inspection",
    name: "Violations per inspection",
    shortName: "Findings / inspection",
    category: "Inspections",
    description:
      "Average number of violation findings per completed inspection in the selected period.",
    formula: "violations found / inspections completed",
    unit: "rate",
    measurement: "event",
    desiredDirection: "down",
  },
  {
    id: "repeat_violation_rate",
    name: "Repeat violation share",
    shortName: "Repeat findings",
    category: "Inspections",
    description:
      "Share of violation findings in the period where the same violation type was already recorded at the same business before the period started.",
    formula: "repeat violation findings / all violation findings",
    unit: "percent",
    measurement: "event",
    desiredDirection: "down",
    caveat: "Requires prior inspection history before the period start. New businesses cannot register repeat findings.",
  },
  {
    id: "complaints_received",
    name: "Complaints received",
    shortName: "Received",
    category: "Complaints",
    description: "Citizen complaints created inside the selected period.",
    formula: "COUNT(complaints WHERE createdAt IN [period start, period end))",
    unit: "count",
    measurement: "event",
    desiredDirection: "neutral",
  },
  {
    id: "complaints_resolved",
    name: "Complaints resolved",
    shortName: "Resolved",
    category: "Complaints",
    description:
      "Complaints resolved inside the selected period with a valid resolution timestamp.",
    formula: "COUNT(complaints WHERE resolvedAt IN [period start, period end) AND resolvedAt >= createdAt)",
    unit: "count",
    measurement: "event",
    desiredDirection: "up",
    caveat: "Complaints marked resolved without a resolution timestamp are excluded and listed in data quality.",
  },
  {
    id: "average_resolution_days",
    name: "Average resolution time",
    shortName: "Avg resolution",
    category: "Complaints",
    description:
      "Mean calendar days from complaint creation to resolution for complaints resolved in the period.",
    formula: "AVG(resolvedAt − createdAt) / 86,400,000 ms",
    unit: "days",
    measurement: "event",
    desiredDirection: "down",
    caveat: "Calendar days, not business days. Impossible negative durations are excluded.",
  },
  {
    id: "sla_compliance",
    name: "Complaint SLA compliance",
    shortName: "SLA met",
    category: "Complaints",
    description:
      "Share of valid resolutions in the period completed within the complaint's SLA target.",
    formula: "COUNT(resolution time <= slaDays) / COUNT(valid resolutions)",
    unit: "percent",
    measurement: "event",
    desiredDirection: "up",
  },
  {
    id: "overdue_open_complaints",
    name: "Overdue open complaints",
    shortName: "Overdue open",
    category: "Complaints",
    description:
      "Complaints still open at the period end whose SLA due date has already passed.",
    formula: "COUNT(open complaints WHERE createdAt + slaDays < period end)",
    unit: "count",
    measurement: "snapshot",
    desiredDirection: "down",
    caveat: "Reconstructed from creation, resolution and SLA fields. Complaints with missing resolution data are excluded.",
  },
];

const KPI_BY_ID = new Map(KPI_DEFINITIONS.map((d) => [d.id, d]));

export interface KpiComparison {
  previous: number | null;
  absolute: number | null;
  percent: number | null;
  direction: "up" | "down" | "flat" | "none";
  /** Movement interpreted against the KPI's desired direction. */
  favourable: "up" | "down" | "flat" | "none";
}

export interface SeriesPoint {
  label: string;
  value: number | null;
}

export interface KpiResult {
  definition: KpiDefinition;
  value: number | null;
  previous: number | null;
  comparison: KpiComparison;
  numerator: number | null;
  denominator: number | null;
  series: SeriesPoint[];
  note?: string;
}

export interface TrendSeries {
  complaintsReceived: SeriesPoint[];
  complaintsResolved: SeriesPoint[];
  inspectionsCompleted: SeriesPoint[];
  violationsFound: SeriesPoint[];
}

export interface DistrictMetric {
  district: string;
  businesses: number;
  highRisk: number;
  averageRiskScore: number | null;
  inspectionsCompleted: number;
  violations: number;
  complaintsReceived: number;
  complaintsResolved: number;
  averageResolutionDays: number | null;
  slaCompliance: number | null;
  overdueOpen: number;
}

export interface RiskRankingRow {
  id: string;
  name: string;
  district: string;
  category: string;
  licenseNumber: string;
  status: string;
  score: number;
  tier: string;
  previousScore: number | null;
  scoreDelta: number | null;
  snapshotAt: Date | null;
  factors: { key: RiskFactorKey; label: string; points: number; max: number }[];
  topFactor: string | null;
}

export interface DistributionSlice {
  key: string;
  label: string;
  count: number;
  share: number;
  /** Optional secondary count, e.g. high-risk premises in a category. */
  secondary?: number;
}

export interface AnalyticsView {
  kpis: KpiResult[];
  trend: TrendSeries;
  districts: DistrictMetric[];
  riskRanking: RiskRankingRow[];
  tierDistribution: DistributionSlice[];
  categoryDistribution: DistributionSlice[];
  complaintTypeDistribution: DistributionSlice[];
  severityDistribution: DistributionSlice[];
  slaOutcomes: { withinSla: number; breached: number; compliance: number | null };
  scope: {
    businesses: number;
    complaints: number;
    inspections: number;
    snapshotCoverage: { rated: number; total: number };
  };
  notes: string[];
}

export function formatKpiValue(value: number | null, unit: KpiUnit): string {
  if (value === null || !Number.isFinite(value)) return "—";
  switch (unit) {
    case "count":
      return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value);
    case "percent":
      return `${value.toFixed(1)}%`;
    case "days":
      return `${value.toFixed(1)} d`;
    case "score":
      return `${value.toFixed(1)}/100`;
    case "rate":
      return value.toFixed(2);
    default:
      return String(value);
  }
}

function compareKpi(
  current: number | null,
  previous: number | null,
  desired: DesiredDirection
): KpiComparison {
  if (current === null || previous === null) {
    return {
      previous,
      absolute: null,
      percent: null,
      direction: "none",
      favourable: "none",
    };
  }
  const absolute = Math.round((current - previous) * 1000) / 1000;
  const percent = previous === 0 ? null : ((current - previous) / Math.abs(previous)) * 100;
  const direction: KpiComparison["direction"] =
    Math.abs(absolute) < 0.0001 ? "flat" : absolute > 0 ? "up" : "down";
  let favourable: KpiComparison["favourable"] = direction;
  if (direction === "flat") favourable = "flat";
  else if (desired === "neutral") favourable = "none";
  else if (desired === "down") favourable = direction === "down" ? "up" : "down";
  return {
    previous,
    absolute,
    percent: percent === null ? null : Math.round(percent * 10) / 10,
    direction,
    favourable,
  };
}

export interface Scope {
  businessIds: Set<string>;
  district: string | null;
  allowUnattached: boolean;
}

export function makeScope(dataset: AnalyticsDataset, districtOverride?: string | null): Scope {
  const district =
    districtOverride === undefined ? dataset.filters.district || null : districtOverride || null;
  const businessIds = new Set(
    dataset.businesses
      .filter((b) => !district || b.district === district)
      .map((b) => b.id)
  );
  return {
    businessIds,
    district,
    allowUnattached: !dataset.filters.category && !dataset.filters.riskTier,
  };
}

export function complaintInScope(c: BusinessComplaintRecord, scope: Scope): boolean {
  if (c.businessId) return scope.businessIds.has(c.businessId);
  if (!scope.allowUnattached) return false;
  return !scope.district || c.district === scope.district;
}

export function inspectionInScope(i: BusinessInspectionRecord, scope: Scope): boolean {
  return scope.businessIds.has(i.businessId);
}

interface EventMetrics {
  inspectionsCompleted: number;
  dueInspections: number;
  completedDueInspections: number;
  completionRate: number | null;
  totalViolations: number;
  criticalViolations: number;
  violationsPerInspection: number | null;
  repeatViolations: number;
  repeatViolationRate: number | null;
  complaintsReceived: number;
  complaintsResolved: number;
  averageResolutionDays: number | null;
  slaCompliant: number;
  slaEvaluated: number;
  slaCompliance: number | null;
  invalidComplaints: number;
}

function inWindow(date: Date | null | undefined, start: Date, end: Date): boolean {
  return !!date && date >= start && date < end;
}

function computeEventMetrics(
  dataset: AnalyticsDataset,
  scope: Scope,
  start: Date,
  end: Date
): EventMetrics {
  const now = dataset.generatedAt;
  // For the live period, only inspections whose scheduled date has arrived can
  // reasonably count as "due" yet.
  const dueEnd = end < now ? end : now;
  const dueInspections = dataset.inspections.filter(
    (i) => inspectionInScope(i, scope) && i.scheduledAt >= start && i.scheduledAt < dueEnd
  );
  const completedDue = dueInspections.filter(
    (i) => i.completedAt && i.completedAt < end
  );

  const completed = dataset.inspections.filter(
    (i) => inspectionInScope(i, scope) && inWindow(i.completedAt, start, end)
  );

  let totalViolations = 0;
  let criticalViolations = 0;
  let repeatViolations = 0;

  // Prior history set for repeat findings. A violation is a repeat when the
  // same type was recorded at the same business before this period started.
  const priorFindings = new Set<string>();
  for (const insp of dataset.inspections) {
    if (!insp.completedAt || insp.completedAt >= start) continue;
    if (!inspectionInScope(insp, scope)) continue;
    for (const v of insp.violations) priorFindings.add(`${insp.businessId}|${v.type}`);
  }

  for (const insp of completed) {
    for (const v of insp.violations) {
      totalViolations += 1;
      if (v.severity === "critical") criticalViolations += 1;
      if (priorFindings.has(`${insp.businessId}|${v.type}`)) repeatViolations += 1;
    }
  }

  let complaintsReceived = 0;
  let complaintsResolved = 0;
  let invalidComplaints = 0;
  const durations: number[] = [];
  let slaCompliant = 0;
  let slaEvaluated = 0;

  for (const c of dataset.complaints) {
    if (!complaintInScope(c, scope)) continue;
    if (inWindow(c.createdAt, start, end)) complaintsReceived += 1;
    if (!c.resolvedAt) {
      if (c.status === "resolved") invalidComplaints += 1;
      continue;
    }
    if (!inWindow(c.resolvedAt, start, end)) continue;
    if (c.resolvedAt < c.createdAt) {
      invalidComplaints += 1;
      continue;
    }
    complaintsResolved += 1;
    const days = (c.resolvedAt.getTime() - c.createdAt.getTime()) / DAY_MS;
    durations.push(days);
    slaEvaluated += 1;
    if (days <= c.slaDays) slaCompliant += 1;
  }

  return {
    inspectionsCompleted: completed.length,
    dueInspections: dueInspections.length,
    completedDueInspections: completedDue.length,
    completionRate: pct(completedDue.length, dueInspections.length),
    totalViolations,
    criticalViolations,
    violationsPerInspection:
      completed.length > 0 ? totalViolations / completed.length : null,
    repeatViolations,
    repeatViolationRate: pct(repeatViolations, totalViolations),
    complaintsReceived,
    complaintsResolved,
    averageResolutionDays: average(durations),
    slaCompliant,
    slaEvaluated,
    slaCompliance: pct(slaCompliant, slaEvaluated),
    invalidComplaints,
  };
}

interface SnapshotMetrics {
  registeredBusinesses: number;
  ratedBusinesses: number;
  highRiskPremises: number;
  averageRiskScore: number | null;
  overdueOpen: number;
  invalidOverdue: number;
}

function latestSnapshotBefore(
  snapshots: RiskSnapshotRecord[],
  businessId: string,
  asOf: Date
): RiskSnapshotRecord | null {
  let found: RiskSnapshotRecord | null = null;
  for (const s of snapshots) {
    if (s.businessId !== businessId) continue;
    if (s.snapshotAt.getTime() > asOf.getTime()) break;
    found = s;
  }
  return found;
}

function riskAt(
  dataset: AnalyticsDataset,
  business: BusinessAnalyticsRecord,
  asOf: Date
): { score: number; tier: string; snapshotAt: Date | null } | null {
  if (business.registeredAt > asOf) return null;
  const snap = latestSnapshotBefore(dataset.snapshots, business.id, asOf);
  if (snap) return { score: snap.score, tier: snap.tier, snapshotAt: snap.snapshotAt };
  // The live register is a safe fallback for the current date only. Historical
  // dates without snapshots stay unrated rather than being back-filled.
  if (asOf.getTime() >= dataset.generatedAt.getTime() - 60_000) {
    return { score: business.riskScore, tier: business.riskTier, snapshotAt: null };
  }
  return null;
}

function computeSnapshotMetrics(
  dataset: AnalyticsDataset,
  scope: Scope,
  asOf: Date
): SnapshotMetrics {
  const registered = dataset.businesses.filter(
    (b) =>
      scope.businessIds.has(b.id) &&
      b.registeredAt < asOf &&
      b.status !== "closed"
  );
  const scores: number[] = [];
  let highRisk = 0;
  for (const b of registered) {
    const risk = riskAt(dataset, b, asOf);
    if (!risk) continue;
    scores.push(risk.score);
    if (risk.tier === "C" || risk.tier === "D") highRisk += 1;
  }

  let overdue = 0;
  let invalidOverdue = 0;
  for (const c of dataset.complaints) {
    if (!complaintInScope(c, scope)) continue;
    if (c.createdAt >= asOf) continue;
    if (c.status === "resolved" && !c.resolvedAt) {
      invalidOverdue += 1;
      continue;
    }
    if (c.resolvedAt && c.resolvedAt < asOf) continue;
    const dueAt = new Date(c.createdAt.getTime() + c.slaDays * DAY_MS);
    if (dueAt < asOf) overdue += 1;
  }

  return {
    registeredBusinesses: registered.length,
    ratedBusinesses: scores.length,
    highRiskPremises: highRisk,
    averageRiskScore: average(scores),
    overdueOpen: overdue,
    invalidOverdue,
  };
}

interface Bucket {
  label: string;
  start: Date;
  end: Date;
}

function buildBuckets(start: Date, end: Date, grouping: "day" | "week" | "month"): Bucket[] {
  const buckets: Bucket[] = [];
  let cursor =
    grouping === "month"
      ? startOfIstMonth(start)
      : grouping === "week"
        ? istWeekStart(start)
        : startOfIstDay(start);
  let guard = 0;
  while (cursor < end && guard < 400) {
    guard += 1;
    const next =
      grouping === "month"
        ? addMonths(cursor, 1)
        : addDays(cursor, grouping === "week" ? 7 : 1);
    const label =
      grouping === "month"
        ? formatIstDate(cursor, { month: "short", year: "numeric" })
        : grouping === "week"
          ? `w/c ${formatIstDate(cursor, { day: "numeric", month: "short" })}`
          : formatIstDate(cursor, { day: "numeric", month: "short" });
    buckets.push({ label, start: cursor, end: next });
    cursor = next;
  }
  return buckets;
}

function countBy<T>(items: T[], key: (item: T) => string | null): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const k = key(item);
    if (k === null) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function toDistribution(
  counts: Map<string, number>,
  total: number,
  labels?: Record<string, string>
): DistributionSlice[] {
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: labels?.[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      share: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function eventKpi(
  id: string,
  current: number | null,
  previous: number | null,
  numerator: number | null,
  denominator: number | null,
  series: SeriesPoint[],
  note?: string
): KpiResult {
  const definition = KPI_BY_ID.get(id);
  if (!definition) throw new Error(`Unknown KPI definition: ${id}`);
  return {
    definition,
    value: current,
    previous,
    comparison: compareKpi(current, previous, definition.desiredDirection),
    numerator,
    denominator,
    series,
    note,
  };
}

function buildMonthlySnapshotSeries(
  dataset: AnalyticsDataset,
  scope: Scope,
  metric: (m: SnapshotMetrics) => number | null
): SeriesPoint[] {
  const end = dataset.generatedAt;
  const points: SeriesPoint[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const monthStart = addMonths(startOfIstMonth(end), -i);
    const asOf = addMonths(monthStart, 1);
    const pointDate = asOf > end ? end : new Date(asOf.getTime() - 1);
    points.push({
      label: formatIstDate(pointDate, { month: "short" }),
      value: metric(computeSnapshotMetrics(dataset, scope, asOf > end ? end : asOf)),
    });
  }
  return points;
}

function buildKpis(
  dataset: AnalyticsDataset,
  scope: Scope,
  current: EventMetrics,
  previous: EventMetrics,
  currentSnap: SnapshotMetrics,
  previousSnap: SnapshotMetrics
): KpiResult[] {
  const { period } = dataset;
  const buckets = buildBuckets(period.start, period.end, period.grouping);
  const bucketMetrics = buckets.map((b) => ({
    bucket: b,
    metrics: computeEventMetrics(dataset, scope, b.start, b.end),
  }));

  const snapshotsMonthly = (metric: (m: SnapshotMetrics) => number | null) =>
    buildMonthlySnapshotSeries(dataset, scope, metric);

  const invalidNote =
    current.invalidComplaints + previous.invalidComplaints > 0
      ? `${current.invalidComplaints} complaint${current.invalidComplaints === 1 ? "" : "s"} with invalid or missing resolution data excluded from resolution KPIs in this period.`
      : undefined;

  const coverage =
    currentSnap.registeredBusinesses > 0
      ? `${currentSnap.ratedBusinesses}/${currentSnap.registeredBusinesses} registered premises have a risk snapshot on or before the period end.`
      : "No premises in scope.";

  return [
    eventKpi(
      "registered_businesses",
      currentSnap.registeredBusinesses,
      previousSnap.registeredBusinesses,
      currentSnap.registeredBusinesses,
      null,
      snapshotsMonthly((m) => m.registeredBusinesses)
    ),
    eventKpi(
      "high_risk_premises",
      currentSnap.highRiskPremises,
      previousSnap.highRiskPremises,
      currentSnap.highRiskPremises,
      currentSnap.ratedBusinesses,
      snapshotsMonthly((m) => m.highRiskPremises),
      coverage
    ),
    eventKpi(
      "average_risk_score",
      currentSnap.averageRiskScore,
      previousSnap.averageRiskScore,
      null,
      currentSnap.ratedBusinesses,
      snapshotsMonthly((m) => m.averageRiskScore),
      coverage
    ),
    eventKpi(
      "inspections_completed",
      current.inspectionsCompleted,
      previous.inspectionsCompleted,
      current.inspectionsCompleted,
      null,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.inspectionsCompleted,
      }))
    ),
    eventKpi(
      "inspection_completion_rate",
      current.completionRate,
      previous.completionRate,
      current.completedDueInspections,
      current.dueInspections,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.completionRate,
      }))
    ),
    eventKpi(
      "critical_violations",
      current.criticalViolations,
      previous.criticalViolations,
      current.criticalViolations,
      current.totalViolations,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.criticalViolations,
      }))
    ),
    eventKpi(
      "violations_per_inspection",
      current.violationsPerInspection,
      previous.violationsPerInspection,
      current.totalViolations,
      current.inspectionsCompleted,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.violationsPerInspection,
      }))
    ),
    eventKpi(
      "repeat_violation_rate",
      current.repeatViolationRate,
      previous.repeatViolationRate,
      current.repeatViolations,
      current.totalViolations,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.repeatViolationRate,
      }))
    ),
    eventKpi(
      "complaints_received",
      current.complaintsReceived,
      previous.complaintsReceived,
      current.complaintsReceived,
      null,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.complaintsReceived,
      }))
    ),
    eventKpi(
      "complaints_resolved",
      current.complaintsResolved,
      previous.complaintsResolved,
      current.complaintsResolved,
      current.complaintsReceived,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.complaintsResolved,
      })),
      invalidNote
    ),
    eventKpi(
      "average_resolution_days",
      current.averageResolutionDays,
      previous.averageResolutionDays,
      current.complaintsResolved,
      null,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.averageResolutionDays,
      })),
      invalidNote
    ),
    eventKpi(
      "sla_compliance",
      current.slaCompliance,
      previous.slaCompliance,
      current.slaCompliant,
      current.slaEvaluated,
      bucketMetrics.map((b) => ({
        label: b.bucket.label,
        value: b.metrics.slaCompliance,
      })),
      invalidNote
    ),
    eventKpi(
      "overdue_open_complaints",
      currentSnap.overdueOpen,
      previousSnap.overdueOpen,
      currentSnap.overdueOpen,
      null,
      [],
      currentSnap.invalidOverdue > 0 || previousSnap.invalidOverdue > 0
        ? `${currentSnap.invalidOverdue} complaint${currentSnap.invalidOverdue === 1 ? "" : "s"} marked resolved without a resolution timestamp are excluded from the overdue calculation.`
        : undefined
    ),
  ];
}

function buildTrend(
  dataset: AnalyticsDataset,
  scope: Scope
): TrendSeries {
  const { period } = dataset;
  const buckets = buildBuckets(period.start, period.end, period.grouping);
  const received = buckets.map((b) => ({
    label: b.label,
    value: dataset.complaints.filter(
      (c) => complaintInScope(c, scope) && inWindow(c.createdAt, b.start, b.end)
    ).length,
  }));
  const resolved = buckets.map((b) => ({
    label: b.label,
    value: dataset.complaints.filter(
      (c) =>
        complaintInScope(c, scope) &&
        inWindow(c.resolvedAt, b.start, b.end) &&
        c.resolvedAt !== null &&
        c.resolvedAt >= c.createdAt
    ).length,
  }));
  const completed = buckets.map((b) => {
    const metrics = computeEventMetrics(dataset, scope, b.start, b.end);
    return { label: b.label, value: metrics.inspectionsCompleted };
  });
  const violations = buckets.map((b) => {
    const metrics = computeEventMetrics(dataset, scope, b.start, b.end);
    return { label: b.label, value: metrics.totalViolations };
  });
  return {
    complaintsReceived: received,
    complaintsResolved: resolved,
    inspectionsCompleted: completed,
    violationsFound: violations,
  };
}

function buildDistricts(dataset: AnalyticsDataset): DistrictMetric[] {
  const { period } = dataset;
  const districts = [...new Set(dataset.businesses.map((b) => b.district))].sort((a, b) =>
    a.localeCompare(b)
  );
  return districts.map((district) => {
    const scope = makeScope(dataset, district);
    const current = computeEventMetrics(dataset, scope, period.start, period.end);
    const snap = computeSnapshotMetrics(dataset, scope, period.end);
    const businesses = dataset.businesses.filter((b) => b.district === district);
    return {
      district,
      businesses: businesses.length,
      highRisk: snap.highRiskPremises,
      averageRiskScore: snap.averageRiskScore,
      inspectionsCompleted: current.inspectionsCompleted,
      violations: current.totalViolations,
      complaintsReceived: current.complaintsReceived,
      complaintsResolved: current.complaintsResolved,
      averageResolutionDays: current.averageResolutionDays,
      slaCompliance: current.slaCompliance,
      overdueOpen: snap.overdueOpen,
    };
  });
}

function buildRiskRanking(dataset: AnalyticsDataset, scope: Scope): RiskRankingRow[] {
  const asOf = dataset.generatedAt;
  const monthAgo = new Date(asOf.getTime() - 30 * DAY_MS);
  return dataset.businesses
    .filter((b) => scope.businessIds.has(b.id) && b.status !== "closed")
    .map((b) => {
      const current = latestSnapshotBefore(dataset.snapshots, b.id, asOf);
      const earlier = latestSnapshotBefore(dataset.snapshots, b.id, monthAgo);
      const score = current?.score ?? b.riskScore;
      const tier = current?.tier ?? b.riskTier;
      const factors = RISK_FACTOR_KEYS.map((key) => ({
        key,
        label: RISK_FACTOR_LABELS[key],
        points: Number(current?.factors[key] ?? 0),
        max: RISK_WEIGHTS[key],
      })).sort((a, c) => c.points - a.points);
      return {
        id: b.id,
        name: b.name,
        district: b.district,
        category: b.category,
        licenseNumber: b.licenseNumber,
        status: b.status,
        score,
        tier,
        previousScore: earlier?.score ?? null,
        scoreDelta: earlier ? Math.round((score - earlier.score) * 10) / 10 : null,
        snapshotAt: current?.snapshotAt ?? null,
        factors,
        topFactor: factors[0] && factors[0].points > 0 ? factors[0].label : null,
      };
    })
    .sort((a, b) => b.score - a.score);
}

function buildTierDistribution(
  dataset: AnalyticsDataset,
  scope: Scope
): DistributionSlice[] {
  const snap = computeSnapshotMetrics(dataset, scope, dataset.generatedAt);
  const counts = new Map<string, number>();
  for (const b of dataset.businesses) {
    if (!scope.businessIds.has(b.id) || b.status === "closed") continue;
    const risk = riskAt(dataset, b, dataset.generatedAt);
    if (!risk) continue;
    counts.set(risk.tier, (counts.get(risk.tier) ?? 0) + 1);
  }
  const total = snap.ratedBusinesses;
  return ["A", "B", "C", "D"].map((tier) => ({
    key: tier,
    label: `${tier} — ${RISK_TIER_LABELS[tier]}`,
    count: counts.get(tier) ?? 0,
    share: total > 0 ? ((counts.get(tier) ?? 0) / total) * 100 : 0,
  }));
}

function buildCategoryDistribution(
  dataset: AnalyticsDataset,
  scope: Scope
): DistributionSlice[] {
  const businesses = dataset.businesses.filter(
    (b) => scope.businessIds.has(b.id) && b.status !== "closed"
  );
  const counts = countBy(businesses, (b) => b.category);
  const highRiskByCategory = new Map<string, number>();
  for (const b of businesses) {
    const risk = riskAt(dataset, b, dataset.generatedAt);
    if (!risk || (risk.tier !== "C" && risk.tier !== "D")) continue;
    highRiskByCategory.set(
      b.category,
      (highRiskByCategory.get(b.category) ?? 0) + 1
    );
  }
  const total = businesses.length;
  return [...counts.entries()]
    .map(([key, count]) => ({
      key,
      label: key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      share: total > 0 ? (count / total) * 100 : 0,
      secondary: highRiskByCategory.get(key) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);
}

function buildComplaintTypeDistribution(
  dataset: AnalyticsDataset,
  scope: Scope
): DistributionSlice[] {
  const { period } = dataset;
  const inPeriod = dataset.complaints.filter(
    (c) => complaintInScope(c, scope) && inWindow(c.createdAt, period.start, period.end)
  );
  const counts = countBy(inPeriod, (c) => c.type ?? "unspecified");
  const labels: Record<string, string> = { unspecified: "Unspecified" };
  return toDistribution(counts, inPeriod.length, labels);
}

function buildSeverityDistribution(
  dataset: AnalyticsDataset,
  scope: Scope
): DistributionSlice[] {
  const { period } = dataset;
  const counts = new Map<string, number>();
  let total = 0;
  for (const insp of dataset.inspections) {
    if (!inspectionInScope(insp, scope) || !inWindow(insp.completedAt, period.start, period.end)) {
      continue;
    }
    for (const v of insp.violations) {
      counts.set(v.severity, (counts.get(v.severity) ?? 0) + 1);
      total += 1;
    }
  }
  return toDistribution(counts, total);
}

function buildSlaOutcomes(
  dataset: AnalyticsDataset,
  scope: Scope
): { withinSla: number; breached: number; compliance: number | null } {
  const { period } = dataset;
  let within = 0;
  let breached = 0;
  for (const c of dataset.complaints) {
    if (!complaintInScope(c, scope) || !inWindow(c.resolvedAt, period.start, period.end)) {
      continue;
    }
    if (!c.resolvedAt || c.resolvedAt < c.createdAt) continue;
    const days = (c.resolvedAt.getTime() - c.createdAt.getTime()) / DAY_MS;
    if (days <= c.slaDays) within += 1;
    else breached += 1;
  }
  return {
    withinSla: within,
    breached,
    compliance: pct(within, within + breached),
  };
}

export function buildAnalyticsView(dataset: AnalyticsDataset): AnalyticsView {
  const scope = makeScope(dataset);
  const current = computeEventMetrics(
    dataset,
    scope,
    dataset.period.start,
    dataset.period.end
  );
  const previous = computeEventMetrics(
    dataset,
    scope,
    dataset.period.previousStart,
    dataset.period.previousEnd
  );
  const currentSnap = computeSnapshotMetrics(dataset, scope, dataset.period.end);
  const previousSnap = computeSnapshotMetrics(
    dataset,
    scope,
    dataset.period.previousEnd
  );

  const notes: string[] = [];
  if (
    currentSnap.registeredBusinesses > 0 &&
    currentSnap.ratedBusinesses < currentSnap.registeredBusinesses
  ) {
    notes.push(
      `Risk snapshot coverage is ${currentSnap.ratedBusinesses}/${currentSnap.registeredBusinesses} premises. Historical risk values only use snapshots recorded on or before the date.`
    );
  }
  if (current.invalidComplaints > 0) {
    notes.push(
      `${current.invalidComplaints} complaint${current.invalidComplaints === 1 ? "" : "s"} in the period have an impossible or incomplete resolution lifecycle and are excluded from resolution and SLA metrics. See Data Quality.`
    );
  }
  if (dataset.period.key === "custom" && dataset.period.start > dataset.period.end) {
    notes.push("The custom range was normalised so the start date is before the end date.");
  }

  const kpis = buildKpis(dataset, scope, current, previous, currentSnap, previousSnap);
  const complaintCount = dataset.complaints.filter((c) => complaintInScope(c, scope)).length;
  const inspectionCount = dataset.inspections.filter((i) => inspectionInScope(i, scope)).length;

  return {
    kpis,
    trend: buildTrend(dataset, scope),
    districts: buildDistricts(dataset),
    riskRanking: buildRiskRanking(dataset, scope),
    tierDistribution: buildTierDistribution(dataset, scope),
    categoryDistribution: buildCategoryDistribution(dataset, scope),
    complaintTypeDistribution: buildComplaintTypeDistribution(dataset, scope),
    severityDistribution: buildSeverityDistribution(dataset, scope),
    slaOutcomes: buildSlaOutcomes(dataset, scope),
    scope: {
      businesses: scope.businessIds.size,
      complaints: complaintCount,
      inspections: inspectionCount,
      snapshotCoverage: {
        rated: currentSnap.ratedBusinesses,
        total: currentSnap.registeredBusinesses,
      },
    },
    notes,
  };
}
