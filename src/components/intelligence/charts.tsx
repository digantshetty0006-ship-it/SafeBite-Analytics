"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DistributionSlice } from "@/lib/analytics/kpis";
import type { DistrictMetric } from "@/lib/analytics/kpis";

const TIER_COLORS: Record<string, string> = {
  A: "#10b981",
  B: "#f59e0b",
  C: "#f97316",
  D: "#ef4444",
};

const SEVERITY_COLORS: Record<string, string> = {
  low: "#94a3b8",
  medium: "#f59e0b",
  high: "#f97316",
  critical: "#ef4444",
};

const TOOLTIP_STYLE = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--popover-foreground)",
  fontSize: 12,
} as const;

const AXIS = { fontSize: 11 } as const;

export interface TrendDatum {
  label: string;
  received: number;
  resolved: number;
  inspections: number;
  violations: number;
}

function EmptyChart({ height, message }: { height: number; message: string }) {
  return (
    <div
      className="flex items-center justify-center rounded-lg border border-dashed text-xs text-muted-foreground"
      style={{ height }}
    >
      {message}
    </div>
  );
}

export function ActivityTrendChart({ data }: { data: TrendDatum[] }) {
  if (!data.length) return <EmptyChart height={280} message="No activity in this period." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="receivedFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="received"
          name="Complaints received"
          stroke="#6366f1"
          strokeWidth={2}
          fill="url(#receivedFill)"
        />
        <Area
          type="monotone"
          dataKey="resolved"
          name="Complaints resolved"
          stroke="#10b981"
          strokeWidth={2}
          fillOpacity={0}
        />
        <Area
          type="monotone"
          dataKey="inspections"
          name="Inspections completed"
          stroke="#0ea5e9"
          strokeWidth={2}
          fillOpacity={0}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function ViolationsTrendChart({ data }: { data: TrendDatum[] }) {
  if (!data.length) return <EmptyChart height={260} message="No violations in this period." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Bar dataKey="violations" name="Violations found" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TierDonut({ data }: { data: DistributionSlice[] }) {
  const visible = data.filter((d) => d.count > 0);
  if (!visible.length) return <EmptyChart height={240} message="No rated premises." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={visible}
          dataKey="count"
          nameKey="label"
          innerRadius={52}
          outerRadius={88}
          paddingAngle={2}
        >
          {visible.map((entry) => (
            <Cell key={entry.key} fill={TIER_COLORS[entry.key] ?? "#94a3b8"} />
          ))}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function CategoryChart({ data }: { data: DistributionSlice[] }) {
  if (!data.length) return <EmptyChart height={260} message="No businesses in scope." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          interval={0}
          angle={-22}
          textAnchor="end"
          height={58}
        />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="count" name="Premises" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
        <Bar dataKey="secondary" name="High-risk (C+D)" fill="#ef4444" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ComplaintTypeChart({ data }: { data: DistributionSlice[] }) {
  if (!data.length) return <EmptyChart height={260} message="No complaints in this period." />;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart
        data={data.slice(0, 10)}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Bar dataKey="count" name="Complaints" fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SeverityChart({ data }: { data: DistributionSlice[] }) {
  if (!data.length) return <EmptyChart height={240} message="No violation findings." />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Bar dataKey="count" name="Findings" radius={[4, 4, 0, 0]}>
          {data.map((entry) => (
            <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key] ?? "#94a3b8"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DistrictRiskChart({ data }: { data: DistrictMetric[] }) {  if (!data.length) return <EmptyChart height={280} message="No districts in scope." />;
  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="district" tick={AXIS} tickLine={false} axisLine={false} interval={0} />
        <YAxis yAxisId="score" domain={[0, 100]} tick={AXIS} tickLine={false} axisLine={false} />
        <YAxis
          yAxisId="count"
          orientation="right"
          tick={AXIS}
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar
          yAxisId="score"
          dataKey="averageRiskScore"
          name="Average risk score"
          fill="#0ea5e9"
          radius={[4, 4, 0, 0]}
        />
        <Line
          yAxisId="count"
          type="monotone"
          dataKey="overdueOpen"
          name="Overdue open complaints"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function ProcessStageChart({
  data,
}: {
  data: { label: string; medianDays: number | null; p90Days: number | null; sampleSize: number }[];
}) {
  const visible = data.filter((d) => d.medianDays !== null);
  if (!visible.length) {
    return <EmptyChart height={300} message="No valid stage timestamps in this period." />;
  }
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={visible}
        layout="vertical"
        margin={{ top: 8, right: 24, left: 16, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis type="number" tick={AXIS} tickLine={false} axisLine={false} unit="d" />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={190}
        />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_STYLE} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar dataKey="medianDays" name="Median days" fill="#0ea5e9" radius={[0, 4, 4, 0]} />
        <Bar dataKey="p90Days" name="90th percentile" fill="#f59e0b" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
