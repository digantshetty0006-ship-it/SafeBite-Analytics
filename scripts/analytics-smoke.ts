/**
 * Server-side smoke check for the analytics engine.
 * Run with: npx tsx scripts/analytics-smoke.ts
 */
import { loadAnalyticsDataset } from "../src/lib/analytics/data";
import { buildAnalyticsView } from "../src/lib/analytics/kpis";
import { db } from "../src/lib/db";

async function main() {
  const params: Record<string, string> = { period: "last90", grouping: "week" };
  if (process.argv[2]) params.district = process.argv[2];
  const dataset = await loadAnalyticsDataset(params);
  const view = buildAnalyticsView(dataset);

  console.log("Period:", dataset.period.label, "vs", dataset.period.previousLabel);
  console.log(
    "Scope:",
    view.scope.businesses,
    "businesses /",
    view.scope.complaints,
    "complaints /",
    view.scope.inspections,
    "inspections"
  );
  for (const kpi of view.kpis) {
    console.log(
      `${kpi.definition.id.padEnd(28)} ${String(kpi.value).padStart(9)}  prev ${String(
        kpi.previous
      ).padStart(9)}  ${kpi.comparison.favourable}`
    );
  }
  console.log("Trend points:", view.trend.complaintsReceived.length);
  console.log("Districts:", view.districts.length);
  console.log("Ranking top 3:", view.riskRanking.slice(0, 3).map((r) => `${r.name}=${r.score}`));
  console.log("Notes:", view.notes);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
