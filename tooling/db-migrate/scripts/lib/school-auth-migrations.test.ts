import { readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runMigrations as runAuthMigrations } from '@edaya/adaptor-auth'
import { runMigrations as runSchoolMigrations } from '@edaya/adaptor-postgres'
import { PGlite } from '@electric-sql/pglite'
import { describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { readSchoolMigrationJournal } from './school-migration-journal'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

function readAuthMigrationJournalWhenValues(): number[] {
  const journalPath = path.join(
    repoRoot,
    'package/adaptor-auth/drizzle/auth/meta/_journal.json',
  )
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ when: number }>
  }
  return journal.entries.map(entry => entry.when)
}

describe('local school + auth migrations', () => {
  test('auth journal when values exceed latest school migration when', () => {
    const maxSchoolWhen = Math.max(...readSchoolMigrationJournal().map(entry => entry.when))
    const minAuthWhen = Math.min(...readAuthMigrationJournalWhenValues())
    expect(minAuthWhen).toBeGreaterThan(maxSchoolWhen)
  })

  test('applies auth schema after school schema on the same PGlite database', async () => {
    const dataDir = path.join(tmpdir(), `edaya-school-auth-migrate-${Date.now()}`)
    rmSync(dataDir, { recursive: true, force: true })

    const pglite = new PGlite(dataDir)
    const db = drizzle(pglite)

    try {
      await runSchoolMigrations(db, { driver: 'pglite' })
      await runAuthMigrations(db, { driver: 'pglite' })

      const migrations = await pglite.query<{ count: number }>(
        'SELECT count(*)::int AS count FROM drizzle.__drizzle_migrations',
      )
      const authTables = await pglite.query<{ table_name: string }>(
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'auth'
         ORDER BY table_name`,
      )

      expect(migrations.rows[0]?.count).toBeGreaterThanOrEqual(3)
      expect(authTables.rows.map(row => row.table_name)).toEqual([
        'account',
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
})
