import type { SQL } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { assertRecordedFinanceSchoolId } from './assert-finance-reset-target'

export interface SqlExecutor {
  execute: (query: SQL) => Promise<{ rows?: Array<Record<string, unknown>> } | unknown>
}

export type RawSqlQuery = (statement: string) => Promise<Array<Record<string, unknown>>>

export const FINANCE_RESET_TABLES = [
  'student_account_entries',
  'allocations',
  'payments',
  'student_charges',
  'student_service_enrollments',
  'student_year_accounts',
  'catalog_services',
] as const

const PRESERVATION_TABLES: ReadonlyArray<{ table: string, where: (schoolId: string) => string }> = [
  { table: 'schools', where: id => `id = '${id}'` },
  { table: 'students', where: id => `school_id = '${id}'` },
  { table: 'guardians', where: id => `school_id = '${id}'` },
  { table: 'guardian_student_links', where: id => `school_id = '${id}'` },
  { table: 'academic_years', where: id => `school_id = '${id}'` },
  { table: 'academic_periods', where: id => `school_id = '${id}'` },
  { table: 'staff_members', where: id => `school_id = '${id}'` },
  { table: 'student_class_enrollments', where: id => `student_id IN (SELECT id FROM students WHERE school_id = '${id}')` },
  { table: 'command_receipts', where: id => `school_id = '${id}'` },
  { table: 'command_audit', where: id => `school_id = '${id}'` },
  { table: 'command_outbox', where: id => `school_id = '${id}'` },
]

export interface FinancePreservationDigest {
  identity: string
  content: string
  tables: Record<string, { identity: string, content: string }>
}

function digestValue(value: string | null | undefined): string {
  return value && value.length > 0 ? value : 'empty'
}

function rowField(row: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = row?.[key]
  return typeof value === 'string' ? value : undefined
}

function setTableDigest(
  tables: Record<string, { identity: string, content: string }>,
  name: string,
  value: { identity: string, content: string },
): void {
  tables[name] = value
}

export function financeResetStatements(schoolId: string): readonly string[] {
  const id = assertRecordedFinanceSchoolId(schoolId)
  return [
    `DELETE FROM attachment_uploads WHERE school_id = '${id}' AND completed_at IS NULL AND attachment->>'ownerKind' = 'payment'`,
    `DELETE FROM attachments WHERE school_id = '${id}' AND owner_kind = 'payment'`,
    ...FINANCE_RESET_TABLES.map(table => `DELETE FROM ${table} WHERE school_id = '${id}'`),
  ]
}

export async function resetFinanceTablesBySql(query: (statement: string) => Promise<unknown>, schoolId: string): Promise<void> {
  for (const statement of financeResetStatements(schoolId))
    await query(statement)
}

export async function resetFinanceTables(db: SqlExecutor, schoolId: string): Promise<void> {
  await resetFinanceTablesBySql(statement => db.execute(sql.raw(statement)), schoolId)
}

async function tableDigest(query: RawSqlQuery, table: string, where: string): Promise<{ identity: string, content: string }> {
  const identity = await query(`SELECT coalesce(md5(string_agg(id::text, ',' ORDER BY id::text)), 'empty') AS digest FROM ${table} WHERE ${where}`)
  const content = await query(`SELECT coalesce(md5(string_agg(row_to_json(t)::text, ',' ORDER BY t.id::text)), 'empty') AS digest FROM ${table} t WHERE ${where}`)
  return {
    identity: digestValue(rowField(identity[0], 'digest')),
    content: digestValue(rowField(content[0], 'digest')),
  }
}

export async function captureFinancePreservationDigestBySql(query: RawSqlQuery, schoolId: string): Promise<FinancePreservationDigest> {
  const id = assertRecordedFinanceSchoolId(schoolId)
  const tables: Record<string, { identity: string, content: string }> = {}
  for (const entry of PRESERVATION_TABLES)
    tables[entry.table] = await tableDigest(query, entry.table, entry.where(id))
  setTableDigest(tables, 'attachments', await tableDigest(query, 'attachments', `school_id = '${id}' AND owner_kind <> 'payment'`))
  const identity = createHash('sha256').update(JSON.stringify(
    Object.fromEntries(Object.entries(tables).map(([name, value]) => [name, value.identity])),
  )).digest('hex')
  const content = createHash('sha256').update(JSON.stringify(
    Object.fromEntries(Object.entries(tables).map(([name, value]) => [name, value.content])),
  )).digest('hex')
  return { identity, content, tables }
}

async function drizzleRows(db: SqlExecutor, statement: string): Promise<Array<Record<string, unknown>>> {
  const result = await db.execute(sql.raw(statement))
  if (Array.isArray(result))
    return result as Array<Record<string, unknown>>
  return (result as { rows?: Array<Record<string, unknown>> }).rows ?? []
}

export async function captureFinancePreservationDigest(db: SqlExecutor, schoolId: string): Promise<FinancePreservationDigest> {
  return captureFinancePreservationDigestBySql(statement => drizzleRows(db, statement), schoolId)
}
