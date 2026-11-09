import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  DatabaseZap,
  FileCheck2,
  ShieldAlert,
  Stethoscope,
} from "lucide-react";
import { runDataQualityChecks, DATA_QUALITY_RULES } from "@/lib/quality";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Data quality · SafeBite" };

const SEVERITY_STYLE: Record<string, string> = {
  critical: "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
  high: "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  medium: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  low: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
};

export default async function DataQualityPage() {
  const report = await runDataQualityChecks();
  const scoreTone =
    report.score >= 95
      ? "text-emerald-600"
      : report.score >= 85
        ? "text-sky-600"
        : report.score >= 70
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Data quality workspace</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Validation rules run against the live database whenever this page loads. The score is
          based on rule failures, not record volume, and the workspace deliberately ignores the
          reporting-period filter so defects cannot be hidden by a narrow date range.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quality score
            </p>
            <div className="mt-1 flex items-end gap-2">
              <p className={cn("text-3xl font-bold tabular-nums", scoreTone)}>{report.score}</p>
              <span className="pb-1 text-sm text-muted-foreground">/ 100</span>
            </div>
            <p className="mt-1 text-sm font-medium">{report.grade}</p>
            <p className="text-[11px] text-muted-foreground">{report.penalty} points deducted</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Records checked
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {report.totals.checkedRecords.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {report.totals.rulesEvaluated} rules across complaints, inspections, businesses,
              documents, snapshots and suppliers
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Rules failed / passed
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {report.totals.rulesFailed}{" "}
              <span className="text-base font-normal text-muted-foreground">
                / {report.totals.rulesPassed}
              </span>
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {report.totals.critical} critical rules · {report.totals.high} high ·{" "}
              {report.totals.medium} medium
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Records in findings
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
              {report.totals.issues.toLocaleString("en-IN")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sample records are shown; full counts are exact.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="rounded-xl border border-sky-300/70 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100">
        <div className="flex items-start gap-2">
          <Stethoscope className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1">
            <p className="font-medium">False-positive controls</p>
            <p>
              Anonymous complaints with no citizen link are legitimate and never flagged. A
              complaint is flagged only when the anonymous flag and a citizen identity contradict
              each other. Expired documents are compliance follow-ups, not data-quality defects.
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="inline-flex items-center gap-2 text-base font-semibold">
              <ShieldAlert className="h-4 w-4" /> Findings ({report.findings.length} rules)
            </h3>
            <p className="text-xs text-muted-foreground">
              Ordered by severity. Each finding includes a recommended remediation.
            </p>
          </div>
          <Link href="/officer/intelligence/reports" className="text-xs font-medium text-primary hover:underline">
            Download quality findings →
          </Link>
        </div>

        {report.findings.map((finding) => (
          <Card key={finding.rule.id}>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                    {finding.rule.name}
                    <Badge variant="outline" className={cn("text-[10px]", SEVERITY_STYLE[finding.rule.severity])}>
                      {finding.rule.severity}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {finding.rule.id}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="mt-1 max-w-3xl">
                    {finding.rule.description}
                  </CardDescription>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold tabular-nums">{finding.count}</p>
                  <p className="text-[11px] text-muted-foreground">record(s)</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="rounded-lg bg-muted/40 px-2.5 py-1.5 font-mono text-[11px]">
                Check: {finding.rule.check}
              </p>
              <p className="text-sm">
                <span className="font-medium">Recommendation: </span>
                <span className="text-muted-foreground">{finding.rule.recommendation}</span>
              </p>
              <div className="space-y-1">
                {finding.records.map((record) => (
                  <div
                    key={`${finding.rule.id}-${record.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-xs"
                  >
                    <span className="font-medium">{record.label}</span>
                    <span className="text-muted-foreground">{record.detail}</span>
                    {record.href && (
                      <Link href={record.href} className="text-primary hover:underline">
                        Open
                      </Link>
                    )}
                  </div>
                ))}
                {finding.truncated && (
                  <p className="text-[11px] text-muted-foreground">
                    Showing first {finding.records.length} records of {finding.count}.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}

        {report.findings.length === 0 && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 text-center text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6" />
            All data-quality rules pass on the current dataset.
          </div>
        )}
      </section>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <DatabaseZap className="h-4 w-4" /> Rule catalogue
          </CardTitle>
          <CardDescription>
            The full rule set is documented here, including checks that currently pass.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rule</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Check</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.values(DATA_QUALITY_RULES).map((rule) => {
                const failed = report.findings.some((f) => f.rule.id === rule.id);
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <p className="font-medium">{rule.name}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{rule.id}</p>
                    </TableCell>
                    <TableCell className="text-xs">{rule.category}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px]", SEVERITY_STYLE[rule.severity])}>
                        {rule.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-md font-mono text-[10px] text-muted-foreground">
                      {rule.check}
                    </TableCell>
                    <TableCell className="text-right">
                      {failed ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Finding
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-emerald-300 text-[10px] text-emerald-700 dark:border-emerald-800 dark:text-emerald-300">
                          Pass
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <FileCheck2 className="h-4 w-4" /> Scoring method
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            {report.notes.map((note) => (
              <p key={note}>{note}</p>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" /> Remediation guidance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Fix critical rules first: they break downstream KPIs and can mislead decisions. Then
              repair high-severity lifecycle conflicts, followed by completeness warnings.
            </p>
            <p>
              The demo database intentionally contains five realistic edge cases so this workspace
              has findings to show. Re-run <code className="rounded bg-muted px-1">npm run seed</code>{" "}
              to restore them after cleaning.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
