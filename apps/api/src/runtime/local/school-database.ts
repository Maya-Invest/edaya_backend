import { isPgliteDatabase, resolvePgliteDataDir } from "@edaya/adaptor-postgres";
import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import {
  createPgliteSchoolDatabase,
  createPostgresSchoolDatabase,
} from "@/runtime/shared/school-database";

export async function createSchoolDatabase(env: Environment): Promise<DatabaseHandle> {
  if (isPgliteDatabase(env.DATABASE_URL)) {
    const dataDir = resolvePgliteDataDir(env.DATABASE_URL) ?? null;
    return createPgliteSchoolDatabase(dataDir);
  }

  return createPostgresSchoolDatabase(env.DATABASE_URL);
}
