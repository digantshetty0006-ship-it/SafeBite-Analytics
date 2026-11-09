import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Clock3, Info, TimerOff, Workflow } from "lucide-react";
import { loadAnalyticsDataset } from "@/lib/analytics/data";
import { buildProcessReport } from "@/lib/process";
import { filtersToQuery } from "@/lib/analytics/filters";
import type { AnalyticsSearchParams } from "@/lib/analytics/types";
import { AnalyticsFilterBar } from "@/components/intelligence/filter-bar";
import { ProcessStageChart } from "@/components/intelligence/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Process efficiency · SafeBite" };

function days(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)} d`;
}

export default async function ProcessEfficiencyPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const dataset = await loadAnalyticsDataset(params);
  const report = buildProcessReport(dataset);
  const query = filtersToQuery(dataset.filters);
  const endToEnd = report.complaintStages.find((stage) => stage.key === "end_to_end");
  const bottleneck = report.complaintStages
    .filter((stage) => stage.key !== "end_to_end" && stage.sampleSize >= 3)
    .sort((a, b) => (b.medianDays ?? 0) - (a.medianDays ?? 0))[0];

  return (
    <div className="space-y-5">
      <AnalyticsFilterBar
        filters={dataset.filters}
        options={dataset.options}
        action="/officer/intelligence/process"
      />

      <div>
        <h2 className="text-lg font-semibold">Process efficiency</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Stage-level cycle times derived only from timestamps that actually exist. The page also
          lists process stages that cannot be measured with the current data model, so gaps are not
          mistaken for good performance.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Complaint cohort
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{report.complaintCohort}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Created in {report.periodLabel}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Median end-to-end resolution
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">{days(endToEnd?.medianDays ?? null)}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {endToEnd?.sampleSize ?? 0} valid resolution{(endToEnd?.sampleSize ?? 0) === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Inspection completion rate
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {report.inspectionCompletionRate === null
                ? "—"
                : `${report.inspectionCompletionRate.toFixed(1)}%`}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {report.inspectionCompleted} completed / {report.inspectionDue} due in period
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Overdue scheduled inspections
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {report.inspectionOverdue}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {report.inspectionMissed} missed in period · current open backlog
            </p>
          </CardContent>
        </Card>
      </div>

      {bottleneck && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Largest measurable complaint stage: <strong>{bottleneck.label}</strong> with a median
              of {days(bottleneck.medianDays)} across {bottleneck.sampleSize} record(s). Compare this
              against the SLA and the stage sample size before acting.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Workflow className="h-4 w-4" /> Stage cycle times
            </CardTitle>
            <CardDescription>
              Median and 90th-percentile calendar days for each measurable stage. Longer tails are
              visible through the p90 bar even when the median looks healthy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProcessStageChart
              data={report.complaintStages.map((stage) => ({
                label: stage.label,
                medianDays: stage.medianDays,
                p90Days: stage.p90Days,
                sampleSize: stage.sampleSize,
              }))}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Complaint funnel</CardTitle>
            <CardDescription>
              Share of the selected cohort that reached each stage. Stages are cumulative, not
              mutually exclusive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.funnel.map((step) => (
              <div key={step.key}>
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium">{step.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {step.count} · {step.share.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, step.share)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="pt-1 text-[11px] leading-snug text-muted-foreground">
              A complaint can be resolved without an inspection stage; the funnel therefore does
              not imply that every record must pass through every step.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Complaint stage metrics</CardTitle>
          <CardDescription>
            “Reached” counts cohort records with the stage timestamp; “valid sample” counts only
            non-negative durations. Negative or impossible timestamps are excluded and counted in
            the notes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Reached</TableHead>
                <TableHead className="text-right">Valid sample</TableHead>
                <TableHead className="text-right">Median</TableHead>
                <TableHead className="text-right">Average</TableHead>
                <TableHead className="text-right">p90</TableHead>
                <TableHead className="hidden lg:table-cell">Interpretation</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.complaintStages.map((stage) => (
                <TableRow key={stage.key}>
                  <TableCell>
                    <p className="font-medium">{stage.label}</p>
                    <p className="max-w-md text-[11px] text-muted-foreground">{stage.description}</p>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{stage.reached}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span
                      className={cn(
                        stage.sampleSize < 5 && "rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      )}
                    >
                      {stage.sampleSize}
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {days(stage.medianDays)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{days(stage.averageDays)}</TableCell>
                  <TableCell className="text-right tabular-nums">{days(stage.p90Days)}</TableCell>
                  <TableCell className="hidden max-w-xs text-xs text-muted-foreground lg:table-cell">
                    {stage.key === "assignment" && "Includes acknowledgement proxy; no separate acknowledgement timestamp."}
                    {stage.key === "investigation" && "Casework start after assignment."}
                    {stage.key === "inspection" && "Only records with an inspection stage timestamp."}
                    {stage.key === "resolution" && "Measured from the last recorded casework stage."}
                    {stage.key === "end_to_end" && "Full cycle for resolved cohort records."}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" /> Inspection turnaround
            </CardTitle>
            <CardDescription>
              Scheduled date to completion for inspections completed in the period. This is
              administrative turnaround, not time spent on site.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Median" value={days(report.inspectionTurnaround.medianDays)} />
              <Metric label="Average" value={days(report.inspectionTurnaround.averageDays)} />
              <Metric label="90th percentile" value={days(report.inspectionTurnaround.p90Days)} />
              <Metric label="Valid sample" value={String(report.inspectionTurnaround.sampleSize)} />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {report.inspectionCompleted} inspections completed in the period;{" "}
              {report.inspectionDue} were due. Completion rate is reported as an operational KPI
              elsewhere in the workspace.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <TimerOff className="h-4 w-4" /> Stages that cannot be measured
            </CardTitle>
            <CardDescription>
              The current schema does not capture these timestamps. They are explicitly excluded
              rather than estimated or invented.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {report.unavailableStages.map((stage) => (
              <div key={stage.stage} className="rounded-lg border bg-muted/20 p-2.5">
                <p className="text-sm font-medium">{stage.stage}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stage.reason}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> Method notes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          {report.notes.map((note) => (
            <p key={note}>{note}</p>
          ))}
          <p>
            {report.excludedDurations} duration(s) were excluded because a timestamp was missing or
            negative. Fixing these records is covered in the{" "}
            <Link href="/officer/intelligence/quality" className="text-primary hover:underline">
              Data Quality workspace
            </Link>
            .
          </p>
          <p className="text-xs">
            Filtered period: {dataset.period.label} · comparison period:{" "}
            {dataset.period.previousLabel}. Process metrics are cohort-based and do not use
            previous-period comparison tiles.
          </p>
          <Link
            href={`/officer/intelligence/reports${query ? `?${query}` : ""}`}
            className="inline-block text-xs font-medium text-primary hover:underline"
          >
            Export process metrics →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}
