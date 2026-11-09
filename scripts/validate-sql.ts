import "./load-env";
import {
  activeDialect,
  closeDatabase,
  DEFAULT_PARAMETERS,
  parseSqlFile,
  runQuery,
  sqlFileFor,
  type SqlQuery,
} from "./sql-lib";

/**
 * Structural and execution validation for the documented SQL library.
 *
 * 1. Both dialect files must expose the same query names and parameters.
 * 2. Every query must be documented and use only supported named parameters.
 * 3. Every SQLite query must execute against the seeded database.
 * 4. Key queries must return their documented result columns.
 */

const EXPECTED_COLUMNS: Record<string, string[]> = {
  kpi_registered_businesses: ["registeredBusinesses"],
  kpi_high_risk_premises: ["id", "name", "district", "tier", "score"],
  kpi_average_risk_score: ["averageRiskScore", "ratedBusinesses"],
  kpi_inspections_completed: ["inspectionsCompleted"],
  kpi_inspection_completion_rate: ["dueInspections", "completionRatePercent"],
  kpi_critical_violations: ["findings", "criticalFindings"],
  kpi_violations_per_inspection: ["inspectionsCompleted", "violationsPerInspection"],
  kpi_repeat_violation_rate: ["findings", "repeatFindings", "repeatRatePercent"],
  kpi_complaints_received: ["complaintsReceived"],
  kpi_complaints_resolved: ["complaintsResolved"],
  kpi_average_resolution_days: ["evaluatedResolutions", "averageResolutionDays"],
  kpi_sla_compliance: ["evaluatedResolutions", "withinSla", "slaCompliancePercent"],
  kpi_overdue_open_complaints: ["overdueOpen"],
  risk_tier_distribution: ["tier", "businesses", "averageScore"],
  risk_score_history: ["month", "ratedBusinesses", "averageScore"],
  risk_score_movers: ["name", "currentScore", "priorScore", "scoreChange"],
  district_scorecard: ["district", "premises", "highRiskPremises", "overdueOpen"],
  complaint_type_distribution: ["complaintType", "complaints"],
  violation_severity_distribution: ["severity", "findings"],
  complaint_stage_durations: ["stage", "samples", "averageDays"],
  inspection_turnaround_by_district: ["district", "averageTurnaroundDays"],
  inspection_overdue_backlog: ["district", "overdueInspections"],
  data_quality_lifecycle_anomalies: ["id", "status", "issue"],
  data_quality_duplicate_licences: ["name", "licenseNumber", "duplicates"],
  supplier_licence_coverage: ["suppliers", "missingLicence", "withLicence"],
  expired_documents_by_type: ["type", "expiredDocuments"],
};

function compareDialects(sqlite: SqlQuery[], postgres: SqlQuery[]): string[] {
  const problems: string[] = [];
  const postgresByName = new Map(postgres.map((query) => [query.name, query]));

  for (const query of sqlite) {
    const counterpart = postgresByName.get(query.name);
    if (!counterpart) {
      problems.push(`PostgreSQL file is missing query: ${query.name}`);
      continue;
    }
    postgresByName.delete(query.name);
    if (query.params.join(",") !== counterpart.params.join(",")) {
      problems.push(
        `${query.name}: parameter mismatch (sqlite: ${query.params.join(", ") || "none"}; postgres: ${
          counterpart.params.join(", ") || "none"
        })`
      );
    }
  }
  for (const extra of postgresByName.keys()) {
    problems.push(`SQLite file is missing query: ${extra}`);
  }
  return problems;
}

async function main() {
  const dialect = activeDialect();
  const sqlite = parseSqlFile(sqlFileFor("sqlite"));
  const postgres = parseSqlFile(sqlFileFor("postgres"));
  const problems: string[] = [];

  if (sqlite.length < 15) {
    problems.push(`Expected at least 15 documented queries, found ${sqlite.length}.`);
  }
  problems.push(...compareDialects(sqlite, postgres));

  const seen = new Set<string>();
  for (const query of sqlite) {
    if (seen.has(query.name)) problems.push(`Duplicate query name: ${query.name}`);
    seen.add(query.name);
    if (!query.description) problems.push(`${query.name}: missing -- description`);
    if (!EXPECTED_COLUMNS[query.name]) {
      problems.push(`${query.name}: no documented expected columns in the validator`);
    }
    if (!query.sql.includes(":")) {
      console.log(`! ${query.name}: no named parameter (verify this is intentional)`);
    }
  }
  for (const query of postgres) {
    if (!query.description) problems.push(`${query.name}: PostgreSQL description missing`);
  }

  console.log(`Dialect in use: ${dialect}`);
  console.log(`SQLite queries: ${sqlite.length} · PostgreSQL queries: ${postgres.length}`);

  if (dialect !== "sqlite") {
    problems.push(
      "Execution validation requires the SQLite demo database. Set DATABASE_URL=file:./dev.db."
    );
  }

  let executed = 0;
  let emptyCoreQueries = 0;
  for (const query of sqlite) {
    const columns = EXPECTED_COLUMNS[query.name];
    if (!columns) continue;
    try {
      const rows = await runQuery(query, DEFAULT_PARAMETERS, "sqlite");
      executed += 1;
      if (rows.length === 0) {
        console.log(`· ${query.name}: 0 rows (acceptable only for sparse demo periods)`);
      }
      if (rows.length > 0) {
        for (const column of columns) {
          if (!(column in rows[0])) {
            problems.push(`${query.name}: expected column "${column}" was not returned`);
          }
        }
      }
      if (
        rows.length === 0 &&
        /^kpi_|^district_scorecard$|^risk_tier_distribution$|^supplier_licence_coverage$/.test(
          query.name
        )
      ) {
        emptyCoreQueries += 1;
      }
    } catch (error) {
      problems.push(`${query.name}: execution failed — ${(error as Error).message}`);
    }
  }

  if (emptyCoreQueries > 0) {
    problems.push(
      `${emptyCoreQueries} core aggregation query/queries returned no rows. Seed the database first.`
    );
  }

  console.log(`Executed ${executed} queries against the seeded database.`);

  if (problems.length > 0) {
    console.error("\nSQL validation failed:");
    for (const problem of problems) console.error(`- ${problem}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nSQL validation passed: dialects are in parity and all queries execute.");
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
