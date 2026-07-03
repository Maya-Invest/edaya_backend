import { runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { isPgliteDatabase, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import type { DatabaseHandle } from "@/runtime/types";
import { createPostgresSchoolDatabase, postgresDriverOptions } from "@/runtime/shared/school-database";

export interface AttachAuthDatabaseOptions {
  databaseUrl: string;
  runMigrations?: boolean;
}

/** Reuse an existing Postgres/PGlite handle for Better Auth tables in the `auth` schema. */
export async function attachAuthDatabase(
  handle: DatabaseHandle,
  options: AttachAuthDatabaseOptions,
): Promise<DatabaseHandle> {
  if (options.runMigrations) {
    await runAuthMigrations(handle.db, {
      driver: resolveMigrationDriver(options.databaseUrl),
    });
  }

  return {
    db: handle.db,
    sqlClient: handle.sqlClient,
    dispose: async () => {},
  };
}

/** Standalone Postgres auth database (worker runtime and tests). */
export async function createPostgresAuthDatabase(
  databaseUrl: string,
  options: { runMigrations?: boolean } = {},
): Promise<DatabaseHandle> {
  if (isPgliteDatabase(databaseUrl)) {
    throw new Error("createPostgresAuthDatabase() requires a Postgres connection string.");
  }

  const handle = await createPostgresSchoolDatabase(databaseUrl);
  return attachAuthDatabase(handle, {
    databaseUrl,
    runMigrations: options.runMigrations,
  });
}

export async function createPgliteAuthDatabase(
  dataDir: string | null,
  options: { runMigrations?: boolean } = {},
): Promise<DatabaseHandle> {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
  const handle: DatabaseHandle = {
    db: drizzle(pglite),
    sqlClient: null,
    async dispose() {
      await pglite.close();
    },
  };

  const databaseUrl = dataDir ? `pglite:${dataDir}` : "pglite";
  return attachAuthDatabase(handle, {
    databaseUrl,
    runMigrations: options.runMigrations,
  });
}

export { postgresDriverOptions };
