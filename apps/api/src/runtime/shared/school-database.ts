import { mkdirSync } from "node:fs";
import type { DatabaseHandle } from "@/runtime/types";

/** Required for Hyperdrive query caching (see Cloudflare postgres.js docs). */
export const postgresDriverOptions = {
  prepare: true,
  fetch_types: false,
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

export async function createPostgresSchoolDatabase(databaseUrl: string): Promise<DatabaseHandle> {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  const sqlClient = postgres(databaseUrl, postgresDriverOptions);
  return {
    db: drizzle(sqlClient),
    sqlClient,
    async dispose() {
      await sqlClient.end({ timeout: 5 });
    },
  };
}
