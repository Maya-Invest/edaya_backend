import type { Environment } from "@/lib/bootstrap/env";
import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import { runDevSeed, type DevSeedResult } from "@/lib/seed/run-dev-seed";

export type { DevSeedResult } from "@/lib/seed/run-dev-seed";
export {
  SEED_ACADEMIC_YEAR_ID,
  SEED_SCHOOL_ID,
} from "@/lib/seed/dataset";

export function isEphemeralDatabase(databaseUrl: string): boolean {
  return databaseUrl === "memory"
    || databaseUrl === "pglite"
    || databaseUrl.startsWith("postgres://memory");
}

export function shouldSeedOnStart(env: Environment): boolean {
  if (env.SEED_ON_START === true) {
    return true;
  }
  if (env.SEED_ON_START === false) {
    return false;
  }
  return env.NODE_ENV === "development" && isEphemeralDatabase(env.DATABASE_URL);
}

export async function maybeSeedDatabase(
  application: ApiSchoolApplication,
  env: Environment,
): Promise<DevSeedResult | null> {
  if (!shouldSeedOnStart(env)) {
    return null;
  }

  return runDevSeed(application);
}
