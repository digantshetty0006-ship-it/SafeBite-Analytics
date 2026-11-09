import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaPg } from "@prisma/adapter-pg";
import path from "path";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Resolve a Prisma `file:./dev.db` URL to an absolute sqlite path.
 * With Prisma 7 config mode, `file:` URLs resolve relative to the project
 * root (process.cwd()), which is where migrations create the database.
 */
export function resolveDatabaseUrl(url: string): string {
  if (!url.startsWith("file:")) return url;
  let file = url.slice("file:".length);
  if (file.startsWith("./")) {
    file = path.resolve(/*turbopackIgnore: true*/ process.cwd(), file.slice(2));
  }
  return file;
}

export function isPostgres(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

const url = process.env.DATABASE_URL ?? "file:./dev.db";

const adapter = isPostgres(url)
  ? new PrismaPg({ connectionString: url })
  : new PrismaBetterSqlite3({
      url: resolveDatabaseUrl(url),
      // Vercel's serverless filesystem is read-only. Open the bundled demo
      // database in read-only mode there; local development stays writable.
      readonly: process.env.VERCEL === "1",
    });

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
