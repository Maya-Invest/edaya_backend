import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresDurableWork, transactionContext } from '@edaya/adaptor-postgres'
import { createStaffActorMetadata, createSystemActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, noOpFileStorage, noOpNotificationGateway, School, StaffMember, withShortName } from '@edaya/core'
import { dispatchPrivateFileCleanup, preparePrivateFileCleanup, SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'
import { createFixtureRepositories } from '../utils/fixture-repositories'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const stores = handles.map(handle => createFixtureRepositories(handle.db))
const atomics = handles.map(handle => new PostgresAtomicExecution(handle.db as PostgresTransactionalDb))
const actor = createStaffActorMetadata({ schoolId: 'cleanup-school', staffMemberId: 'cleanup-staff', subjectId: 'cleanup-owner', requestId: 'native-cleanup', authenticatedAt: new Date() })
const staff = new StaffMember({ id: actor.staffMemberId, schoolId: actor.schoolId, firstName: 'Cleanup', lastName: 'Owner', subjectId: actor.subjectId })
const deleted: string[] = []
interface Executor { execute: (query: SQL) => Promise<unknown> }
const applications = handles.map((handle, index) => new SchoolApplication({ repositories: stores[index]!, atomicExecution: atomics[index]!, commandJournal: new PostgresCommandJournal(), durableWork: new PostgresDurableWork(handle.db as Executor), notificationGateway: noOpNotificationGateway, fileStorage: { ...noOpFileStorage, async deleteObject(key) {
  expect(transactionContext.getStore()).toBeUndefined()
  expect((await stores[index]!.schools.findById(actor.schoolId))?.id).toBe(actor.schoolId)
  deleted.push(key)
} } }))
const cleanupActor = createSystemActorMetadata({ schoolId: actor.schoolId, systemId: 'preparePrivateFileCleanup', requestId: 'prepare', reason: 'test' })
const prepare = (index: number) => preparePrivateFileCleanup({ service: applications[index]!.forActor(cleanupActor), actor: cleanupActor, asOf: new Date() })
beforeAll(async () => {
  await stores[0]!.init({ driver: 'node-postgres' })
  await stores[0]!.schools.save(new School(withShortName({ id: actor.schoolId, name: 'Cleanup', timeZone: 'UTC', ownerSubjectId: actor.subjectId })))
  await stores[0]!.staffMembers.save(staff)
})
afterAll(() => Promise.all(handles.map(handle => handle.dispose())))

async function attachment(id: string) {
  const value = new Attachment({ id, schoolId: actor.schoolId, ownerKind: AttachmentOwnerKind.Staff, ownerId: staff.id, fileName: 'file.pdf', storageKey: `cleanup-school/${id}.pdf`, mimeType: 'application/pdf' })
  await stores[0]!.attachments.save(value)
  return value
}

test('competing cleanup schedulers and workers delete once while borrowing each one-connection pool outside SQL', async () => {
  const value = await attachment('cleanup-concurrent')
  await applications[0]!.forActor(actor).setupWorkflow.removeAttachment({ attachmentId: value.id })
  const outcomes = await Promise.all([prepare(0), prepare(1)])
  expect(outcomes.reduce((sum, result) => sum + result.processed, 0)).toBe(1)
  const delivery = await Promise.all(applications.map(application => dispatchPrivateFileCleanup(application)))
  expect(delivery.reduce((sum, result) => sum + result.completed, 0)).toBe(1)
  expect(deleted.filter(key => key === value.storageKey)).toHaveLength(1)
}, 10000)

test('a reference committed before removal prevents both metadata deletion and storage cleanup', async () => {
  const value = await attachment('cleanup-reference-wins')
  let referenced!: () => void
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    referenced = resolve
  })
  const finish = new Promise<void>((resolve) => {
    release = resolve
  })
  const link = atomics[0]!.execute(async () => {
    await stores[0]!.staffMembers.save(new StaffMember({ ...staff.data, photoUrl: `https://school.test/core/files/${value.id}/content` }))
    referenced()
    await finish
  })
  await ready
  const remove = applications[1]!.forActor(actor).setupWorkflow.removeAttachment({ attachmentId: value.id })
  release()
  await link
  await expect(remove).rejects.toMatchObject({ code: 'ATTACHMENT_REFERENCED' })
  expect(await stores[0]!.attachments.findById(value.id)).toBeDefined()
  expect((await prepare(0)).processed).toBe(0)
  await stores[0]!.staffMembers.save(staff)
}, 10000)

test('a cleanup tombstone committed before a direct reference prevents that reference', async () => {
  const value = await attachment('cleanup-tombstone-wins')
  await applications[0]!.forActor(actor).setupWorkflow.removeAttachment({ attachmentId: value.id })
  const object = (await stores[0]!.privateFiles.listDue(actor.schoolId, 50)).find(object => object.storageKey === value.storageKey)!
  let tombstoned!: () => void
  let release!: () => void
  const ready = new Promise<void>((resolve) => {
    tombstoned = resolve
  })
  const finish = new Promise<void>((resolve) => {
    release = resolve
  })
  const cleanup = atomics[0]!.execute(async () => {
    expect(await stores[0]!.privateFiles.prepareDeletion(actor.schoolId, object.id, 'native-tombstone-job')).toBe(true)
    tombstoned()
    await finish
  })
  await ready
  const link = stores[1]!.staffMembers.save(new StaffMember({ ...staff.data, photoUrl: `https://files.test/${value.storageKey}` }))
  release()
  await cleanup
  await expect(link).rejects.toMatchObject({ code: 'PRIVATE_FILE_REFERENCE_INVALID' })
  expect((await stores[0]!.staffMembers.findById(staff.id))?.photoUrl).toBeUndefined()
  await expect(stores[1]!.attachments.save(value)).rejects.toMatchObject({ code: 'PRIVATE_FILE_REFERENCE_INVALID' })
}, 10000)

test('concurrent reservations cannot create sidecar aliases on a development filesystem', async () => {
  const keys = ['cleanup-school/alias.pdf', 'cleanup-school/alias.pdf.meta.json']
  const outcomes = await Promise.allSettled(keys.map((storageKey, index) => atomics[index]!.execute(() => stores[index]!.privateFiles.reserve({ schoolId: actor.schoolId, storageKey, protectedUntil: new Date(Date.now() + 60000) }))))
  expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(outcomes.filter(result => result.status === 'rejected')).toHaveLength(1)
}, 10000)
