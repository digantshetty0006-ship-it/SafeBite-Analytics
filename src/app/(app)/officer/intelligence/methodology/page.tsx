import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Calculator, DatabaseZap, FileCode2, ShieldCheck } from "lucide-react";
import { KPI_DEFINITIONS } from "@/lib/analytics/kpis";
import { RISK_FACTOR_KEYS, RISK_FACTOR_LABELS, RISK_WEIGHTS } from "@/lib/risk";
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

export const metadata: Metadata = { title: "Methodology · SafeBite" };

export default function MethodologyPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">Methodology, definitions and limitations</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          This page documents how the workspace calculates every metric, how risk is scored, how
          quality is assessed and what cannot be measured with the current data model.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" /> KPI catalogue ({KPI_DEFINITIONS.length} metrics)
          </CardTitle>
          <CardDescription>
            Definitions are versioned in code and exported to Power BI and Python tooling. “Event”
            metrics use in-period timestamps; “snapshot” metrics use the state at the period end.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Formula</TableHead>
                <TableHead>Caveat</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {KPI_DEFINITIONS.map((definition) => (
                <TableRow key={definition.id}>
                  <TableCell>
                    <p className="font-medium">{definition.name}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{definition.id}</p>
                    <p className="mt-0.5 max-w-sm text-[11px] text-muted-foreground">
                      {definition.description}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">{definition.category}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {definition.measurement}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">
                    {definition.desiredDirection === "down"
                      ? "Lower is better"
                      : definition.desiredDirection === "up"
                        ? "Higher is better"
                        : "Neutral"}
                  </TableCell>
                  <TableCell className="max-w-xs font-mono text-[10px]">
                    {definition.formula}
                  </TableCell>
                  <TableCell className="max-w-xs text-[11px] text-muted-foreground">
                    {definition.caveat ?? "—"}
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
              <Calculator className="h-4 w-4" /> Risk scoring rules
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              The engine sums five capped factor contributions, clamps the total to 0–100 and maps
              it to tiers A ≤25, B ≤50, C ≤75 and D &gt;75. It is deterministic: the same records
              and the same <code className="rounded bg-muted px-1">asOf</code> date always produce
              the same score.
            </p>
            <div className="space-y-1.5">
              {RISK_FACTOR_KEYS.map((key) => (
                <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5 text-xs">
                  <span>{RISK_FACTOR_LABELS[key]}</span>
                  <span className="font-mono font-semibold">{RISK_WEIGHTS[key]} pts max</span>
                </div>
              ))}
            </div>
            <p>
              Snapshots store the factor breakdown. Historical comparison uses the latest snapshot
              on or before the comparison date. Snapshots older than the current policy weights
              remain historical values and are not silently recalculated.
            </p>
            <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              This is a policy-driven rule engine, not a trained machine-learning model. It is not a
              probability of illness and not a regulatory determination.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4" /> Period, comparison and filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              All presets use Asia/Kolkata day boundaries. The previous period is the immediately
              preceding range of equal duration. Custom ranges are normalised if the start is after
              the end.
            </p>
            <p>
              Event KPIs count records whose event timestamp falls inside the period. Snapshot KPIs
              use the end of the period (or the current time for a live period). Trend grouping
              defaults to daily up to 31 days, weekly up to 120 days and monthly beyond that, and can
              be overridden.
            </p>
            <p>
              District, category and risk-tier filters define the premises universe. Complaint and
              inspection status filters narrow event records. The district comparison table
              deliberately keeps peer districts visible even when one district is selected.
            </p>
            <p>
              Complaint and inspection exports use the same scope as the dashboard, so totals are
              reproducible outside the app.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <DatabaseZap className="h-4 w-4" /> Data quality scoring
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Twenty rules cover complaints, inspections, businesses, documents, risk snapshots
              and supplier master completeness. Each failing rule deducts points once: critical 6,
              high 4, medium 2, low 1. The resulting score is 0–100.
            </p>
            <p>
              Anonymous complaints without a citizen identity are valid and never flagged.
              Contradictory anonymity (anonymous flag plus citizen link) is a finding. Expired
              documents are regulatory follow-ups, not data-quality defects.
            </p>
            <p>
              Data-quality evaluation ignores reporting-period filters by design, so defects cannot
              be hidden by selecting a narrow date range.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <FileCode2 className="h-4 w-4" /> SQL, Power BI and Python
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The repository ships a documented SQL library under{" "}
              <code className="rounded bg-muted px-1">analytics/sql/</code> with SQLite and
              PostgreSQL variants, a validation runner and parameterised query examples.
            </p>
            <p>
              Power BI extracts are written to{" "}
              <code className="rounded bg-muted px-1">public/powerbi/</code> and documented in{" "}
              <code className="rounded bg-muted px-1">docs/powerbi/</code>. Python notebooks and a
              reusable analysis module live under{" "}
              <code className="rounded bg-muted px-1">analytics/python/</code>.
            </p>
            <p>
              Business documentation, the data dictionary, KPI definitions, architecture and test
              strategy live under <code className="rounded bg-muted px-1">docs/</code>.
            </p>
            <Link href="/officer/intelligence/reports#powerbi" className="inline-block text-xs font-medium text-primary hover:underline">
              Open report downloads →
            </Link>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Known limitations</CardTitle>
          <CardDescription>
            Gaps are documented rather than filled with invented values.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
          <p>No acknowledgement, on-site inspection duration, report approval, laboratory or enforcement timestamps.</p>
          <p>Risk snapshots begin six months ago; older comparisons have no historical baseline.</p>
          <p>Business status history is not modelled; current status is applied to historical counts.</p>
          <p>Complaint resolution time uses calendar days, not working hours or business-day SLAs.</p>
          <p>Synthetic demo records are not official statistics and do not imply government endorsement.</p>
          <p>Role model supports Food Safety Officers, citizens and business owners; no separate admin role exists.</p>
        </CardContent>
      </Card>
    </div>
  );
}
