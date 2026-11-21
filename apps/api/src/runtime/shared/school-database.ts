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
  // Drizzle recognizes its own pg.Pool and leases a connection per transaction.
  const db = drizzle<Record<string, never>>({
    connection: { connectionString: databaseUrl, max: options.max ?? postgresPoolOptions.max },
  });
  return {
    db,
    sqlClient: db.$client,
    async dispose() {
      await db.$client.end();
    },
  };
}
