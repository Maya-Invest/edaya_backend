import type { Environment } from "@/runtime/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { isPgliteDatabase } from "@edaya/adaptor-postgres";

export async function createDatabase(env: Environment): Promise<DatabaseHandle> {
  if (isPgliteDatabase(env.DATABASE_URL)) {
    throw new Error("PGlite DATABASE_URL is not supported on the worker runtime. Use a Postgres connection string or Hyperdrive.");
  }

  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  const sqlClient = postgres(env.DATABASE_URL, {
    prepare: false,
    max: 1,
  });
  return {
    db: drizzle(sqlClient),
    sqlClient,
    async dispose() {
      await sqlClient.end({ timeout: 5 });
    },
  };
}
