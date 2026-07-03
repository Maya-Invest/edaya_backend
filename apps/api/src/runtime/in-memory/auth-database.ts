import type { DatabaseHandle } from "@/runtime/types";
import { attachAuthDatabase } from "@/runtime/shared/auth-database";

export async function createAuthDatabase(
  schoolHandle: DatabaseHandle,
  options: { runMigrations?: boolean; databaseUrl: string },
): Promise<DatabaseHandle> {
  return attachAuthDatabase(schoolHandle, options);
}
