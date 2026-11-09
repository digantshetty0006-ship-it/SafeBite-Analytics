import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { RiskScoreBar } from "@/components/risk-badge";
import { cn } from "@/lib/utils";
import type { RiskRankingRow } from "@/lib/analytics/kpis";
import { categoryLabel } from "@/lib/format";

const TIER_STYLES: Record<string, string> = {
  A: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  B: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
  C: "border-orange-300 bg-orange-100 text-orange-800 dark:border-orange-800 dark:bg-orange-950 dark:text-orange-300",
  D: "border-red-300 bg-red-100 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-300",
};

const TIER_LABEL: Record<string, string> = {
  A: "A · Low",
  B: "B · Moderate",
  C: "C · High",
  D: "D · Critical",
};

export function RiskRankingTable({
  rows,
  limit,
  showFactors = false,
}: {
  rows: RiskRankingRow[];
  limit?: number;
  showFactors?: boolean;
}) {
  const visible = typeof limit === "number" ? rows.slice(0, limit) : rows;
  if (visible.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No premises match these filters.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">#</TableHead>
          <TableHead>Business</TableHead>
          <TableHead className="hidden md:table-cell">District</TableHead>
          <TableHead className="hidden lg:table-cell">Category</TableHead>
          <TableHead className="min-w-36">Risk score</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead className="text-right">30-day move</TableHead>
          <TableHead className="hidden xl:table-cell">Top driver</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {visible.map((row, index) => (
          <TableRow key={row.id}>
            <TableCell className="text-xs text-muted-foreground tabular-nums">{index + 1}</TableCell>
            <TableCell>
              <div className="min-w-0">
                <Link
                  href={`/officer/business/${row.id}`}
                  className="block truncate font-medium hover:text-primary hover:underline"
                >
                  {row.name}
                </Link>
                <p className="truncate font-mono text-[11px] text-muted-foreground">
                  {row.licenseNumber}
                </p>
                {showFactors && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-[11px] font-medium text-primary">
                      Factor breakdown
                    </summary>
                    <div className="mt-2 w-56 space-y-1.5 rounded-lg border bg-muted/30 p-2">
                      {row.factors.map((factor) => (
                        <div key={factor.key} className="text-[11px]">
                          <div className="mb-0.5 flex justify-between gap-2">
                            <span className="truncate text-muted-foreground">{factor.label}</span>
                            <span className="font-mono tabular-nums">
                              {factor.points.toFixed(1)}/{factor.max}
                            </span>
                          </div>
                          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-primary/70"
                              style={{
                                width: `${Math.min(100, (factor.points / factor.max) * 100)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <p className="pt-1 text-[10px] leading-snug text-muted-foreground">
                        Weighted rule points. Total is clamped to 0–100.
                      </p>
                    </div>
                  </details>
                )}
              </div>
            </TableCell>
            <TableCell className="hidden md:table-cell">{row.district}</TableCell>
            <TableCell className="hidden lg:table-cell">
              {categoryLabel("en", row.category)}
            </TableCell>
            <TableCell>
              <RiskScoreBar score={row.score} />
            </TableCell>
            <TableCell>
              <Badge variant="outline" className={cn("whitespace-nowrap text-[10px]", TIER_STYLES[row.tier])}>
                {TIER_LABEL[row.tier] ?? row.tier}
              </Badge>
            </TableCell>
            <TableCell className="text-right">
              <Delta value={row.scoreDelta} />
            </TableCell>
            <TableCell className="hidden max-w-44 truncate text-xs text-muted-foreground xl:table-cell">
              {row.topFactor ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-xs text-muted-foreground">—</span>;
  if (Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center justify-end gap-1 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  }
  const worse = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1 font-mono text-xs font-medium tabular-nums",
        worse ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"
      )}
      title={worse ? "Risk increased over 30 days" : "Risk reduced over 30 days"}
    >
      {worse ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {worse ? "+" : ""}
      {value.toFixed(1)}
    </span>
  );
}
