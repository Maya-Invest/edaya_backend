import path from "node:path";
import { fileURLToPath } from "node:url";
import { isPgliteDatabase, resolvePersistedPgliteDataDir } from "@edaya/adaptor-postgres";
import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { createPgliteSchoolDatabase } from "@/runtime/shared/school-database";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

export async function createSchoolDatabase(env: Environment): Promise<DatabaseHandle> {
  if (!isPgliteDatabase(env.DATABASE_URL)) {
    throw new Error(
      "RUNTIME=local requires a persisted PGlite DATABASE_URL (e.g. pglite:.data/school).",
    );
  }

  const dataDir = resolvePersistedPgliteDataDir(env.DATABASE_URL, { repoRoot });
  if (!dataDir) {
    throw new Error(
      "RUNTIME=local requires a persisted PGlite data directory (e.g. pglite:.data/school), not ephemeral pglite.",
    );
  }

  if (env.NODE_ENV === "development") {
    // eslint-disable-next-line no-console -- local dev diagnostics
    console.log(`[edaya/api] PGlite data directory: ${dataDir}`);
  }

  return createPgliteSchoolDatabase(dataDir);
}
