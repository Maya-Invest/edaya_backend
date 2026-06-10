import { PGlite } from '@electric-sql/pglite'
import { describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
import { runMigrations } from './migrate'

describe('runMigrations', () => {
  it('creates Better Auth tables on PGlite', async () => {
    const pglite = new PGlite()
    const db = drizzle(pglite)

    await runMigrations(db, { driver: 'pglite' })

    const result = await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('user', 'session', 'account', 'verification')
      ORDER BY table_name
    `)

    const rows = result.rows as Array<{ table_name: string }>
    expect(rows.map(row => row.table_name)).toEqual([
      'account',
      'session',
      'user',
      'verification',
    ])

    await pglite.close()
  })
})
