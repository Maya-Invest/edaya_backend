import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const migrationsFolder = path.resolve(repoRoot, 'package/adaptor-postgres/drizzle')

interface JournalEntry {
  tag: string
  when: number
}

interface JournalRow {
  id: number
  hash: string
  created_at: string
}

interface MigrationFile {
  hash: string
  folderMillis: number
}

function readMigrationHashes(): MigrationFile[] {
  const journalPath = path.join(migrationsFolder, 'meta/_journal.json')
  if (!existsSync(journalPath)) {
    throw new Error(`Missing migration journal at ${journalPath}`)
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as { entries: JournalEntry[] }

  return journal.entries.map((entry) => {
    const query = readFileSync(path.join(migrationsFolder, `${entry.tag}.sql`), 'utf8')
    return {
      folderMillis: entry.when,
      hash: createHash('sha256').update(query).digest('hex'),
    }
  })
}

/**
 * Drizzle-kit migrate only applies files with folderMillis greater than the
 * journal row with the highest created_at. Orphan rows (unknown hash, future
 * timestamp) can block pending migrations without failing the migrate command.
 */
export async function repairDrizzleMigrationJournal(databaseUrl: string): Promise<void> {
  const migrations = readMigrationHashes()
  const knownHashes = new Set(migrations.map(migration => migration.hash))
  const sql = postgres(databaseUrl)

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

    const rows = await sql<JournalRow[]>`
      SELECT id, hash, created_at::text
      FROM drizzle.__drizzle_migrations
      ORDER BY created_at
    `

    const appliedHashes = new Set(rows.map(row => row.hash))
    const pending = migrations.filter(migration => !appliedHashes.has(migration.hash))

    if (pending.length === 0) {
      return
    }

    const lastCreatedAt = rows.length > 0
      ? Math.max(...rows.map(row => Number(row.created_at)))
      : 0
    const earliestPendingMillis = Math.min(...pending.map(migration => migration.folderMillis))

    if (lastCreatedAt < earliestPendingMillis) {
      return
    }

    const orphans = rows.filter(row => !knownHashes.has(row.hash))
    if (orphans.length === 0) {
      console.warn(
        'Pending migrations exist but the drizzle journal blocks drizzle-kit migrate. '
        + 'Inspect drizzle.__drizzle_migrations manually.',
      )
      return
    }

    console.warn(
      `Removing ${orphans.length} orphan drizzle journal row(s) blocking pending migrations…`,
    )

    for (const orphan of orphans) {
      await sql`
        DELETE FROM drizzle.__drizzle_migrations
        WHERE id = ${orphan.id}
      `
      console.warn(`  removed id=${orphan.id} hash=${orphan.hash.slice(0, 12)}…`)
    }
  }
  finally {
    await sql.end()
  }
}

if (import.meta.main) {
  // eslint-disable-next-line dot-notation -- process.env index signature requires bracket access for tsc
  const databaseUrl = process.env['STAGING_DATABASE_URL'] ?? process.env['DATABASE_URL']

  if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
    throw new Error('Set STAGING_DATABASE_URL (or DATABASE_URL) before repairing the drizzle journal.')
  }

  await repairDrizzleMigrationJournal(databaseUrl)
}
