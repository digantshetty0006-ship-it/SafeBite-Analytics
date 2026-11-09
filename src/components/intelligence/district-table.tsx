import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DistrictMetric } from "@/lib/analytics/kpis";

function num(value: number | null, digits = 0): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function DistrictMetricTable({
  rows,
  selectedDistrict,
}: {
  rows: DistrictMetric[];
  selectedDistrict?: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No districts match these filters.
      </p>
    );
  }
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>District</TableHead>
          <TableHead className="text-right">Premises</TableHead>
          <TableHead className="text-right">High risk</TableHead>
          <TableHead className="text-right">Avg score</TableHead>
          <TableHead className="text-right">Inspections</TableHead>
          <TableHead className="text-right">Findings</TableHead>
          <TableHead className="text-right">Complaints</TableHead>
          <TableHead className="text-right">Resolved</TableHead>
          <TableHead className="text-right">Avg days</TableHead>
          <TableHead className="text-right">SLA met</TableHead>
          <TableHead className="text-right">Overdue</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow
            key={row.district}
            className={cn(selectedDistrict === row.district && "bg-primary/5")}
          >
            <TableCell className="font-medium">
              {row.district}
              {selectedDistrict === row.district && (
                <span className="ml-2 text-[10px] font-semibold uppercase text-primary">selected</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">{row.businesses}</TableCell>
            <TableCell className={cn("text-right tabular-nums", row.highRisk > 0 && "font-semibold text-orange-700 dark:text-orange-400")}>
              {row.highRisk}
            </TableCell>
            <TableCell className="text-right tabular-nums">{num(row.averageRiskScore, 1)}</TableCell>
            <TableCell className="text-right tabular-nums">{row.inspectionsCompleted}</TableCell>
            <TableCell className="text-right tabular-nums">{row.violations}</TableCell>
            <TableCell className="text-right tabular-nums">{row.complaintsReceived}</TableCell>
            <TableCell className="text-right tabular-nums">{row.complaintsResolved}</TableCell>
            <TableCell className="text-right tabular-nums">{num(row.averageResolutionDays, 1)}</TableCell>
            <TableCell className={cn("text-right tabular-nums", (row.slaCompliance ?? 100) < 80 && "text-red-600 dark:text-red-400")}>
              {row.slaCompliance === null ? "—" : `${num(row.slaCompliance, 0)}%`}
            </TableCell>
            <TableCell className={cn("text-right tabular-nums", row.overdueOpen > 0 && "font-semibold text-red-600 dark:text-red-400")}>
              {row.overdueOpen}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
