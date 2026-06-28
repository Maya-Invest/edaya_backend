import { isPgliteDatabase } from "@edaya/adaptor-postgres";
import type { Environment } from "@/runtime/shared/env/schema";

export function runMigrationsOnStartup(
  env: Pick<Environment, "DATABASE_URL" | "RUN_MIGRATIONS_ON_STARTUP">,
): boolean {
  if (typeof env.RUN_MIGRATIONS_ON_STARTUP === "boolean") {
    return env.RUN_MIGRATIONS_ON_STARTUP;
  }

  return isPgliteDatabase(env.DATABASE_URL);
}
