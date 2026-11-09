import type { Metadata } from "next";
import { AlertTriangle, ArrowRight, Calculator, GitBranch, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { loadAnalyticsDataset } from "@/lib/analytics/data";
import { buildAnalyticsView } from "@/lib/analytics/kpis";
import { filtersToQuery } from "@/lib/analytics/filters";
import type { AnalyticsSearchParams } from "@/lib/analytics/types";
import {
  RISK_FACTOR_KEYS,
  RISK_FACTOR_LABELS,
  RISK_TIER_LABELS,
  RISK_WEIGHTS,
} from "@/lib/risk";
import { AnalyticsFilterBar } from "@/components/intelligence/filter-bar";
import { KpiCard } from "@/components/intelligence/kpi-card";
import { RiskRankingTable } from "@/components/intelligence/risk-table";
import { CategoryChart, SeverityChart, TierDonut } from "@/components/intelligence/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Risk explorer · SafeBite" };

const FACTOR_DESCRIPTIONS: Record<string, string> = {
  violations:
    "Severity-weighted findings from inspections, with a 12-month recency decay. Capped at 40 points.",
  complaints:
    "Complaints in the 90 days before the scoring date. In-review or substantiated complaints carry more weight than new ones. Capped at 25 points.",
  inspectionTimeliness:
    "Time since the last completed inspection beyond a 6-month target. A scheduled follow-up reduces the load by 4 points.",
  documents: "Expired compliance documents, and missing document records. Capped at 10 points.",
  category: "A fixed baseline for the handling risk typical of the business category.",
};

const TIER_BANDS = [
  { tier: "A", range: "0–25", label: RISK_TIER_LABELS.A },
  { tier: "B", range: "26–50", label: RISK_TIER_LABELS.B },
  { tier: "C", range: "51–75", label: RISK_TIER_LABELS.C },
  { tier: "D", range: "76–100", label: RISK_TIER_LABELS.D },
];

export default async function RiskExplorerPage({
  searchParams,
}: {
  searchParams: Promise<AnalyticsSearchParams>;
}) {
  const params = await searchParams;
  const dataset = await loadAnalyticsDataset(params);
  const view = buildAnalyticsView(dataset);
  const query = filtersToQuery(dataset.filters);
  const kpi = (id: string) => view.kpis.find((k) => k.definition.id === id)!;
  const featured = ["high_risk_premises", "average_risk_score", "critical_violations", "repeat_violation_rate"].map(
    (id) => kpi(id)
  );
  const totalWeight = RISK_FACTOR_KEYS.reduce((sum, key) => sum + RISK_WEIGHTS[key], 0);

  return (
    <div className="space-y-5">
      <AnalyticsFilterBar
        filters={dataset.filters}
        options={dataset.options}
        action="/officer/intelligence/risk"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {featured.map((item) => (
          <KpiCard key={item.definition.id} kpi={item} compact />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="inline-flex items-center gap-2 text-base">
            <Calculator className="h-4 w-4" /> How the risk score is built
          </CardTitle>
          <CardDescription>
            A transparent, deterministic rules model with a maximum of {totalWeight} weighted
            points. The score is clamped to 0–100; higher means more risk. No trained
            machine-learning model is used.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {RISK_FACTOR_KEYS.map((key) => (
              <div key={key} className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{RISK_FACTOR_LABELS[key]}</p>
                  <Badge variant="secondary">{RISK_WEIGHTS[key]} pts</Badge>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(RISK_WEIGHTS[key] / totalWeight) * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
                  {FACTOR_DESCRIPTIONS[key]}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {TIER_BANDS.map((band) => (
              <div key={band.tier} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span className="font-semibold">Tier {band.tier}</span>
                <span className="text-xs text-muted-foreground">{band.range}</span>
                <span className="text-xs">{band.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            The same engine accepts an <code className="rounded bg-muted px-1">asOf</code> date, so
            historical snapshots are reproducible. Risk snapshots are stored when a score moves
            materially or when the latest snapshot is over 24 hours old. Snapshot coverage in this
            view: {view.scope.snapshotCoverage.rated}/{view.scope.snapshotCoverage.total} premises.
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Tier distribution</CardTitle>
            <CardDescription>Latest snapshot at the period end.</CardDescription>
          </CardHeader>
          <CardContent>
            <TierDonut data={view.tierDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Risk by category</CardTitle>
            <CardDescription>Premises versus high-risk premises in each category.</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryChart data={view.categoryDistribution} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-base">Findings by severity</CardTitle>
            <CardDescription>Violations in inspections completed this period.</CardDescription>
          </CardHeader>
          <CardContent>
            <SeverityChart data={view.severityDistribution} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <CardTitle className="inline-flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4" /> Premises risk register
              </CardTitle>
              <CardDescription>
                All premises matching the current filters, highest score first. Expand a row to see
                the exact points contributed by each factor.
              </CardDescription>
            </div>
            <Link
              href={`/officer/intelligence/reports${query ? `?${query}` : ""}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Export this view <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <RiskRankingTable rows={view.riskRanking} showFactors />
        </CardContent>
      </Card>

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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <GitBranch className="h-4 w-4" /> Explainability in practice
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              Every score can be decomposed into the five factor budgets. A business can see which
              findings, complaint patterns, inspection gaps, documents or category baseline drove
              its score, and how close each factor is to its cap.
            </p>
            <p>
              Factor contributions are stored with each snapshot. Historical movement is therefore
              auditable even after the underlying records change.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Interpretation limits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>
              The score is a prioritisation aid. It does not estimate the probability of illness,
              and it is not a regulatory determination. Officers must verify records before acting.
            </p>
            <p>
              Category baselines encode policy assumptions. If policy weights change, historical
              snapshots remain on the old weights and should be interpreted with that in mind.
            </p>
            <p>
              Snapshot history in this demo begins six months ago; comparisons beyond that window
              have no baseline.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
