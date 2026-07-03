import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { runMigrations } from './migrate'

describe('runMigrations', () => {
  it('creates Better Auth tables in the auth schema on PGlite', async () => {
    const pglite = new PGlite()
    const db = drizzle(pglite)

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

    await pglite.close()
  })
})
