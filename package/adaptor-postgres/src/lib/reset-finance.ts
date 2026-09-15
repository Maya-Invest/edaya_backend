import type { SQL } from 'drizzle-orm'
import process from 'node:process'
import { sql } from 'drizzle-orm'

/** Finance tables deleted in child-before-parent order. Never include non-finance or journal tables. */
export const DISPOSABLE_FINANCE_TABLES = [
  'student_account_entries',
  'allocations',
  'payments',
  'student_charges',
  'student_service_enrollments',
  'student_year_accounts',
  'catalog_services',
] as const

export const LEGACY_FINANCE_TABLES = ['fees', 'student_fees'] as const

export const FINANCE_RESET_ALLOWED_TABLES = [
  ...DISPOSABLE_FINANCE_TABLES,
  ...LEGACY_FINANCE_TABLES,
  'attachments',
  'attachment_uploads',
] as const

function parseHostname(databaseUrl: string): string {
  try {
    return new URL(databaseUrl.replace(/^postgres(ql)?:\/\//, 'postgres://')).hostname.toLowerCase()
  }
  catch {
    throw new Error('Finance reset URL is not a valid Postgres connection string.')
  }
}

function readEnv(env: NodeJS.ProcessEnv, key: string): string | undefined {
  return env[key]
}

/**
 * Target-validated disposable finance reset. Never reads DATABASE_URL.
 * Allowed identity: loopback native-runner clusters (127.0.0.1).
 */
export function assertFinanceResetTarget(
  databaseUrl: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const trimmed = databaseUrl?.trim()
  if (!trimmed) {
    throw new Error('EDAYA_FINANCE_RESET_URL is required. DATABASE_URL is not a valid default for finance reset.')
  }
  const databaseUrlDefault = readEnv(env, 'DATABASE_URL')?.trim()
  if (databaseUrlDefault && trimmed === databaseUrlDefault) {
    throw new Error('Refuse to reset: EDAYA_FINANCE_RESET_URL must not reuse DATABASE_URL.')
  }
  const hostname = parseHostname(trimmed)
  if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
    throw new Error(`Refuse to reset: finance cutover only accepts loopback targets, got ${hostname}.`)
  }
  return trimmed
}

export async function resetDisposableFinanceRecords(db: { execute: (query: SQL) => Promise<unknown> }): Promise<void> {
  await db.execute(sql.raw(`
    DELETE FROM attachment_uploads
    WHERE (completed_at IS NULL AND attachment->>'ownerKind' = 'payment')
       OR attachment_id IN (SELECT id FROM attachments WHERE owner_kind = 'payment')
  `))
  await db.execute(sql.raw(`DELETE FROM attachments WHERE owner_kind = 'payment'`))
  for (const table of LEGACY_FINANCE_TABLES) {
    await db.execute(sql.raw(`
      DO $finance$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = '${table}'
        ) THEN
          EXECUTE 'DELETE FROM ${table}';
        END IF;
      END
      $finance$;
    `))
  }
  for (const table of DISPOSABLE_FINANCE_TABLES) {
    await db.execute(sql.raw(`DELETE FROM ${table}`))
  }
}
