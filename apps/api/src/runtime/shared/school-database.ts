import { mkdirSync } from "node:fs";
import type { DatabaseHandle } from "@/runtime/types";

/** Worker/Hyperdrive pool options for node-postgres (`pg`). */
export const postgresPoolOptions = {
  max: 1,
} as const;

export async function createPgliteSchoolDatabase(dataDir: string | null): Promise<DatabaseHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  if (dataDir) {
    mkdirSync(dataDir, { recursive: true });
  }

  const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
  return {
    db: drizzle(pglite),
    sqlClient: null,
    async dispose() {
      await pglite.close();
    },
  };
}

export async function createPostgresSchoolDatabase(
  databaseUrl: string,
  options: { max?: number } = {},
): Promise<DatabaseHandle> {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { default: pg } = await import("pg");

  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: options.max ?? postgresPoolOptions.max,
  });
  return {
    db: drizzle(pool),
    sqlClient: pool,
    async dispose() {
      await pool.end();
    },
  };
}
