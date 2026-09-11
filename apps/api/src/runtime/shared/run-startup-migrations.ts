import { applyNotifySchemaOnDrizzle } from "@edaya/adaptor-notify";
import { resolveMigrationDriver, runMigrations as runSchoolMigrations } from "@edaya/adaptor-postgres";

/** Apply school-owned schema only. Identity owns its database and migrations. */
export async function runStartupMigrations(db: unknown, databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl);
  await runSchoolMigrations(db, { driver });
  await applyNotifySchemaOnDrizzle(db);
}
