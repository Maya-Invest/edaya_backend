import type { Environment } from "@/runtime/env/schema";
import { isPgliteDatabase } from "@edaya/adaptor-postgres";

export function shouldRunStartupMigrations(
  env: Pick<Environment, "DATABASE_URL" | "RUN_MIGRATIONS_ON_STARTUP">,
): boolean {
  if (typeof env.RUN_MIGRATIONS_ON_STARTUP === "boolean") {
    return env.RUN_MIGRATIONS_ON_STARTUP;
  }

  return isPgliteDatabase(env.DATABASE_URL);
}
