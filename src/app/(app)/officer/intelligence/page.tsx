import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Database, Gauge, Info, ShieldCheck } from "lucide-react";
import { loadAnalyticsDataset } from "@/lib/analytics/data";
import {
  buildAnalyticsView,
  formatKpiValue,
  KPI_DEFINITIONS,
  type KpiResult,
} from "@/lib/analytics/kpis";
import { filtersToQuery } from "@/lib/analytics/filters";
import type { AnalyticsSearchParams } from "@/lib/analytics/types";
import { AnalyticsFilterBar } from "@/components/intelligence/filter-bar";
import { KpiCard } from "@/components/intelligence/kpi-card";
import {
  ActivityTrendChart,
  CategoryChart,
  ComplaintTypeChart,
  DistrictRiskChart,
  TierDonut,
  ViolationsTrendChart,
} from "@/components/intelligence/charts";
import { RiskRankingTable } from "@/components/intelligence/risk-table";
import { DistrictMetricTable } from "@/components/intelligence/district-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Intelligence overview · SafeBite" };

export default async function IntelligenceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const dataset = await loadAnalyticsDataset(params);
  const view = buildAnalyticsView(dataset);
  const query = filtersToQuery(dataset.filters);
  const kpi = (id: string): KpiResult =>
    view.kpis.find((k) => k.definition.id === id) ?? view.kpis[0];

  const trendData = view.trend.complaintsReceived.map((point, index) => ({
    label: point.label,
    received: point.value ?? 0,
    resolved: view.trend.complaintsResolved[index]?.value ?? 0,
    inspections: view.trend.inspectionsCompleted[index]?.value ?? 0,
    violations: view.trend.violationsFound[index]?.value ?? 0,
  }));

  const businessCount = kpi("registered_businesses");
  const complaintsReceived = kpi("complaints_received");
  const inspectionsCompleted = kpi("inspections_completed");
  const sla = kpi("sla_compliance");

  return (
    <div className="space-y-5">
      <AnalyticsFilterBar
        filters={dataset.filters}
        options={dataset.options}
        action="/officer/intelligence"
      />

      <section className="rounded-xl border bg-gradient-to-r from-emerald-500/10 via-card to-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Reporting period
            </p>
            <p className="font-semibold">{dataset.period.label}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Comparison period
            </p>
            <p className="font-semibold">{dataset.period.previousLabel}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Premises in scope
            </p>
            <p className="font-semibold tabular-nums">{view.scope.businesses}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Complaints received
            </p>
            <p className="font-semibold tabular-nums">
              {formatKpiValue(complaintsReceived.value, "count")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Inspections completed
            </p>
            <p className="font-semibold tabular-nums">
              {formatKpiValue(inspectionsCompleted.value, "count")}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Risk snapshot coverage
            </p>
            <p className="font-semibold tabular-nums">
              {view.scope.snapshotCoverage.rated}/{view.scope.snapshotCoverage.total}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="kpi-heading">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="kpi-heading" className="text-sm font-semibold uppercase tracking-wide">
              13 governed KPIs
            </h2>
            <p className="text-xs text-muted-foreground">
              Each tile compares the selected period with the immediately preceding period of
              equal length. Hover for the exact formula.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Gauge className="h-4 w-4" />
            <span>Event metrics use timestamps; snapshot metrics use period-end dates.</span>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {view.kpis.map((item) => (
            <KpiCard key={item.definition.id} kpi={item} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Green = movement
            in the desired direction
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500" /> Red = adverse
            movement
          </span>
          <span>SLA outcomes: {sla.numerator ?? 0} met / {sla.denominator ?? 0} evaluated</span>
          <span>Registered premises at end: {formatKpiValue(businessCount.value, "count")}</span>
        </div>
      </section>

      {view.notes.length > 0 && (
        <div className="rounded-xl border border-amber-300/70 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="space-y-1">
              {view.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Operational activity trend</CardTitle>
            <CardDescription>
              Complaints received, complaints resolved and inspections completed, grouped by{" "}
              {dataset.period.grouping}. Zero-activity buckets are shown so gaps are visible.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ActivityTrendChart data={trendData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Risk tier distribution</CardTitle>
            <CardDescription>
              Latest snapshot on or before the period end. Tiers follow score bands A ≤25, B ≤50,
              C ≤75, D &gt;75.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TierDonut data={view.tierDistribution} />
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
              {view.tierDistribution.map((slice) => (
                <div key={slice.key} className="flex items-center justify-between rounded-lg bg-muted/50 px-2 py-1.5">
                  <span className="text-muted-foreground">{slice.key}</span>
                  <span className="font-semibold tabular-nums">
                    {slice.count} ({slice.share.toFixed(0)}%)
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Findings and severity</CardTitle>
            <CardDescription>
              Violations recorded during inspections completed in the selected period. Critical
              findings are also reported as a KPI.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ViolationsTrendChart data={trendData} />
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              {view.severityDistribution.length === 0 && (
                <p className="col-span-full text-muted-foreground">No findings in the period.</p>
              )}
              {view.severityDistribution.map((slice) => (
                <div key={slice.key} className="rounded-lg bg-muted/50 px-2 py-1.5">
                  <p className="capitalize text-muted-foreground">{slice.label}</p>
                  <p className="font-semibold tabular-nums">{slice.count}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Complaint categories</CardTitle>
            <CardDescription>
              Complaints received in the selected period, by recorded complaint type. “Unspecified”
              is shown rather than silently dropped.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ComplaintTypeChart data={view.complaintTypeDistribution} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">District comparison</CardTitle>
            <CardDescription>
              Average risk score and overdue open complaints by district. The selected district is
              highlighted in the table; peer districts remain visible for comparison.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DistrictRiskChart data={view.districts} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Premises by category</CardTitle>
            <CardDescription>
              Registered premises and how many sit in high or critical risk tiers (C + D).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={view.categoryDistribution} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="text-base">Risk ranking</CardTitle>
              <CardDescription>
                Highest current risk scores with 30-day movement and the largest contributing
                factor. Scores are deterministic weighted rules, not a trained model.
              </CardDescription>
            </div>
            <Link
              href={`/officer/intelligence/risk${query ? `?${query}` : ""}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Full risk explorer <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RiskRankingTable rows={view.riskRanking} limit={8} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">District scorecard</CardTitle>
          <CardDescription>
            Operational and compliance indicators by district. Counts respect all active filters
            except the district selector, which is used only to highlight a row.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DistrictMetricTable
            rows={view.districts}
            selectedDistrict={dataset.filters.district || undefined}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Info className="h-4 w-4" /> KPI definitions
          </CardTitle>
          <CardDescription>
            All {KPI_DEFINITIONS.length} metrics are calculated server-side from the filtered
            dataset. Open a row for its formula and limitations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {KPI_DEFINITIONS.map((definition) => (
            <details key={definition.id} className="rounded-lg border bg-muted/20 p-2.5">
              <summary className="cursor-pointer text-sm font-medium">
                {definition.name}
                <span className="ml-2 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  {definition.measurement}
                </span>
                <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground">
                  {definition.category}
                </span>
              </summary>
              <div className="mt-2 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                <p>{definition.description}</p>
                <div>
                  <p className="font-mono text-[11px] text-foreground">{definition.formula}</p>
                  {definition.caveat && <p className="mt-1 text-[11px]">Caveat: {definition.caveat}</p>}
                </div>
              </div>
            </details>
          ))}
        </CardContent>
      </Card>

      <section className="rounded-xl border bg-card p-4 text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <Database className="h-4 w-4" /> Data source: local SafeBite demo database (SQLite by
            default, PostgreSQL supported).
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4" /> Role-gated to Food Safety Officers; no citizen or
            business-owner access.
          </span>
          <span className="inline-flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" /> Synthetic records for demonstration, not official
            government statistics or endorsement.
          </span>
        </div>
      </section>
    </div>
  );
}
