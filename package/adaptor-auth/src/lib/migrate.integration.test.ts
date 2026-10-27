import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { getMigrationsFolder, runMigrations } from './migrate'

describe('runMigrations', () => {
  it('resolves the committed auth SQL migrations folder', () => {
    const folder = getMigrationsFolder()
    expect(existsSync(join(folder, 'meta/_journal.json'))).toBe(true)
    expect(existsSync(join(folder, '0000_auth_postgres.sql'))).toBe(true)
  })

  it('creates Better Auth tables in the auth schema on PGlite', async () => {
    const pglite = new PGlite()
    const db = drizzle(pglite)

    try {
      await runMigrations(db, { driver: 'pglite' })

      const tables = await db.execute<{ table_name: string }>(sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'auth'
          AND table_name IN ('user', 'session', 'account', 'verification')
        ORDER BY table_name
      `)

      expect(tables.rows.map(row => row.table_name)).toEqual([
        'account',
        'session',
        'user',
        'verification',
      ])
    }
    finally {
      await pglite.close()
    }
  }, 30_000)
})
