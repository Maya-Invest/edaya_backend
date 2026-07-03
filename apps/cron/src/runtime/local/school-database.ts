import { isPgliteDatabase, resolvePgliteDataDir } from "@edaya/adaptor-postgres";
import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { createPgliteSchoolDatabase } from "@/runtime/shared/school-database";

export async function createSchoolDatabase(env: Environment): Promise<DatabaseHandle> {
  if (!isPgliteDatabase(env.DATABASE_URL)) {
    throw new Error(
      "RUNTIME=local requires a persisted PGlite DATABASE_URL (e.g. pglite:.data/school).",
    );
  }

  const dataDir = resolvePgliteDataDir(env.DATABASE_URL);
  if (!dataDir) {
    throw new Error(
      "RUNTIME=local requires a persisted PGlite data directory (e.g. pglite:.data/school), not ephemeral pglite.",
    );
  }

  return createPgliteSchoolDatabase(dataDir);
}
