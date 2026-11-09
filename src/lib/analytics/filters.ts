import type { AnalyticsFilters, AnalyticsSearchParams, PeriodKey, ResolvedPeriod, TrendGrouping } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export const PERIOD_OPTIONS: { key: PeriodKey; label: string; short: string }[] = [
  { key: "last7", label: "Last 7 days", short: "7D" },
  { key: "last30", label: "Last 30 days", short: "30D" },
  { key: "last90", label: "Last 90 days", short: "90D" },
  { key: "current_month", label: "Current month", short: "MTD" },
  { key: "previous_month", label: "Previous month", short: "PM" },
  { key: "custom", label: "Custom range", short: "Custom" },
];

export const COMPLAINT_STATUS_OPTIONS = [
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "inspection_scheduled", label: "Inspection scheduled" },
  { value: "resolved", label: "Resolved" },
];

export const INSPECTION_STATUS_OPTIONS = [
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
];

export const RISK_TIER_OPTIONS = [
  { value: "A", label: "A — Low" },
  { value: "B", label: "B — Moderate" },
  { value: "C", label: "C — High" },
  { value: "D", label: "D — Critical" },
];

export const GROUPING_OPTIONS: { value: TrendGrouping; label: string }[] = [
  { value: "day", label: "Daily" },
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
];

function one(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function clean(value: string, max = 80): string {
  return value.trim().slice(0, max);
}

function safePeriod(value: string): PeriodKey {
  return PERIOD_OPTIONS.some((o) => o.key === value) ? (value as PeriodKey) : "last30";
}

function safeGrouping(value: string): TrendGrouping | "" {
  return value === "day" || value === "week" || value === "month" ? value : "";
}

export function parseAnalyticsFilters(params: AnalyticsSearchParams): AnalyticsFilters {
  return {
    period: safePeriod(clean(one(params.period), 30)),
    from: clean(one(params.from), 20),
    to: clean(one(params.to), 20),
    district: clean(one(params.district)),
    category: clean(one(params.category)),
    riskTier: clean(one(params.riskTier), 2).toUpperCase(),
    complaintStatus: clean(one(params.complaintStatus), 40),
    inspectionStatus: clean(one(params.inspectionStatus), 40),
    grouping: (safeGrouping(clean(one(params.grouping), 10)) || "day") as TrendGrouping,
  };
}

export function istDateKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function startOfIstDay(value: string | Date): Date {
  if (value instanceof Date) return startOfIstDay(istDateKey(value));
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : istDateKey(new Date());
  return new Date(`${iso}T00:00:00+05:30`);
}

export function endOfIstDay(value: string | Date): Date {
  return new Date(startOfIstDay(value).getTime() + DAY_MS);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function startOfIstMonth(date: Date): Date {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), 1) - IST_OFFSET_MS);
}

export function addMonths(date: Date, months: number): Date {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + months, 1) - IST_OFFSET_MS
  );
}

export function istMonthKey(date: Date): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 7);
}

export function istWeekStart(date: Date): Date {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  const day = shifted.getUTCDay();
  const diff = day === 0 ? 6 : day - 1; // Monday-start weeks
  return startOfIstDay(
    new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate() - diff))
      .toISOString()
      .slice(0, 10)
  );
}

export function formatIstDate(date: Date, opts: Intl.DateTimeFormatOptions = {}): string {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
    ...opts,
  });
}

export function formatIstDateTime(date: Date): string {
  return date.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
}

function autoGrouping(days: number): TrendGrouping {
  if (days <= 31) return "day";
  if (days <= 120) return "week";
  return "month";
}

export function resolvePeriod(filters: AnalyticsFilters, now: Date = new Date()): ResolvedPeriod {
  let start: Date;
  let end: Date;
  let custom = false;
  let key = filters.period;

  switch (filters.period) {
    case "last7":
    case "last30":
    case "last90": {
      const days = filters.period === "last7" ? 7 : filters.period === "last30" ? 30 : 90;
      start = addDays(startOfIstDay(now), -(days - 1));
      end = now;
      break;
    }
    case "current_month": {
      start = startOfIstMonth(now);
      end = now;
      break;
    }
    case "previous_month": {
      const thisMonth = startOfIstMonth(now);
      start = addMonths(thisMonth, -1);
      end = thisMonth;
      break;
    }
    case "custom": {
      custom = true;
      const from = /^\d{4}-\d{2}-\d{2}$/.test(filters.from) ? filters.from : null;
      const to = /^\d{4}-\d{2}-\d{2}$/.test(filters.to) ? filters.to : null;
      if (from && to) {
        const fromDate = startOfIstDay(from);
        const toDate = endOfIstDay(to);
        start = fromDate <= toDate ? fromDate : toDate;
        end = fromDate <= toDate ? toDate : fromDate;
      } else {
        start = addDays(startOfIstDay(now), -29);
        end = now;
        key = "last30";
        custom = false;
      }
      break;
    }
    default: {
      start = addDays(startOfIstDay(now), -29);
      end = now;
      key = "last30";
    }
  }

  const durationMs = Math.max(DAY_MS, end.getTime() - start.getTime());
  const previousEnd = start;
  const previousStart = new Date(start.getTime() - durationMs);
  const days = Math.max(1, Math.ceil(durationMs / DAY_MS));
  const grouping =
    filters.grouping && (filters.period !== "custom" || filters.grouping !== "day")
      ? filters.grouping
      : autoGrouping(days);

  const inclusiveEnd = new Date(end.getTime() - 1);
  const previousInclusiveEnd = new Date(previousEnd.getTime() - 1);

  return {
    key,
    start,
    end,
    previousStart,
    previousEnd,
    label: `${formatIstDate(start)} – ${formatIstDate(inclusiveEnd)}`,
    previousLabel: `${formatIstDate(previousStart)} – ${formatIstDate(previousInclusiveEnd)}`,
    days,
    grouping,
    custom,
  };
}

export function inRange(date: Date | null | undefined, start: Date, end: Date): boolean {
  return !!date && date >= start && date < end;
}

export function pct(numerator: number, denominator: number): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return null;
  return (numerator / denominator) * 100;
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/** Format a date from a query string, with a safe fallback. */
export function filtersToQuery(filters: AnalyticsFilters): string {
  const qs = new URLSearchParams();
  qs.set("period", filters.period);
  if (filters.from) qs.set("from", filters.from);
  if (filters.to) qs.set("to", filters.to);
  if (filters.district) qs.set("district", filters.district);
  if (filters.category) qs.set("category", filters.category);
  if (filters.riskTier) qs.set("riskTier", filters.riskTier);
  if (filters.complaintStatus) qs.set("complaintStatus", filters.complaintStatus);
  if (filters.inspectionStatus) qs.set("inspectionStatus", filters.inspectionStatus);
  if (filters.grouping) qs.set("grouping", filters.grouping);
  return qs.toString();
}

export function withFilters(path: string, filters: AnalyticsFilters, extra?: Record<string, string>): string {
  const qs = new URLSearchParams(filtersToQuery(filters));
  if (extra) for (const [k, v] of Object.entries(extra)) qs.set(k, v);
  return `${path}?${qs.toString()}`;
}

export function isPresetRange(filters: AnalyticsFilters): boolean {
  return filters.period !== "custom";
}
