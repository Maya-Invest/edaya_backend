import { PGlite } from "@electric-sql/pglite";
import { runMigrations as runAuthMigrations } from "@edaya/adaptor-auth";
import { runMigrations as runSchoolMigrations } from "@edaya/adaptor-postgres";
import { describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runStartupMigrations } from "@/runtime/shared/run-startup-migrations";

describe("runStartupMigrations", () => {
  test("applies school schema before auth on a shared PGlite database", async () => {
    const dataDir = path.join(tmpdir(), `edaya-startup-migrate-${Date.now()}`);
    rmSync(dataDir, { recursive: true, force: true });

    const pglite = new PGlite(dataDir);
    const db = drizzle(pglite);

    try {
      await runStartupMigrations(db, `pglite:${dataDir}`);

      const publicTables = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );
      const authTables = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'auth'`,
      );
      const migrations = await pglite.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
      );

      expect(publicTables.rows[0]?.count).toBeGreaterThan(50);
      expect(authTables.rows[0]?.count).toBe(4);
      expect(migrations.rows[0]?.count).toBe(5);
    }
    finally {
      await pglite.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 30_000);

  test("auth-before-school leaves school schema unapplied (regression guard)", async () => {
    const dataDir = path.join(tmpdir(), `edaya-auth-first-migrate-${Date.now()}`);
    rmSync(dataDir, { recursive: true, force: true });

    const pglite = new PGlite(dataDir);
    const db = drizzle(pglite);

    try {
      await runAuthMigrations(db, { driver: "pglite" });
      await expect(runSchoolMigrations(db, { driver: "pglite" })).rejects.toThrow(
        /cron_job_schedules/,
      );

      const publicTables = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );
      const migrations = await pglite.query<{ count: number }>(
        "SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations",
      );

      expect(publicTables.rows[0]?.count).toBe(0);
      expect(migrations.rows[0]?.count).toBe(1);
    }
    finally {
      await pglite.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 30_000);
});
