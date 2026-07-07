import { describe, expect, mock, test } from 'bun:test'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { transactionContext } from './lib/transaction'
import { PostgresStore } from './postgres-store'

interface TestEntity { id: string, name: string }

const testTable = pgTable('test_entities', {
  id: text('id').primaryKey(),
  name: text('name'),
})

function createThenableChain<T>(result: T) {
  const chain: Record<string, unknown> & {
    then: (onFulfilled: (value: T) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>
  } = {} as never
  for (const method of ['from', 'where', 'orderBy', 'limit', 'offset', 'values', 'onConflictDoUpdate', 'set', 'insert', 'delete', 'select']) {
    chain[method] = () => chain
  }
  chain.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected)
  return chain
}

function createMockDb(options: {
  selectRows?: Record<string, unknown>[]
  count?: number
} = {}) {
  const selectRows = options.selectRows ?? []
  const count = options.count ?? selectRows.length

  return {
    select: mock(() => createThenableChain(selectRows.length > 0 && 'count' in (selectRows[0] ?? {})
      ? selectRows
      : selectRows.length === 0 && options.count !== undefined
        ? [{ count }]
        : selectRows)),
    insert: mock(() => createThenableChain(undefined)),
    delete: mock(() => createThenableChain(undefined)),
  }
}

describe('PostgresStore', () => {
  const toRow = (entity: TestEntity) => ({ id: entity.id, name: entity.name })
  const toDomain = (row: { id: string, name: string | null }) => ({ id: row.id, name: row.name ?? '' })

  test('findById returns undefined when no row matches', async () => {
    const db = createMockDb({ selectRows: [] })
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.findById('missing')).resolves.toBeUndefined()
  })

  test('findById maps the persisted row through toDomain', async () => {
    const db = createMockDb({ selectRows: [{ id: 'e1', name: 'Alpha' }] })
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.findById('e1')).resolves.toEqual({ id: 'e1', name: 'Alpha' })
  })

  test('findByIds returns an empty list for empty input', async () => {
    const db = createMockDb()
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.findByIds([])).resolves.toEqual([])
    expect(db.select).not.toHaveBeenCalled()
  })

  test('findOne returns the first or last match based on the last flag', async () => {
    const db = createMockDb({
      selectRows: [
        { id: 'e1', name: 'Alpha' },
        { id: 'e2', name: 'Beta' },
      ],
    })
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.findOne({ name: 'Alpha' })).resolves.toEqual({ id: 'e1', name: 'Alpha' })
    await expect(store.findOne({ name: 'Alpha' }, true)).resolves.toEqual({ id: 'e2', name: 'Beta' })
  })

  test('list applies query options and maps all rows', async () => {
    const db = createMockDb({
      selectRows: [
        { id: 'e1', name: 'Alpha' },
        { id: 'e2', name: 'Beta' },
      ],
    })
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.list({
      name: 'Alpha',
      $orderBy: [{ field: 'name', direction: 'asc' }],
      $limit: 10,
      $offset: 0,
    })).resolves.toEqual([
      { id: 'e1', name: 'Alpha' },
      { id: 'e2', name: 'Beta' },
    ])
  })

  test('count returns the aggregate total from the database', async () => {
    const db = createMockDb({ selectRows: [{ count: 7 }] })
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.count({ name: 'Alpha' })).resolves.toBe(7)
  })

  test('save upserts through the active database client', async () => {
    const db = createMockDb()
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await store.save({ id: 'e1', name: 'Alpha' })

    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  test('batchSave and batchDelete no-op on empty input', async () => {
    const db = createMockDb()
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.batchSave([])).resolves.toEqual([])
    await store.batchDelete([])

    expect(db.insert).not.toHaveBeenCalled()
    expect(db.delete).not.toHaveBeenCalled()
  })

  test('batchSave returns saved entity ids', async () => {
    const db = createMockDb()
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await expect(store.batchSave([
      { id: 'e1', name: 'Alpha' },
      { id: 'e2', name: 'Beta' },
    ])).resolves.toEqual(['e1', 'e2'])
    expect(db.insert).toHaveBeenCalledTimes(2)
  })

  test('uses the active transaction client when one is present', async () => {
    const db = createMockDb({ selectRows: [{ id: 'e1', name: 'Alpha' }] })
    const tx = createMockDb({ selectRows: [{ id: 'tx-1', name: 'Transactional' }] })
    const store = new PostgresStore<TestEntity>(db, testTable, toRow, toDomain)

    await transactionContext.run(tx, async () => {
      await expect(store.findById('tx-1')).resolves.toEqual({ id: 'tx-1', name: 'Transactional' })
    })

    expect(db.select).not.toHaveBeenCalled()
    expect(tx.select).toHaveBeenCalledTimes(1)
  })
})
