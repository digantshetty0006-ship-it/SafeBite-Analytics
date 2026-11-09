import Link from "next/link";
import { Filter, RotateCcw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  COMPLAINT_STATUS_OPTIONS,
  GROUPING_OPTIONS,
  INSPECTION_STATUS_OPTIONS,
  PERIOD_OPTIONS,
  RISK_TIER_OPTIONS,
} from "@/lib/analytics/filters";
import type { AnalyticsFilters } from "@/lib/analytics/types";
import { categoryLabel, COMPLAINT_STATUS_LABELS, INSPECTION_STATUS_LABELS } from "@/lib/format";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-2.5 text-sm shadow-none outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

export function AnalyticsFilterBar({
  filters,
  options,
  action,
}: {
  filters: AnalyticsFilters;
  options: { districts: string[]; categories: string[] };
  action: string;
}) {
  const activeCount = [
    filters.district,
    filters.category,
    filters.riskTier,
    filters.complaintStatus,
    filters.inspectionStatus,
  ].filter(Boolean).length;

  return (
    <form
      action={action}
      method="get"
      className="rounded-xl border bg-card p-4 shadow-sm ring-1 ring-foreground/5"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Filter className="h-4 w-4 text-primary" />
          Global filters
          {activeCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {activeCount} active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Filters apply to KPIs, charts, tables and exports on this page.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Field label="Period">
          <select name="period" defaultValue={filters.period} className={selectClass}>
            {PERIOD_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="From (custom)">
          <input
            type="date"
            name="from"
            defaultValue={filters.from}
            className={selectClass}
            aria-label="Custom start date"
          />
        </Field>
        <Field label="To (custom)">
          <input
            type="date"
            name="to"
            defaultValue={filters.to}
            className={selectClass}
            aria-label="Custom end date"
          />
        </Field>
        <Field label="District">
          <select name="district" defaultValue={filters.district} className={selectClass}>
            <option value="">All districts</option>
            {options.districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category">
          <select name="category" defaultValue={filters.category} className={selectClass}>
            <option value="">All categories</option>
            {options.categories.map((category) => (
              <option key={category} value={category}>
                {categoryLabel("en", category)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Risk tier">
          <select name="riskTier" defaultValue={filters.riskTier} className={selectClass}>
            <option value="">All tiers</option>
            {RISK_TIER_OPTIONS.map((tier) => (
              <option key={tier.value} value={tier.value}>
                {tier.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Complaint status">
          <select
            name="complaintStatus"
            defaultValue={filters.complaintStatus}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {COMPLAINT_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {COMPLAINT_STATUS_LABELS[status.value] ?? status.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Inspection status">
          <select
            name="inspectionStatus"
            defaultValue={filters.inspectionStatus}
            className={selectClass}
          >
            <option value="">All statuses</option>
            {INSPECTION_STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>
                {INSPECTION_STATUS_LABELS[status.value] ?? status.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Trend grouping">
          <select name="grouping" defaultValue={filters.grouping} className={selectClass}>
            {GROUPING_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-2 xl:col-span-2">
          <Button type="submit" size="sm" className="h-9">
            <Search className="mr-2 h-4 w-4" />
            Apply filters
          </Button>
          <Button asChild variant="ghost" size="sm" className="h-9">
            <Link href={action}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Link>
          </Button>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Date presets follow Asia/Kolkata (IST) day boundaries. Comparison values use the
        immediately preceding period of equal length. Custom dates are only used when
        “Custom range” is selected.
      </p>
    </form>
  );
}
