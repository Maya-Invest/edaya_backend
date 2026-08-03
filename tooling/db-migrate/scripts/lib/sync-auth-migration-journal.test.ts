import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'
import postgres from 'postgres'
import { syncAuthMigrationJournalTimestamps } from './sync-auth-migration-journal'

/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

describe('syncAuthMigrationJournalTimestamps', () => {
  test('rewrites auth created_at when journal when was bumped after apply', async () => {
    if (process.env['EDAYA_TEST_STAGING_MIGRATE'] !== '1') {
      return
    }

    const databaseUrl = process.env['STAGING_DATABASE_URL']
    if (!databaseUrl) {
      throw new Error('STAGING_DATABASE_URL is required when EDAYA_TEST_STAGING_MIGRATE=1')
    }

    const authSql = readFileSync(
      path.join(repoRoot, 'package/adaptor-auth/drizzle/auth/0000_auth_postgres.sql'),
    )
    const authHash = createHash('sha256').update(authSql).digest('hex')
    const authWhen = (
      JSON.parse(
        readFileSync(
          path.join(repoRoot, 'package/adaptor-auth/drizzle/auth/meta/_journal.json'),
          'utf8',
        ),
      ) as { entries: Array<{ when: number }> }
    ).entries[0]!.when

    const sql = postgres(databaseUrl, { max: 1 })
    try {
      const before = await sql<{ created_at: string }[]>`
        SELECT created_at::text
        FROM drizzle.__drizzle_migrations
        WHERE hash = ${authHash}
      `
      expect(before.length).toBe(1)

      // Simulate the pre-bump timestamp that triggers re-apply.
      await sql`
        UPDATE drizzle.__drizzle_migrations
        SET created_at = ${authWhen - 1}
        WHERE hash = ${authHash}
      `

      await syncAuthMigrationJournalTimestamps(databaseUrl)

      const after = await sql<{ created_at: string }[]>`
        SELECT created_at::text
        FROM drizzle.__drizzle_migrations
        WHERE hash = ${authHash}
      `
      expect(Number(after[0]?.created_at)).toBe(authWhen)
    }
    finally {
      await sql.end({ timeout: 5 })
    }
  }, 30_000)
})
