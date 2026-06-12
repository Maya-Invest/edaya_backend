import type { Environment } from "@/lib/runtime/env";
import { isEphemeralDatabase } from "@/lib/runtime/database-url";

export interface DatabaseHandle {
  db: unknown;
  sqlClient: unknown | null;
  dispose: () => Promise<void>;
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
      async dispose() {
        await pglite.close();
      },
    };
  }

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  const sqlClient = postgres(env.DATABASE_URL, {
    prepare: false,
    max: env.RUNTIME === "worker" ? 1 : undefined,
  });
  return {
    db: drizzle(sqlClient),
    sqlClient,
    async dispose() {
      await sqlClient.end({ timeout: 5 });
    },
  };
}
