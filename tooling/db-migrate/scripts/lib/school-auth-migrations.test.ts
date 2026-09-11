import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  AUTH_MIGRATIONS_TABLE,
  runMigrations as runAuthMigrations,
} from '@edaya/adaptor-auth'
import {
  MIGRATIONS_SCHEMA,
  runMigrations as runSchoolMigrations,
  SCHOOL_MIGRATIONS_TABLE,
} from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { readSchoolMigrationJournal } from './school-migration-journal'

describe('local school + auth migrations', () => {
  test('keeps separate drizzle journals for school and auth', async () => {
    const dataDir = path.join(tmpdir(), `edaya-school-auth-migrate-${Date.now()}`)
    rmSync(dataDir, { recursive: true, force: true })

    const pglite = new PGlite(dataDir)
    const db = drizzle(pglite)

    try {
      await runSchoolMigrations(db, { driver: 'pglite' })
      await runAuthMigrations(db, { driver: 'pglite' })

      const schoolJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE}`,
      )
      const authJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${AUTH_MIGRATIONS_TABLE}`,
      )
      const authTables = await pglite.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'auth'
         ORDER BY table_name`,
      )

      expect(schoolJournal.rows[0]?.count).toBe(readSchoolMigrationJournal().length)
      expect(authJournal.rows[0]?.count).toBe(5)
      expect(authTables.rows.map(row => row.table_name)).toEqual([
        'account',
        'edaya_access_tokens',
        'edaya_auth_rate_buckets',
        'edaya_delegation_children',
        'edaya_delegation_grants',
        'edaya_delegation_scopes',
        'jwks',
        'oauth_access_token',
        'oauth_client',
        'oauth_client_assertion',
        'oauth_client_resource',
        'oauth_consent',
        'oauth_refresh_token',
        'oauth_resource',
        'session',
        'user',
        'verification',
      ])
    }
    finally {
      await pglite.close()
      rmSync(dataDir, { recursive: true, force: true })
    }
  }, 30_000)

  test('applies school migrations after auth when journals are separate', async () => {
    const dataDir = path.join(tmpdir(), `edaya-auth-first-migrate-${Date.now()}`)
    rmSync(dataDir, { recursive: true, force: true })

    const pglite = new PGlite(dataDir)
    const db = drizzle(pglite)

    try {
      await runAuthMigrations(db, { driver: 'pglite' })
      await runSchoolMigrations(db, { driver: 'pglite' })

      const publicTables = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count
         FROM information_schema.tables
         WHERE table_schema = 'public'`,
      )
      const schoolJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE}`,
      )
      const authJournal = await pglite.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM ${MIGRATIONS_SCHEMA}.${AUTH_MIGRATIONS_TABLE}`,
      )

      expect(publicTables.rows[0]?.count).toBeGreaterThan(50)
      expect(schoolJournal.rows[0]?.count).toBe(readSchoolMigrationJournal().length)
      expect(authJournal.rows[0]?.count).toBe(5)
    }
    finally {
      await pglite.close()
      rmSync(dataDir, { recursive: true, force: true })
    }
  }, 30_000)
})
