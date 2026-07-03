import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type postgres from 'postgres'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
export const schoolMigrationsFolder = path.resolve(repoRoot, 'package/adaptor-postgres/drizzle')

export interface SchoolMigrationJournalEntry {
  tag: string
  when: number
  hash: string
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
    }
  })
}

export async function readAppliedMigrationHashes(
  sql: postgres.Sql,
): Promise<Set<string>> {
  const rows = await sql<{ hash: string }[]>`
    SELECT hash
    FROM drizzle.__drizzle_migrations
  `
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
  const applied = await readAppliedMigrationHashes(sql)
  const appliedTags: string[] = []

  for (const entry of journal) {
    if (applied.has(entry.hash)) {
      continue
    }

    const migrationSql = readFileSync(
      path.join(schoolMigrationsFolder, `${entry.tag}.sql`),
      'utf8',
    )

    for (const statement of splitMigrationStatements(migrationSql)) {
      await sql.unsafe(statement)
    }

    await sql`
      INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
      VALUES (${entry.hash}, ${entry.when})
    `

    appliedTags.push(entry.tag)

    if (entry.tag === stopTag) {
      break
    }
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
