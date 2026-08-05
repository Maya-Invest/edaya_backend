import { describe, expect, test } from 'bun:test'
import { getTableColumns, sql } from 'drizzle-orm'
import { integer, pgTable, text } from 'drizzle-orm/pg-core'
import {
  BATCH_SAVE_MAX_CHUNK_ROWS,
  batchSaveChunkSize,
  buildConflictUpdateSet,
  chunkArray,
} from './bulk-upsert'

const sampleTable = pgTable('bulk_upsert_sample', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  count: integer('count').notNull(),
})

describe('bulk-upsert helpers', () => {
  test('batchSaveChunkSize clamps to the row and parameter budgets', () => {
    expect(batchSaveChunkSize(2)).toBe(BATCH_SAVE_MAX_CHUNK_ROWS)
    expect(batchSaveChunkSize(100)).toBe(300)
    expect(batchSaveChunkSize(0)).toBe(BATCH_SAVE_MAX_CHUNK_ROWS)
  })

  test('chunkArray splits sequentially and treats empty input as no chunks', () => {
    expect(chunkArray([], 10)).toEqual([])
    expect(chunkArray([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chunkArray([1, 2], 0)).toEqual([[1], [2]])
  })

  test('buildConflictUpdateSet maps every non-id column to excluded."sql_name"', () => {
    const set = buildConflictUpdateSet(sampleTable)
    const columns = getTableColumns(sampleTable)

    expect(Object.keys(set).sort()).toEqual(['count', 'name'])
    expect('id' in set).toBe(false)
    expect(set).toEqual({
      name: sql.raw(`excluded."${columns.name.name}"`),
      count: sql.raw(`excluded."${columns.count.name}"`),
    })
  })
})
