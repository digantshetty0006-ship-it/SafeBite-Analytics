import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ClipboardList,
  DatabaseZap,
  Download,
  FileSpreadsheet,
  FileText,
  Gauge,
  ShieldAlert,
  Timer,
} from "lucide-react";
import { requireRole } from "@/lib/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/data";
import { buildAnalyticsView } from "@/lib/analytics/kpis";
import { buildReportSummary } from "@/lib/analytics/reports";
import { filtersToQuery } from "@/lib/analytics/filters";
import type { AnalyticsSearchParams } from "@/lib/analytics/types";
import { AnalyticsFilterBar } from "@/components/intelligence/filter-bar";
import { PdfExportButton } from "@/components/intelligence/pdf-export-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Reports & exports · SafeBite" };

interface ReportLink {
  key: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  scope: string;
  csvLabel?: string;
}

const REPORTS: ReportLink[] = [
  {
    key: "summary",
    title: "Management summary",
    description:
      "Period, filters, all 13 KPIs with previous-period comparison, district scorecard, top risk premises and data notes. PDF is formatted for management review; the CSV contains the same sections as rows.",
    icon: <FileText className="h-5 w-5" />,
    scope: "Current filters",
    csvLabel: "Summary CSV",
  },
  {
    key: "risk",
    title: "Risk register",
    description:
      "Full ranked premises register with score, tier, 30-day movement, snapshot timestamp and each factor's points. Suitable for triage meetings and audit.",
    icon: <ShieldAlert className="h-5 w-5" />,
    scope: "Current filters",
    csvLabel: "Risk CSV",
  },
  {
    key: "districts",
    title: "District scorecard",
    description:
      "Premises, high-risk counts, average risk, completed inspections, findings, complaint volume, resolutions, average resolution days, SLA and overdue backlog by district.",
    icon: <Building2 className="h-5 w-5" />,
    scope: "Current filters (district selector ignored for peer comparison)",
    csvLabel: "District CSV",
  },
  {
    key: "complaints",
    title: "Complaint lifecycle register",
    description:
      "Complaints created in the selected period with every lifecycle timestamp, SLA target, calculated resolution days and SLA outcome. Invalid or missing resolution data is left visible for follow-up.",
    icon: <ClipboardList className="h-5 w-5" />,
    scope: "Current filters and period",
    csvLabel: "Complaint CSV",
  },
  {
    key: "inspections",
    title: "Inspection activity register",
    description:
      "Inspections scheduled or completed in the period, with officer, completion date, turnaround days, violation count, critical count and violation types.",
    icon: <Gauge className="h-5 w-5" />,
    scope: "Current filters and period",
    csvLabel: "Inspection CSV",
  },
  {
    key: "process",
    title: "Process efficiency report",
    description:
      "Complaint stage medians, averages and p90 values, funnel counts, inspection turnaround, excluded durations and the list of stages that cannot be measured with current timestamps.",
    icon: <Timer className="h-5 w-5" />,
    scope: "Current filters and period",
    csvLabel: "Process CSV",
  },
  {
    key: "quality",
    title: "Data quality findings",
    description:
      "Every validation rule, severity, affected record count, recommendation and sample records, plus the current quality score. Dataset-wide; period filters do not apply.",
    icon: <DatabaseZap className="h-5 w-5" />,
    scope: "Full dataset (ignores period filters)",
    csvLabel: "Quality CSV",
  },
];

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const user = await requireRole("food_officer");
  const params = await searchParams;
  const dataset = await loadAnalyticsDataset(params);
  const view = buildAnalyticsView(dataset);
  const summary = buildReportSummary(dataset, view, user.name);
  const query = filtersToQuery(dataset.filters);

  return (
    <div className="space-y-5">
      <AnalyticsFilterBar
        filters={dataset.filters}
        options={dataset.options}
        action="/officer/intelligence/reports"
      />

      <div>
        <h2 className="text-lg font-semibold">Management reports &amp; exports</h2>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Exports are generated on the server from the same filtered dataset used by the dashboard,
          so the numbers match. Access is checked against the Food Safety Officer role on every
          download, including the PDF generated in your browser.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Management summary pack</CardTitle>
              <CardDescription className="max-w-3xl">
                {dataset.period.label} compared with {dataset.period.previousLabel}. Includes all
                13 KPIs, district scorecard, top 10 risk premises, filters and limitations.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <PdfExportButton summary={summary} />
              <Button asChild variant="outline" size="sm">
                <a href={`/officer/intelligence/export/summary?${query}`}>
                  <FileSpreadsheet className="mr-2 h-4 w-4" /> Summary CSV
                </a>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <Summary label="Period" value={dataset.period.label} />
            <Summary label="Comparison" value={dataset.period.previousLabel} />
            <Summary label="Premises" value={String(view.scope.businesses)} />
            <Summary
              label="KPI snapshot coverage"
              value={`${view.scope.snapshotCoverage.rated}/${view.scope.snapshotCoverage.total}`}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.key}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="text-primary">{report.icon}</span>
                {report.title}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground">
                  Scope: {report.scope}
                </p>
                <Button asChild size="sm" variant="outline">
                  <a href={`/officer/intelligence/export/${report.key}?${query}`}>
                    <Download className="mr-2 h-4 w-4" />
                    {report.csvLabel ?? "Download CSV"}
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Export safeguards</CardTitle>
          <CardDescription>What is protected and what is intentionally excluded.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
          <div className="space-y-1.5">
            <p>
              <strong className="text-foreground">Formula-injection protection:</strong> CSV cells
              beginning with =, +, -, @, tab or carriage return are prefixed with an apostrophe so
              spreadsheet software treats them as text.
            </p>
            <p>
              <strong className="text-foreground">Permission check:</strong> the export route
              revalidates the session and role; a copied URL cannot be used by a citizen or business
              owner.
            </p>
          </div>
          <div className="space-y-1.5">
            <p>
              <strong className="text-foreground">No hidden extrapolation:</strong> missing values
              are exported as blank or “invalid”, not imputed. Process stages without timestamps are
              reported as unavailable.
            </p>
            <p>
              <strong className="text-foreground">Demo status:</strong> exports use synthetic
              records and carry a disclaimer. They are not official government statistics.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card id="powerbi">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Power BI &amp; Python datasets</CardTitle>
          <CardDescription>
            Denormalised CSV extracts under <code className="rounded bg-muted px-1">public/powerbi/</code>{" "}
            and setup guidance in <code className="rounded bg-muted px-1">docs/powerbi/</code>. These
            files are regenerated with <code className="rounded bg-muted px-1">npm run analytics:datasets</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 text-xs">
            <Button asChild size="sm" variant="outline">
              <Link href="/powerbi/dim_business.csv" prefetch={false}>
                <Download className="mr-2 h-3.5 w-3.5" /> dim_business.csv
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/powerbi/fact_inspections.csv" prefetch={false}>
                <Download className="mr-2 h-3.5 w-3.5" /> fact_inspections.csv
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/powerbi/fact_complaints.csv" prefetch={false}>
                <Download className="mr-2 h-3.5 w-3.5" /> fact_complaints.csv
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/powerbi/fact_risk_snapshots.csv" prefetch={false}>
                <Download className="mr-2 h-3.5 w-3.5" /> fact_risk_snapshots.csv
              </Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/powerbi/kpi_definitions.csv" prefetch={false}>
                <Download className="mr-2 h-3.5 w-3.5" /> kpi_definitions.csv
              </Link>
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Dataset extracts are snapshots of the demo database and are not filtered by this page.
            Read the model and KPI documentation before building visuals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-2.5 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
