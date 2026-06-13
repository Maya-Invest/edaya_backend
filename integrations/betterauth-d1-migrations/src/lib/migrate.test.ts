import { Database } from 'bun:sqlite'
import { describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { runMigrations } from './migrate'

describe('runMigrations', () => {
  it('creates Better Auth tables on SQLite', async () => {
    const sqlite = new Database(':memory:')
    const db = drizzle(sqlite)

    await runMigrations(db, { driver: 'sqlite' })

    const tables = await db.all<{ name: string }>(sql`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table'
        AND name IN ('user', 'session', 'account', 'verification')
      ORDER BY name
    `)

    expect(tables.map(row => row.name)).toEqual([
      'account',
      'session',
      'user',
      'verification',
    ])

    sqlite.close()
  })
})
