import { runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { resolveMigrationDriver, runMigrations as runSchoolMigrations } from "@edaya/adaptor-postgres";

/** School and auth share one PGlite DB locally; school journal timestamps must be applied first. */
export async function runStartupMigrations(db: unknown, databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl);
  await runSchoolMigrations(db, { driver });
  await runAuthMigrations(db, { driver });
}
