import type { ActorMetadata } from '@edaya/authorization'
import type { SchoolRepositories } from '@edaya/service'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { PostgresSchoolRepositories, PostgresStore } from '@edaya/adaptor-postgres'
import { ManagedEntityService } from '@edaya/service'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'
import { directSchoolTenant } from '../../../../package/domain-service/src/services/entities/entity-config/tenant'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Run this suite with bun run test:integration:native; a disposable loopback cluster is required')

const table = pgTable('rc_tenant_rows', { id: text('id').primaryKey(), schoolId: text('school_id').notNull() })
const handle = await createPostgresSchoolDatabase(url)
const db = handle.db as NodePgDatabase
const repository = new PostgresStore(handle.db, table, (row: { id: string, schoolId: string }) => row, row => row)
const service = new ManagedEntityService({
  actor: { kind: 'system', schoolId: 'school-a' } as ActorMetadata,
  repositories: {} as SchoolRepositories,
  config: {
    repository,
    tenant: directSchoolTenant(),
    read: { checkModule: async () => {}, checkAccess: async () => {} },
    write: { checkModule: async () => {}, authorizeSave: async () => {}, authorizeDelete: async () => {} },
  },
})

beforeAll(async () => {
  await new PostgresSchoolRepositories(db).init({ driver: 'node-postgres' })
  await db.execute(sql`CREATE TABLE rc_tenant_rows (id text PRIMARY KEY, school_id text NOT NULL)`)
  await repository.batchSave([
    { id: '0-foreign', schoolId: 'school-b' },
    { id: '1-local', schoolId: 'school-a' },
    { id: '2-local', schoolId: 'school-a' },
  ])
}, 30000)
afterAll(() => handle.dispose())

describe('native tenant query boundary', () => {
  test('elevated counts stay in the selected school with empty and mixed filters', async () => {
    expect(await service.count({})).toBe(2)
    expect(await service.count({ schoolId: { $in: ['school-a', 'school-b'] } })).toBe(2)
    expect(await service.count({ $or: [{ schoolId: 'school-b' }, { id: '1-local' }] })).toBe(1)
  })

  test('tenant scope applies before ordering, pagination and findOne', async () => {
    expect(await service.list({ $orderBy: [{ field: 'id', direction: 'asc' }], $limit: 1 }))
      .toEqual([{ id: '1-local', schoolId: 'school-a' }])
    expect(await service.findOne({ $orderBy: [{ field: 'id', direction: 'asc' }] }))
      .toEqual({ id: '1-local', schoolId: 'school-a' })
  })
})

describe('native scoped write boundary', () => {
  test('checks both the proposed school and conflicting row in the write statement', async () => {
    const scoped = repository.forSchool('school-a')
    await expect(scoped.save({ id: '0-foreign', schoolId: 'school-a' })).rejects.toThrow()
    await expect(scoped.save({ id: 'foreign-insert', schoolId: 'school-b' })).rejects.toThrow()
    expect(await repository.findById('0-foreign')).toEqual({ id: '0-foreign', schoolId: 'school-b' })
    expect(await repository.findById('foreign-insert')).toBeUndefined()
    await scoped.delete('0-foreign')
    await scoped.batchDelete(['0-foreign'])
    expect(await repository.findById('0-foreign')).toBeDefined()
  })

  test('rolls back a mixed batch when a later row collides with another school', async () => {
    await expect(repository.forSchool('school-a').batchSave([
      { id: 'rollback-new', schoolId: 'school-a' },
      { id: '0-foreign', schoolId: 'school-a' },
    ])).rejects.toThrow()
    expect(await repository.findById('rollback-new')).toBeUndefined()
  })

  test('concurrent inserts from independent connections cannot take over the same ID', async () => {
    const second = await createPostgresSchoolDatabase(url!)
    try {
      const secondRepository = new PostgresStore(second.db, table, (row: { id: string, schoolId: string }) => row, row => row)
      const outcomes = await Promise.allSettled([
        repository.forSchool('school-a').save({ id: 'concurrent-id', schoolId: 'school-a' }),
        secondRepository.forSchool('school-b').save({ id: 'concurrent-id', schoolId: 'school-b' }),
      ])
      expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
      expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1)
      const winner = outcomes[0]!.status === 'fulfilled' ? 'school-a' : 'school-b'
      expect((await repository.findById('concurrent-id'))?.schoolId).toBe(winner)
    }
    finally {
      await second.dispose()
    }
  })

  test('rejects duplicate batch IDs before any write', async () => {
    await expect(repository.forSchool('school-a').batchSave([
      { id: 'duplicate-new', schoolId: 'school-a' },
      { id: 'duplicate-new', schoolId: 'school-a' },
    ])).rejects.toThrow('unique entity IDs')
    expect(await repository.findById('duplicate-new')).toBeUndefined()
  })
})
