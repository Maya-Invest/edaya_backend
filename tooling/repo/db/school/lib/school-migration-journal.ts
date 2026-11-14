import type postgres from 'postgres'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MIGRATIONS_SCHEMA, SCHOOL_MIGRATIONS_TABLE } from '@edaya/adaptor-postgres'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
export const schoolMigrationsFolder = path.resolve(repoRoot, 'package/adaptor-postgres/drizzle')

export interface SchoolMigrationJournalEntry {
  tag: string
  when: number
  hash: string
  previousHashes: string[]
}

export function readSchoolMigrationJournal(): SchoolMigrationJournalEntry[] {
  const journalPath = path.join(schoolMigrationsFolder, 'meta/_journal.json')
  if (!existsSync(journalPath)) {
    throw new Error(`Missing migration journal at ${journalPath}`)
  }

  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as {
    entries: Array<{ tag: string, when: number }>
  }

  return journal.entries.map((entry) => {
    const query = readFileSync(path.join(schoolMigrationsFolder, `${entry.tag}.sql`), 'utf8')
    return {
      tag: entry.tag,
      when: entry.when,
      hash: createHash('sha256').update(query).digest('hex'),
      // The original 0054 could only succeed on empty tables. Its journal entry
      // remains valid for databases that already ran it.
      previousHashes: entry.tag === '0054_visible_identification'
        ? ['f5754ac6e7bec08e20a456e4a3e80474edc0895346bbd6d5889a95fc2ef06281']
        : [],
    }
  })
}

export async function readAppliedMigrationHashes(
  sql: postgres.Sql,
): Promise<Set<string>> {
  const rows = await sql.unsafe<{ hash: string }[]>(
    `SELECT hash FROM ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE}`,
  )
  return new Set(rows.map(row => row.hash))
}

function splitMigrationStatements(sqlContent: string): string[] {
  return sqlContent
    .split('--> statement-breakpoint')
    .map(statement => statement.trim())
    .filter(statement => statement.length > 0)
}

export async function applyPendingSchoolMigrationsUntil(
  sql: postgres.Sql,
  stopTag: string,
): Promise<string[]> {
  const journal = readSchoolMigrationJournal()
  const stopIndex = journal.findIndex(entry => entry.tag === stopTag)
  if (stopIndex < 0)
    throw new Error(`Unknown school migration: ${stopTag}`)
  const applied = await readAppliedMigrationHashes(sql)
  const appliedTags: string[] = []

  for (const entry of journal.slice(0, stopIndex + 1)) {
    if (applied.has(entry.hash) || entry.previousHashes.some(hash => applied.has(hash))) {
      continue
    }

    const migrationSql = readFileSync(
      path.join(schoolMigrationsFolder, `${entry.tag}.sql`),
      'utf8',
    )

    await sql.begin(async (tx) => {
      for (const statement of splitMigrationStatements(migrationSql)) {
        await tx.unsafe(statement)
      }
      await tx.unsafe(
        `INSERT INTO ${MIGRATIONS_SCHEMA}.${SCHOOL_MIGRATIONS_TABLE} (hash, created_at) VALUES ($1, $2)`,
        [entry.hash, entry.when],
      )
    })

    appliedTags.push(entry.tag)
  }

  return appliedTags
}

export async function tableExists(sql: postgres.Sql, tableName: string): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${tableName}
    ) AS exists
  `
  return rows[0]?.exists ?? false
}
