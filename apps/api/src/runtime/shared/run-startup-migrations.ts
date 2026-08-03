import { runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { resolveMigrationDriver, runMigrations as runSchoolMigrations } from "@edaya/adaptor-postgres";

/** School and auth share `drizzle.__drizzle_migrations`; every auth journal `when` must exceed the latest school migration `when`. */
export async function runStartupMigrations(db: unknown, databaseUrl: string): Promise<void> {
  const driver = resolveMigrationDriver(databaseUrl);
  await runSchoolMigrations(db, { driver });
  await runAuthMigrations(db, { driver });
}
