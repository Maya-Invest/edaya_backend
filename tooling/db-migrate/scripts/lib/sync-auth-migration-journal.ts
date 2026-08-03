import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const authMigrationsFolder = path.resolve(repoRoot, 'package/adaptor-auth/drizzle/auth')

interface AuthJournalEntry {
  tag: string
  when: number
  hash: string
}

function readAuthMigrationJournal(): AuthJournalEntry[] {
  const journalPath = path.join(authMigrationsFolder, 'meta/_journal.json')
  if (!existsSync(journalPath)) {
    throw new Error(`Missing auth migration journal at ${journalPath}`)
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string, when: number }>
  }

  return journal.entries.map((entry) => {
    const query = readFileSync(path.join(authMigrationsFolder, `${entry.tag}.sql`), 'utf8')
    return {
      tag: entry.tag,
      when: entry.when,
      hash: createHash('sha256').update(query).digest('hex'),
    }
  })
}

/**
 * School + auth share `drizzle.__drizzle_migrations`. Auth journal `when` is
 * bumped above the latest school migration so drizzle-orm will still consider
 * auth pending after school applies. Drizzle only checks
 * `last.created_at < folderMillis` (not hash), so a bumped `when` would
 * re-run `CREATE TABLE auth.user` on databases that already applied auth.
 *
 * After school migrate, rewrite matching auth hash rows to the current journal
 * `when` so the migrator skips them instead of recreating tables.
 */
export async function syncAuthMigrationJournalTimestamps(
  databaseUrl: string,
): Promise<void> {
  const entries = readAuthMigrationJournal()
  if (entries.length === 0) {
    return
  }

  const sql = postgres(databaseUrl, { max: 1 })

  try {
    const existsRows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'drizzle'
          AND table_name = '__drizzle_migrations'
      ) AS exists
    `
    if (!existsRows[0]?.exists) {
      return
    }

    for (const entry of entries) {
      const updated = await sql`
        UPDATE drizzle.__drizzle_migrations
        SET created_at = ${entry.when}
        WHERE hash = ${entry.hash}
          AND created_at IS DISTINCT FROM ${entry.when}
        RETURNING id, created_at
      `

      if (updated.count > 0) {
        console.warn(
          `Synced auth migration journal timestamp for ${entry.tag} `
          + `(hash ${entry.hash.slice(0, 12)}…) → created_at=${entry.when}`,
        )
      }
    }
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
