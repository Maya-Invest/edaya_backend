import type { Environment } from "@/lib/bootstrap/env";
import type { ApiSchoolApplication } from "@/lib/school-api/runtime/school-application";
import type { AuthService } from "@/lib/runtime/types";
import { type DevAuthSeedResult, runDevAuthSeed } from "@/lib/seed/run-dev-auth-seed";
import { type DevSeedResult, runDevSeed } from "@/lib/seed/run-dev-seed";

export {
  DEV_AUTH_PASSWORD,
  SEED_ACADEMIC_YEAR_ID,
  SEED_SCHOOL_ID,
} from "@/lib/seed/dataset";
export type { DevAuthSeedResult } from "@/lib/seed/run-dev-auth-seed";
export type { DevSeedResult } from "@/lib/seed/run-dev-seed";

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

export async function maybeSeedAuthDatabase(
  application: ApiSchoolApplication,
  auth: AuthService,
  env: Environment,
): Promise<DevAuthSeedResult | null> {
  if (!shouldSeedOnStart(env)) {
    return null;
  }

  return runDevAuthSeed(application, auth, env);
}
