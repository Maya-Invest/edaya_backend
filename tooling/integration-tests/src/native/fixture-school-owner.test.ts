import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { createSystemActorMetadata } from '@edaya/authorization'
import { noOpFileStorage, noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { initializeFixtureSchoolOwner, SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const repositories = handles.map(handle => new PostgresSchoolRepositories(handle.db))
const applications = handles.map((handle, index) => new SchoolApplication({ repositories: repositories[index]!, atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb), commandJournal: new PostgresCommandJournal(), fileStorage: noOpFileStorage, notificationGateway: noOpNotificationGateway }))
interface SqlExecutor { execute: (statement: SQL) => Promise<{ rows: unknown[] }> }
const query = (statement: SQL) => (handles[0]!.db as SqlExecutor).execute(statement)
beforeAll(async () => {
  await repositories[0]!.init({ driver: 'node-postgres' })
  for (const id of ['fixture-owner-school', 'fixture-owner-race-a', 'fixture-owner-race-b']) {
    await repositories[0]!.schools.save(new School({ id, name: id, timeZone: 'UTC' }))
    await repositories[0]!.staffMembers.save(new StaffMember({ id: `${id}-staff`, schoolId: id, firstName: 'Fixture', lastName: 'Owner', subjectId: id === 'fixture-owner-school' ? 'fixture-native-owner' : 'fixture-native-shared-owner' }))
  }
})
afterAll(async () => Promise.all(handles.map(handle => handle.dispose())))

function initialize(index: number, schoolId: string, subjectId: string) {
  const actor = createSystemActorMetadata({ schoolId, systemId: 'fixture-seed', requestId: `fixture-owner-${index}`, reason: 'Disposable owner fixture' })
  return initializeFixtureSchoolOwner(applications[index]!.forActor(actor).baseService, { schoolId, staffId: `${schoolId}-staff`, subjectId })
}

test('competing fixture initialization across one-connection pools commits one receipt and audit', async () => {
  await Promise.all(Array.from({ length: 6 }, (_, index) => initialize(index % 2, 'fixture-owner-school', 'fixture-native-owner')))
  expect((await repositories[0]!.schools.findById('fixture-owner-school'))?.ownerSubjectId).toBe('fixture-native-owner')
  expect((await query(sql`SELECT count(*)::int AS total FROM command_receipts WHERE school_id = 'fixture-owner-school'`)).rows).toEqual([{ total: 1 }])
  expect((await query(sql`SELECT count(*)::int AS total FROM command_audit WHERE school_id = 'fixture-owner-school'`)).rows).toEqual([{ total: 1 }])
})

test('a shared subject can concurrently become owner of two fixture schools', async () => {
  await Promise.all([initialize(0, 'fixture-owner-race-a', 'fixture-native-shared-owner'), initialize(1, 'fixture-owner-race-b', 'fixture-native-shared-owner')])
  expect((await query(sql`SELECT count(*)::int AS total FROM schools WHERE owner_subject_id = 'fixture-native-shared-owner'`)).rows).toEqual([{ total: 2 }])
})
