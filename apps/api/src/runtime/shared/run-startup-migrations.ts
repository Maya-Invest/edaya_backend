import { runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { resolveMigrationDriver, runMigrations as runSchoolMigrations } from "@edaya/adaptor-postgres";

/** School then auth on the same database; each side keeps its own Drizzle journal table. */
export async function runStartupMigrations(db: unknown, databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl);
  await runSchoolMigrations(db, { driver });
  await runAuthMigrations(db, { driver });
}
