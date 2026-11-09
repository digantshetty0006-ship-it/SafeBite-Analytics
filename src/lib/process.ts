import {
  complaintInScope,
  inspectionInScope,
  makeScope,
} from "./analytics/kpis";
import type { AnalyticsDataset } from "./analytics/types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ProcessStageMetric {
  key: string;
  label: string;
  description: string;
  /** Number of records that had both timestamps needed for this stage. */
  sampleSize: number;
  /** Number of cohort records that reached this stage at all. */
  reached: number;
  medianDays: number | null;
  averageDays: number | null;
  p90Days: number | null;
}

export interface ProcessFunnelStep {
  key: string;
  label: string;
  count: number;
  share: number;
}

export interface UnavailableStage {
  stage: string;
  reason: string;
}

export interface ProcessReport {
  periodLabel: string;
  complaintCohort: number;
  complaintResolved: number;
  complaintStages: ProcessStageMetric[];
  funnel: ProcessFunnelStep[];
  inspectionCompleted: number;
  inspectionDue: number;
  inspectionCompletionRate: number | null;
  inspectionOverdue: number;
  inspectionMissed: number;
  inspectionTurnaround: ProcessStageMetric;
  excludedDurations: number;
  unavailableStages: UnavailableStage[];
  notes: string[];
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function durationDays(from: Date | null | undefined, to: Date | null | undefined): number | null {
  if (!from || !to) return null;
  const days = (to.getTime() - from.getTime()) / DAY_MS;
  return Number.isFinite(days) && days >= 0 ? days : null;
}

function stageMetric(
  key: string,
  label: string,
  description: string,
  reached: number,
  durations: number[]
): ProcessStageMetric {
  return {
    key,
    label,
    description,
    sampleSize: durations.length,
    reached,
    medianDays: median(durations),
    averageDays: average(durations),
    p90Days: percentile(durations, 90),
  };
}

export function buildProcessReport(dataset: AnalyticsDataset): ProcessReport {
  const scope = makeScope(dataset);
  const { start, end } = dataset.period;
  const cohort = dataset.complaints.filter(
    (c) => complaintInScope(c, scope) && c.createdAt >= start && c.createdAt < end
  );

  let excludedDurations = 0;
  const assignment: number[] = [];
  const investigation: number[] = [];
  const inspection: number[] = [];
  const resolution: number[] = [];
  const endToEnd: number[] = [];

  let assignedCount = 0;
  let investigationCount = 0;
  let inspectionCount = 0;
  let resolvedCount = 0;

  for (const c of cohort) {
    if (c.assignedAt) assignedCount += 1;
    if (c.investigationStartedAt) investigationCount += 1;
    if (c.inspectionAt) inspectionCount += 1;
    if (c.resolvedAt && c.resolvedAt >= c.createdAt) resolvedCount += 1;

    const check = (value: number | null, from?: Date | null, to?: Date | null) => {
      if (value === null && from && to) excludedDurations += 1;
      return value;
    };

    const a = check(durationDays(c.createdAt, c.assignedAt), c.createdAt, c.assignedAt);
    if (a !== null) assignment.push(a);

    const i = check(
      durationDays(c.assignedAt, c.investigationStartedAt),
      c.assignedAt,
      c.investigationStartedAt
    );
    if (i !== null) investigation.push(i);

    const insp = check(
      durationDays(c.investigationStartedAt ?? c.assignedAt, c.inspectionAt),
      c.investigationStartedAt ?? c.assignedAt,
      c.inspectionAt
    );
    if (insp !== null) inspection.push(insp);

    const lastStage = c.inspectionAt ?? c.investigationStartedAt ?? c.assignedAt ?? c.createdAt;
    const r = check(durationDays(lastStage, c.resolvedAt), lastStage, c.resolvedAt);
    if (r !== null) resolution.push(r);

    const e2e = check(durationDays(c.createdAt, c.resolvedAt), c.createdAt, c.resolvedAt);
    if (e2e !== null) endToEnd.push(e2e);
  }

  const complaintStages: ProcessStageMetric[] = [
    stageMetric(
      "assignment",
      "Receipt → assignment",
      "Time from complaint creation to assignment to an officer. Used as a proxy for acknowledgement because no separate acknowledgement timestamp exists.",
      assignedCount,
      assignment
    ),
    stageMetric(
      "investigation",
      "Assignment → investigation start",
      "Time from officer assignment to the start of investigation casework.",
      investigationCount,
      investigation
    ),
    stageMetric(
      "inspection",
      "Investigation → inspection",
      "Time from investigation start (or assignment when investigation start is missing) to the inspection stage.",
      inspectionCount,
      inspection
    ),
    stageMetric(
      "resolution",
      "Last casework stage → resolution",
      "Time from the last recorded casework stage (inspection, investigation or assignment) to a valid resolution.",
      resolvedCount,
      resolution
    ),
    stageMetric(
      "end_to_end",
      "Receipt → resolution",
      "End-to-end complaint resolution time for records created in the selected period.",
      resolvedCount,
      endToEnd
    ),
  ];

  const funnel: ProcessFunnelStep[] = [
    { key: "created", label: "Complaints created", count: cohort.length, share: 100 },
    {
      key: "assigned",
      label: "Assigned",
      count: assignedCount,
      share: cohort.length ? (assignedCount / cohort.length) * 100 : 0,
    },
    {
      key: "investigation",
      label: "Investigation started",
      count: investigationCount,
      share: cohort.length ? (investigationCount / cohort.length) * 100 : 0,
    },
    {
      key: "inspection",
      label: "Inspection stage reached",
      count: inspectionCount,
      share: cohort.length ? (inspectionCount / cohort.length) * 100 : 0,
    },
    {
      key: "resolved",
      label: "Resolved",
      count: resolvedCount,
      share: cohort.length ? (resolvedCount / cohort.length) * 100 : 0,
    },
  ];

  const now = dataset.generatedAt;
  const dueEnd = end < now ? end : now;
  const dueInspections = dataset.inspections.filter(
    (insp) =>
      inspectionInScope(insp, scope) &&
      insp.scheduledAt >= start &&
      insp.scheduledAt < dueEnd
  );
  const completedDue = dueInspections.filter((insp) => insp.completedAt && insp.completedAt < end);
  const completed = dataset.inspections.filter(
    (insp) =>
      inspectionInScope(insp, scope) &&
      insp.completedAt &&
      insp.completedAt >= start &&
      insp.completedAt < end
  );

  const turnaroundDurations: number[] = [];
  for (const insp of completed) {
    const days = durationDays(insp.scheduledAt, insp.completedAt);
    if (days === null) {
      if (insp.completedAt) excludedDurations += 1;
      continue;
    }
    turnaroundDurations.push(days);
  }

  const overdueScheduled = dataset.inspections.filter(
    (insp) =>
      inspectionInScope(insp, scope) &&
      insp.status === "scheduled" &&
      insp.scheduledAt < now
  ).length;
  const missed = dataset.inspections.filter(
    (insp) =>
      inspectionInScope(insp, scope) &&
      insp.status === "missed" &&
      insp.scheduledAt >= start &&
      insp.scheduledAt < end
  ).length;

  const inspectionTurnaround = stageMetric(
    "inspection_turnaround",
    "Scheduled date → completion",
    "Calendar days between the planned inspection date and the recorded completion date, for inspections completed in the period.",
    completed.length,
    turnaroundDurations
  );

  const notes: string[] = [
    "Durations use calendar days, not business hours, and only positive or zero differences. Impossible negative durations are excluded and counted below.",
    "Complaint stage metrics are a cohort view: complaints created in the selected period are followed through their current lifecycle records.",
    "Small sample sizes are shown explicitly. A median based on fewer than five records should not be treated as a stable process baseline.",
  ];

  const unavailableStages: UnavailableStage[] = [
    {
      stage: "Complaint acknowledgement",
      reason:
        "No explicit acknowledgement timestamp exists. Receipt → assignment is shown as a proxy and is labelled as such.",
    },
    {
      stage: "On-site inspection duration / travel time",
      reason:
        "Inspections store a scheduled date and a completion timestamp, but no inspection start, arrival or travel timestamps.",
    },
    {
      stage: "Inspection report approval / publication",
      reason:
        "There is no report-submitted, approved or published timestamp, so report-writing and approval lag cannot be calculated.",
    },
    {
      stage: "Laboratory result turnaround",
      reason:
        "No laboratory sample, dispatch, receipt or result timestamps are modelled, so lab turnaround is unavailable.",
    },
    {
      stage: "Enforcement action and case closure",
      reason:
        "No enforcement action or legal closure timestamps exist. Complaint resolution is the final measurable stage.",
    },
    {
      stage: "Business registration approval",
      reason:
        "Only registeredAt is stored; application, review and approval stages are not modelled.",
    },
  ];

  return {
    periodLabel: dataset.period.label,
    complaintCohort: cohort.length,
    complaintResolved: resolvedCount,
    complaintStages,
    funnel,
    inspectionCompleted: completed.length,
    inspectionDue: dueInspections.length,
    inspectionCompletionRate:
      dueInspections.length > 0 ? (completedDue.length / dueInspections.length) * 100 : null,
    inspectionOverdue: overdueScheduled,
    inspectionMissed: missed,
    inspectionTurnaround,
    excludedDurations,
    unavailableStages,
    notes,
  };
}
