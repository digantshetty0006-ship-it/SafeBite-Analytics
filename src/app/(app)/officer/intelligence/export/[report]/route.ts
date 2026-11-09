import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { loadAnalyticsDataset } from "@/lib/analytics/data";
import { buildAnalyticsView } from "@/lib/analytics/kpis";
import {
  buildReportSummary,
  complaintCsvRows,
  districtCsvRows,
  inspectionCsvRows,
  processCsvRows,
  qualityCsvRows,
  reportFilename,
  riskCsvRows,
  rowsToCsv,
  summaryCsvRows,
} from "@/lib/analytics/reports";
import { runDataQualityChecks } from "@/lib/quality";
import { buildProcessReport } from "@/lib/process";

export const dynamic = "force-dynamic";

const REPORTS = new Set([
  "summary",
  "risk",
  "districts",
  "complaints",
  "inspections",
  "quality",
  "process",
]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ report: string }> }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "food_officer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { report } = await params;
  if (!REPORTS.has(report)) {
    return NextResponse.json({ error: "Unknown report" }, { status: 404 });
  }

  const url = new URL(request.url);
  const searchParams: Record<string, string> = {};
  for (const [key, value] of url.searchParams.entries()) searchParams[key] = value;

  if (report === "quality") {
    const quality = await runDataQualityChecks();
    const csv = rowsToCsv(qualityCsvRows(quality));
    return csvResponse(csv, `safebite_data_quality_${new Date().toISOString().slice(0, 10)}.csv`);
  }

  const dataset = await loadAnalyticsDataset(searchParams);
  if (report === "process") {
    const process = buildProcessReport(dataset);
    const csv = rowsToCsv(processCsvRows(process));
    return csvResponse(csv, reportFilename("process_efficiency", dataset));
  }

  const view = buildAnalyticsView(dataset);
  let rows;
  switch (report) {
    case "risk":
      rows = riskCsvRows(view);
      break;
    case "districts":
      rows = districtCsvRows(view);
      break;
    case "complaints":
      rows = complaintCsvRows(dataset);
      break;
    case "inspections":
      rows = inspectionCsvRows(dataset);
      break;
    case "summary":
    default:
      rows = summaryCsvRows(buildReportSummary(dataset, view, user.name));
      break;
  }

  return csvResponse(rowsToCsv(rows), reportFilename(report, dataset));
}

function csvResponse(csv: string, filename: string): NextResponse {
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
