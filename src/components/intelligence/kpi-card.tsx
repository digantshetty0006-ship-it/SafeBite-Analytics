import { ArrowDownRight, ArrowRight, ArrowUpRight, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatKpiValue, type KpiResult } from "@/lib/analytics/kpis";

function Sparkline({ series }: { series: { label: string; value: number | null }[] }) {
  const points = series
    .map((p, i) => ({ i, value: p.value }))
    .filter((p): p is { i: number; value: number } => p.value !== null && Number.isFinite(p.value));
  if (points.length < 2) {
    return <div className="h-7 text-[10px] text-muted-foreground">Trend needs 2+ periods</div>;
  }
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 120;
  const height = 28;
  const denominator = Math.max(1, series.length - 1);
  const coords = points.map((p) => {
    const x = (p.i / denominator) * width;
    const y = height - 3 - ((p.value - min) / span) * (height - 6);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-full text-primary"
      role="img"
      aria-label="KPI trend"
      preserveAspectRatio="none"
    >
      <polyline
        points={coords.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function comparisonText(kpi: KpiResult): string {
  const { comparison, definition } = kpi;
  if (comparison.previous === null) return "No previous-period baseline";
  if (comparison.direction === "none" || comparison.absolute === null) {
    return `Previous ${formatKpiValue(comparison.previous, definition.unit)}`;
  }
  if (comparison.direction === "flat") {
    return `Unchanged vs ${formatKpiValue(comparison.previous, definition.unit)}`;
  }
  if (comparison.percent !== null) {
    const sign = comparison.percent > 0 ? "+" : "";
    return `${sign}${comparison.percent.toFixed(1)}% vs ${formatKpiValue(
      comparison.previous,
      definition.unit
    )}`;
  }
  const sign = comparison.absolute > 0 ? "+" : "";
  return `${sign}${formatKpiValue(comparison.absolute, definition.unit)} vs previous`;
}

function toneFor(kpi: KpiResult): string {
  if (kpi.comparison.favourable === "up") return "text-emerald-700 dark:text-emerald-400";
  if (kpi.comparison.favourable === "down") return "text-red-700 dark:text-red-400";
  if (kpi.comparison.favourable === "flat") return "text-muted-foreground";
  return "text-muted-foreground";
}

export function KpiCard({ kpi, compact = false }: { kpi: KpiResult; compact?: boolean }) {
  const { definition, comparison } = kpi;
  const Arrow =
    comparison.direction === "up"
      ? ArrowUpRight
      : comparison.direction === "down"
        ? ArrowDownRight
        : ArrowRight;
  const tone = toneFor(kpi);

  return (
    <div
      className="group flex min-w-0 flex-col justify-between rounded-xl border bg-card p-3.5 shadow-sm ring-1 ring-foreground/5 transition-shadow hover:shadow-md"
      title={`${definition.formula}\n\n${definition.description}`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-tight text-muted-foreground">
          {definition.name}
        </p>
        <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" aria-hidden />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {formatKpiValue(kpi.value, definition.unit)}
        </p>
        {!compact && (
          <BadgeLike>
            {definition.measurement === "event" ? "Period" : "As of end"}
          </BadgeLike>
        )}
      </div>
      <div className={cn("mt-1.5 flex items-center gap-1 text-[11px] leading-tight", tone)}>
        <Arrow className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate" title={comparisonText(kpi)}>
          {comparisonText(kpi)}
        </span>
      </div>
      <div className="mt-2 opacity-80">
        <Sparkline series={kpi.series} />
      </div>
    </div>
  );
}

function BadgeLike({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}
