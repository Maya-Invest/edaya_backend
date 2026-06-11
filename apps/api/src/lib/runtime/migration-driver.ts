import type { MigrationDriver } from "@edaya/adaptor-betterauth";
import { isEphemeralDatabase } from "@/lib/runtime/database-url";

export function resolveMigrationDriver(databaseUrl: string): MigrationDriver {
  return isEphemeralDatabase(databaseUrl) ? "pglite" : "postgres-js";
}
