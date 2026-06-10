import type { Environment } from "@/lib/bootstrap/env";
import { isEphemeralDatabase } from "@/lib/seed";

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
}

export async function createDatabase(env: Environment): Promise<DatabaseHandle> {
  if (env.RUNTIME === "worker" && isEphemeralDatabase(env.DATABASE_URL)) {
    throw new Error("In-memory DATABASE_URL (pglite/memory) is not supported on the worker runtime. Use a Postgres connection string or Hyperdrive.");
  }

  if (isEphemeralDatabase(env.DATABASE_URL)) {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");

    const pglite = new PGlite();
    return {
      db: drizzle(pglite),
      sqlClient: null,
    };
  }

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  const sqlClient = postgres(env.DATABASE_URL);
  return {
    db: drizzle(sqlClient),
    sqlClient,
  };
}
