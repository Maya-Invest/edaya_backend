import type { MigrationDriver } from "@edaya/adaptor-betterauth";
import { isEphemeralDatabase } from "@/lib/seed";

export function resolveMigrationDriver(databaseUrl: string): MigrationDriver {
  return isEphemeralDatabase(databaseUrl) ? "pglite" : "postgres-js";
}
