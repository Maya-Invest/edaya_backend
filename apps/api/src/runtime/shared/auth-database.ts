import type { DatabaseHandle } from "@/runtime/types";
import { runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { isPgliteDatabase, resolveMigrationDriver } from "@edaya/adaptor-postgres";
import { createPostgresSchoolDatabase } from "@/runtime/shared/school-database";

export interface AttachAuthDatabaseOptions {
  databaseUrl: string;
  runMigrations?: boolean;
  ownership?: "borrowed" | "owned";
}

/** Reuse an existing Postgres/PGlite handle for Better Auth tables in the `auth` schema. */
export async function attachAuthDatabase(
  handle: DatabaseHandle,
  options: AttachAuthDatabaseOptions,
): Promise<DatabaseHandle> {
  let disposal: Promise<void> | undefined;
  const dispose = () => disposal ??= Promise.resolve().then(() => handle.dispose());
  try {
    if (options.runMigrations) {
      await runAuthMigrations(handle.db, {
        driver: resolveMigrationDriver(options.databaseUrl),
      });
    }
  }
  catch (error) {
    if (options.ownership === "owned") {
      await dispose();
    }
    throw error;
  }

  return {
    db: handle.db,
    sqlClient: handle.sqlClient,
    dispose: options.ownership === "owned" ? dispose : async () => {},
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
    ownership: "owned",
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
    ownership: "owned",
    runMigrations: options.runMigrations,
  });
}
