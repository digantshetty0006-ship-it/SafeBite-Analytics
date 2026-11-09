import "./load-env";
import fs from "node:fs";
import path from "node:path";
import { db, isPostgres } from "../src/lib/db";

export type SqlDialect = "sqlite" | "postgres";

export interface SqlQuery {
  name: string;
  description: string;
  params: string[];
  sql: string;
}

export interface SqlParameters {
  fromDate: Date;
  toDate: Date;
  asOf: Date;
  priorDate: Date;
  limit: number;
}

const KNOWN_PARAMS = new Set(["fromDate", "toDate", "asOf", "priorDate", "limit"]);

export const DEFAULT_PARAMETERS: SqlParameters = {
  fromDate: daysAgo(90),
  toDate: new Date(),
  asOf: new Date(),
  priorDate: daysAgo(30),
  limit: 20,
};

export function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function activeDialect(): SqlDialect {
  return isPostgres(process.env.DATABASE_URL ?? "file:./dev.db") ? "postgres" : "sqlite";
}

export function sqlFileFor(dialect: SqlDialect): string {
  return path.join(
    process.cwd(),
    "analytics",
    "sql",
    dialect === "postgres" ? "queries.postgres.sql" : "queries.sqlite.sql"
  );
}

export function parseSqlFile(file: string): SqlQuery[] {
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  const queries: SqlQuery[] = [];
  let current: SqlQuery | null = null;

  const flush = () => {
    if (!current) return;
    current.sql = current.sql.trim();
    if (current.sql) queries.push(current);
    current = null;
  };

  for (const line of lines) {
    const nameMatch = line.match(/^--\s*name:\s*(\S+)\s*$/);
    if (nameMatch) {
      flush();
      current = { name: nameMatch[1], description: "", params: [], sql: "" };
      continue;
    }
    if (!current) continue;

    const description = line.match(/^--\s*description:\s*(.*)$/);
    if (description) {
      current.description = description[1].trim();
      continue;
    }
    const params = line.match(/^--\s*params:\s*(.*)$/);
    if (params) {
      current.params = params[1]
        .split(",")
        .map((value) => value.trim())
        .filter((value) => value.length > 0 && value !== "none");
      continue;
    }
    current.sql += line + "\n";
  }
  flush();
  return queries;
}

/**
 * Convert named parameters to positional placeholders. Values are returned in
 * the order the placeholders appear, so repeated names are bound repeatedly for
 * SQLite and reused through $n for PostgreSQL.
 */
export function bindQuery(
  query: SqlQuery,
  dialect: SqlDialect
): { sql: string; order: string[] } {
  const order: string[] = [];
  const postgresIndex = new Map<string, number>();
  const declared = new Set(query.params);

  const sql = query.sql.replace(/(?<!:):([A-Za-z][A-Za-z0-9_]*)/g, (_match, name: string) => {
    if (!KNOWN_PARAMS.has(name)) {
      throw new Error(`${query.name}: unknown parameter :${name}`);
    }
    if (!declared.has(name)) {
      throw new Error(`${query.name}: :${name} is used but not declared in -- params`);
    }
    if (dialect === "postgres") {
      const existing = postgresIndex.get(name);
      if (existing !== undefined) return `$${existing}`;
      order.push(name);
      postgresIndex.set(name, order.length);
      return `$${order.length}`;
    }
    order.push(name);
    return "?";
  });

  // Declared parameters that never appear are a documentation defect.
  for (const name of query.params) {
    if (!order.includes(name)) {
      throw new Error(`${query.name}: :${name} is declared but not used`);
    }
  }

  return { sql, order };
}

function formatDate(value: Date, dialect: SqlDialect): string {
  const iso = value.toISOString();
  // Prisma SQLite stores ISO-8601 text with a +00:00 offset. Matching the
  // stored representation keeps chronological comparisons exact.
  return dialect === "sqlite" ? iso.replace("Z", "+00:00") : iso;
}

export function valuesFor(order: string[], parameters: SqlParameters, dialect: SqlDialect): unknown[] {
  return order.map((name) => {
    if (name === "limit") return Math.max(1, Math.min(1000, Math.trunc(parameters.limit)));
    const date = parameters[name as keyof SqlParameters];
    if (!(date instanceof Date)) throw new Error(`Unknown parameter: ${name}`);
    return formatDate(date, dialect);
  });
}

export async function runQuery(
  query: SqlQuery,
  parameters: SqlParameters = DEFAULT_PARAMETERS,
  dialect: SqlDialect = activeDialect()
): Promise<Record<string, unknown>[]> {
  const { sql, order } = bindQuery(query, dialect);
  const values = valuesFor(order, parameters, dialect);
  const rows = await db.$queryRawUnsafe<Record<string, unknown>[]>(sql, ...values);
  return rows;
}

export function normalizeResult(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_key, item) => (typeof item === "bigint" ? Number(item) : item))
  );
}

export function describeRows(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "0 rows";
  const columns = Object.keys(rows[0]);
  const first = rows[0];
  const summary = columns
    .slice(0, 5)
    .map((column) => `${column}=${String(first[column] ?? "null")}`)
    .join(", ");
  return `${rows.length} row${rows.length === 1 ? "" : "s"} · ${summary}`;
}

export async function closeDatabase(): Promise<void> {
  await db.$disconnect();
}
