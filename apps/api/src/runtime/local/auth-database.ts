import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { attachAuthDatabase } from "@/runtime/shared/auth-database";

export async function createAuthDatabase(
  schoolHandle: DatabaseHandle,
  env: Environment,
  options: { runMigrations?: boolean } = {},
): Promise<DatabaseHandle> {
  return attachAuthDatabase(schoolHandle, {
    databaseUrl: env.DATABASE_URL,
    runMigrations: options.runMigrations,
  });
}
