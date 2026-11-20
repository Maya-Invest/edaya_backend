import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import { getTableColumns, sql } from 'drizzle-orm'

/** Soft cap on rows per statement; also clamped by Postgres bind-parameter limits. */
export const BATCH_SAVE_MAX_CHUNK_ROWS = 500

/** Stay well under Postgres' ~65535 bind-parameter limit. */
const BATCH_SAVE_PARAM_BUDGET = 30_000

export function batchSaveChunkSize(columnCount: number): number {
  const safeColumnCount = Math.max(1, columnCount)
  return Math.min(
    BATCH_SAVE_MAX_CHUNK_ROWS,
    Math.max(1, Math.floor(BATCH_SAVE_PARAM_BUDGET / safeColumnCount)),
  )
}

/**
 * Build an ON CONFLICT DO UPDATE set map that copies each non-id column from
 * the proposed insert row (`excluded."col"`). Required for multi-row upserts.
 */
export function buildConflictUpdateSet(
  table: PgTable,
  writableKeys = Object.keys(getTableColumns(table)),
): Record<string, SQL> {
  const columns = getTableColumns(table)
  const set: Record<string, SQL> = {}
  for (const [key, column] of Object.entries(columns)) {
    if (key === 'id' || !writableKeys.includes(key)) {
      continue
    }
    set[key] = sql.raw(`excluded."${column.name}"`)
  }
  return set
}

export function chunkArray<T>(items: readonly T[], chunkSize: number): T[][] {
  if (items.length === 0) {
    return []
  }
  const size = Math.max(1, chunkSize)
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}
