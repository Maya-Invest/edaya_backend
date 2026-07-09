import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { createPostgresSchoolDatabase, postgresPoolOptions } from "@/runtime/shared/school-database";
import { isPgliteDatabase } from "@edaya/adaptor-postgres";

export async function createSchoolDatabase(env: Environment): Promise<DatabaseHandle> {
  if (isPgliteDatabase(env.DATABASE_URL)) {
    throw new Error("PGlite DATABASE_URL is not supported on the worker runtime. Use a Postgres connection string or Hyperdrive.");
  }

  return createPostgresSchoolDatabase(env.DATABASE_URL, postgresPoolOptions);
}
