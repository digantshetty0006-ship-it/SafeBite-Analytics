export type PeriodKey =
  | "last7"
  | "last30"
  | "last90"
  | "current_month"
  | "previous_month"
  | "custom";

export type TrendGrouping = "day" | "week" | "month";

export interface AnalyticsFilters {
  period: PeriodKey;
  from: string;
  to: string;
  district: string;
  category: string;
  riskTier: string;
  complaintStatus: string;
  inspectionStatus: string;
  grouping: TrendGrouping;
}

export interface ResolvedPeriod {
  key: PeriodKey;
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
  label: string;
  previousLabel: string;
  days: number;
  /** Grouping actually used after applying the range-based default. */
  grouping: TrendGrouping;
  custom: boolean;
}

export type AnalyticsSearchParams = Record<string, string | string[] | undefined>;

export interface BusinessComplaintRecord {
  id: string;
  businessId: string | null;
  status: string;
  assignedOfficerId: string | null;
  anonymous: boolean;
  type: string | null;
  district: string | null;
  createdAt: Date;
  assignedAt: Date | null;
  investigationStartedAt: Date | null;
  inspectionAt: Date | null;
  resolvedAt: Date | null;
  slaDays: number;
  business: {
    id: string;
    name: string;
    district: string;
    category: string;
    riskTier: string;
  } | null;
  assignedOfficer: { id: string; name: string } | null;
}

export interface BusinessInspectionRecord {
  id: string;
  businessId: string;
  officerId: string;
  status: string;
  scheduledAt: Date;
  completedAt: Date | null;
  business: {
    id: string;
    name: string;
    district: string;
    category: string;
    riskTier: string;
  };
  officer: { id: string; name: string } | null;
  violations: { id: string; type: string; severity: string; description: string }[];
}

export interface BusinessAnalyticsRecord {
  id: string;
  name: string;
  category: string;
  district: string;
  licenseNumber: string;
  status: string;
  riskScore: number;
  riskTier: string;
  registeredAt: Date;
}

export interface RiskSnapshotRecord {
  id: string;
  businessId: string;
  score: number;
  tier: string;
  factors: Record<string, number>;
  snapshotAt: Date;
}

export interface AnalyticsDataset {
  filters: AnalyticsFilters;
  period: ResolvedPeriod;
  generatedAt: Date;
  businesses: BusinessAnalyticsRecord[];
  complaints: BusinessComplaintRecord[];
  inspections: BusinessInspectionRecord[];
  snapshots: RiskSnapshotRecord[];
  options: {
    districts: string[];
    categories: string[];
    complaintTypes: string[];
    officers: { id: string; name: string }[];
  };
}
