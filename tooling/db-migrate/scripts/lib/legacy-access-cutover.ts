import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import {
  applyPendingSchoolMigrationsUntil,
  readAppliedMigrationHashes,
  readSchoolMigrationJournal,
  tableExists,
} from './school-migration-journal'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const STAFF_ACCESS_CUTOVER_STOP_TAG = '0037_staff_assignment_permissions'

export interface LegacyAccessCutoverResult {
  skipped: boolean
  reason?: string
  schemaTagsApplied: string[]
  dataMigrationRan: boolean
}

async function migrationTagApplied(sql: postgres.Sql, tag: string): Promise<boolean> {
  const journal = readSchoolMigrationJournal()
  const entry = journal.find(row => row.tag === tag)
  if (!entry) {
    return false
  }
  const applied = await readAppliedMigrationHashes(sql)
  return applied.has(entry.hash)
}

export async function runLegacyAccessCutoverIfNeeded(
  databaseUrl: string,
): Promise<LegacyAccessCutoverResult> {
  const sql = postgres(databaseUrl, { max: 1 })

  try {
    const legacyTablesExist = await tableExists(sql, 'access_roles')
    if (!legacyTablesExist) {
      return {
        skipped: true,
        reason: 'legacy access_roles table absent (cutover already applied or fresh database)',
        schemaTagsApplied: [],
        dataMigrationRan: false,
      }
    }

    if (await migrationTagApplied(sql, '0038_drop_legacy_access_control')) {
      console.warn(
        'Legacy access_roles still exists but migration 0038 is recorded as applied. '
        + 'Inspect the database manually before dropping legacy tables.',
      )
      return {
        skipped: true,
        reason: '0038 already applied while legacy tables remain',
        schemaTagsApplied: [],
        dataMigrationRan: false,
      }
    }

    let schemaTagsApplied: string[] = []
    if (!(await tableExists(sql, 'staff_permission_assignments'))) {
      console.log('\n> Applying school schema through staff permission prerequisites (0036–0037)')
      schemaTagsApplied = await applyPendingSchoolMigrationsUntil(sql, STAFF_ACCESS_CUTOVER_STOP_TAG)
    }

    console.log('\n> Migrating legacy staff access rows to staff_permission_assignments')
    const dataResult = spawnSync('bun', ['./scripts/migrate-staff-access-to-permissions.ts'], {
      cwd: packageRoot,
      env: { ...process.env, DATABASE_URL: databaseUrl },
      stdio: 'inherit',
    })

    if (dataResult.status !== 0) {
      process.exit(dataResult.status ?? 1)
    }

    return {
      skipped: false,
      schemaTagsApplied,
      dataMigrationRan: true,
    }
  }
  finally {
    await sql.end({ timeout: 5 })
  }
}
