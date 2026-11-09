/**
 * Load .env before any module that reads process.env is evaluated.
 * Import this module first in standalone scripts.
 */
try {
  const load = (process as unknown as { loadEnvFile?: (path?: string) => void }).loadEnvFile;
  if (typeof load === "function") load();
} catch {
  // .env is optional; callers can pass DATABASE_URL directly.
}
