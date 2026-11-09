import "./load-env";
import {
  activeDialect,
  closeDatabase,
  DEFAULT_PARAMETERS,
  describeRows,
  normalizeResult,
  parseSqlFile,
  runQuery,
  sqlFileFor,
  type SqlParameters,
} from "./sql-lib";

interface ParsedArgs {
  command: string;
  name?: string;
  parameters: SqlParameters;
}

function parseDate(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`Invalid date: ${value}`);
  return parsed;
}

function parseArgs(argv: string[]): ParsedArgs {
  const [command = "list", name] = argv;
  const parameters: SqlParameters = { ...DEFAULT_PARAMETERS };
  for (let i = name ? 2 : 1; i < argv.length; i += 1) {
    const raw = argv[i];
    if (!raw.startsWith("--")) continue;
    const equal = raw.indexOf("=");
    const key = (equal >= 0 ? raw.slice(2, equal) : raw.slice(2)).toLowerCase();
    const value = equal >= 0 ? raw.slice(equal + 1) : argv[i + 1];
    if (equal < 0) i += 1;
    switch (key) {
      case "from":
        parameters.fromDate = parseDate(value, parameters.fromDate);
        break;
      case "to":
        parameters.toDate = parseDate(value, parameters.toDate);
        break;
      case "as-of":
      case "asof":
        parameters.asOf = parseDate(value, parameters.asOf);
        break;
      case "prior":
        parameters.priorDate = parseDate(value, parameters.priorDate);
        break;
      case "limit":
        parameters.limit = Number(value);
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }
  return { command, name, parameters };
}

async function main() {
  const { command, name, parameters } = parseArgs(process.argv.slice(2));
  const dialect = activeDialect();
  const file = sqlFileFor(dialect);
  const queries = parseSqlFile(file);
  if (queries.length === 0) throw new Error(`No queries found in ${file}`);

  if (command === "list") {
    console.log(`Dialect: ${dialect}`);
    console.log(`File: ${file}`);
    console.log(`Queries: ${queries.length}\n`);
    for (const query of queries) {
      const params = query.params.length ? ` [${query.params.join(", ")}]` : "";
      console.log(`${query.name}${params}`);
      console.log(`  ${query.description}`);
    }
    return;
  }

  if (command === "run") {
    if (!name) throw new Error("Usage: run-sql.ts run <query-name> [options]");
    const query = queries.find((candidate) => candidate.name === name);
    if (!query) throw new Error(`Unknown query: ${name}`);
    const rows = await runQuery(query, parameters, dialect);
    console.log(JSON.stringify(normalizeResult(rows), null, 2));
    return;
  }

  if (command === "all") {
    console.log(`Running ${queries.length} queries against ${dialect} (${file}).`);
    console.log(
      `Window: ${parameters.fromDate.toISOString()} → ${parameters.toDate.toISOString()} | asOf ${parameters.asOf.toISOString()} | limit ${parameters.limit}\n`
    );
    let failed = 0;
    for (const query of queries) {
      try {
        const rows = await runQuery(query, parameters, dialect);
        console.log(`✓ ${query.name.padEnd(38)} ${describeRows(rows)}`);
      } catch (error) {
        failed += 1;
        console.error(`✗ ${query.name.padEnd(38)} ${(error as Error).message}`);
      }
    }
    console.log(`\n${queries.length - failed}/${queries.length} queries succeeded.`);
    if (failed > 0) process.exitCode = 1;
    return;
  }

  throw new Error(`Unknown command: ${command}. Use list, run or all.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase();
  });
