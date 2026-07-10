import type { Environment } from "@/runtime/shared/env/schema";
import type { DatabaseHandle } from "@/runtime/types";
import { createPostgresAuthDatabase } from "@/runtime/shared/auth-database";

export async function createAuthDatabase(
  env: Environment,
  options: { runMigrations?: boolean } = {},
): Promise<DatabaseHandle> {
  return createPostgresAuthDatabase(env.AUTH_DATABASE_URL ?? env.DATABASE_URL, options);
}
