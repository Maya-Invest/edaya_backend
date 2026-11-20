import process from 'node:process'
import { MIGRATIONS_SCHEMA, SCHOOL_MIGRATIONS_TABLE } from '@edaya/adaptor-postgres'
import postgres from 'postgres'
import { readSchoolMigrationJournal } from './lib/school-migration-journal'

interface JournalRow {
  id: number
  hash: string
  created_at: string
}

/**
 * Drizzle-kit migrate only applies files with folderMillis greater than the
 * journal row with the highest created_at. Orphan rows (unknown hash, future
 * timestamp) can block pending migrations without failing the migrate command.
 */
export async function repairDrizzleMigrationJournal(databaseUrl: string): Promise<void> {
  const migrations = readSchoolMigrationJournal()
  const knownHashes = new Set(migrations.flatMap(entry => [entry.hash, ...entry.previousHashes]))
  const sql = postgres(databaseUrl)

  try {
    const existsRows = await sql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = ${MIGRATIONS_SCHEMA}
          AND table_name = ${SCHOOL_MIGRATIONS_TABLE}
      ) AS exists
    `
    if (!existsRows[0]?.exists) {
      return
    }

    const rows = await sql.unsafe<JournalRow[]>(
      `SELECT id, hash, created_at::text
       FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE}
       ORDER BY created_at`,
    )

    const appliedHashes = new Set(rows.map(row => row.hash))
    const pending = migrations.filter(entry => !appliedHashes.has(entry.hash) && !entry.previousHashes.some(hash => appliedHashes.has(hash)))

    if (pending.length === 0) {
      return
    }

    const lastCreatedAt = rows.length > 0
      ? Math.max(...rows.map(row => Number(row.created_at)))
      : 0
    const earliestPendingMillis = Math.min(...pending.map(entry => entry.when))

    if (lastCreatedAt < earliestPendingMillis) {
      return
    }

    const orphans = rows.filter(row => !knownHashes.has(row.hash))
    if (orphans.length === 0) {
      console.warn(
        `Pending school migrations exist but the drizzle journal blocks drizzle-kit migrate. `
        + `Inspect ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE} manually.`,
      )
      return
    }

    console.warn(
      `Removing ${orphans.length} orphan drizzle journal row(s) blocking pending migrations…`,
    )

    for (const orphan of orphans) {
      await sql.unsafe(
        `DELETE FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE} WHERE id = $1`,
        [orphan.id],
      )
      console.warn(`  removed id=${orphan.id} hash=${orphan.hash.slice(0, 12)}…`)
    }
  }
  finally {
    await sql.end()
  }
}

if (import.meta.main) {
  const { STAGING_DATABASE_URL, DATABASE_URL } = process.env
  const databaseUrl = STAGING_DATABASE_URL ?? DATABASE_URL

  if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
    throw new Error('Set STAGING_DATABASE_URL (or DATABASE_URL) before repairing the drizzle journal.')
  }

  await repairDrizzleMigrationJournal(databaseUrl)
}
