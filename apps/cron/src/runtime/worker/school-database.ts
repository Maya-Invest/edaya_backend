import { isPgliteDatabase } from "@edaya/adaptor-postgres";
import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { createPostgresSchoolDatabase } from "@/runtime/shared/school-database";

export async function createSchoolDatabase(env: Environment): Promise<DatabaseHandle> {
  if (isPgliteDatabase(env.DATABASE_URL)) {
    throw new Error("PGlite DATABASE_URL is not supported on the worker runtime. Use Postgres or Hyperdrive.");
  }

  return createPostgresSchoolDatabase(env.DATABASE_URL, { max: 1 });
}
