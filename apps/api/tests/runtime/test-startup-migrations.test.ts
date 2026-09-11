import { PGlite } from "@electric-sql/pglite";
import {
  AUTH_MIGRATIONS_TABLE,
  runMigrations as runAuthMigrations,
} from "@edaya/adaptor-auth";
import {
  getMigrationsFolder,
  MIGRATIONS_SCHEMA,
  runMigrations as runSchoolMigrations,
  SCHOOL_MIGRATIONS_TABLE,
} from "@edaya/adaptor-postgres";
import { describe, expect, test } from "bun:test";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runStartupMigrations } from "@/runtime/shared/run-startup-migrations";

function schoolMigrationCount(): number {
  const journal = JSON.parse(
    readFileSync(path.join(getMigrationsFolder(), "meta/_journal.json"), "utf8"),
  ) as { entries: unknown[] };
  return journal.entries.length;
}

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
      const schoolJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE}`,
      );
      const authJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${AUTH_MIGRATIONS_TABLE}`,
      );

      const notifyTables = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'notify'`,
      );

      expect(publicTables.rows[0]?.count).toBeGreaterThan(50);
      expect(authTables.rows[0]?.count).toBe(17);
      expect(notifyTables.rows[0]?.count).toBe(4);
      expect(schoolJournal.rows[0]?.count).toBe(schoolMigrationCount());
      expect(authJournal.rows[0]?.count).toBe(5);
    }
    finally {
      await pglite.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 30_000);

  test("auth-before-school still applies school migrations with separate journals", async () => {
    const dataDir = path.join(tmpdir(), `edaya-auth-first-migrate-${Date.now()}`);
    rmSync(dataDir, { recursive: true, force: true });

    const pglite = new PGlite(dataDir);
    const db = drizzle(pglite);

    try {
      await runAuthMigrations(db, { driver: "pglite" });
      await runSchoolMigrations(db, { driver: "pglite" });

      const publicTables = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'public'`,
      );
      const schoolJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE}`,
      );
      const authJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${AUTH_MIGRATIONS_TABLE}`,
      );

      expect(publicTables.rows[0]?.count).toBeGreaterThan(50);
      expect(schoolJournal.rows[0]?.count).toBe(schoolMigrationCount());
      expect(authJournal.rows[0]?.count).toBe(5);
    }
    finally {
      await pglite.close();
      rmSync(dataDir, { recursive: true, force: true });
    }
  }, 30_000);
});
