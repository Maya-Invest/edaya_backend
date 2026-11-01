import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresSchoolRepositories, runMigrations, transactionContext } from '@edaya/adaptor-postgres'
import { createStaffActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, createInMemoryFileStorage, noOpNotificationGateway, resourceAccessScope, School, StaffMember } from '@edaya/core'
import { completeAttachmentUpload, createAttachmentUpload, loadAttachmentAsset, SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
const handle = await createPostgresSchoolDatabase(url)
interface SqlExecutor { execute: (statement: SQL) => Promise<{ rows: unknown[] }> }
const query = (statement: SQL) => (handle.db as SqlExecutor).execute(statement)
const repositories = new PostgresSchoolRepositories(handle.db)
const storage = createInMemoryFileStorage()
let revokeDuringRead = false
const actor = createStaffActorMetadata({ schoolId: 'asset-school', staffMemberId: 'asset-staff', subjectId: 'asset-owner', requestId: 'asset-read', authenticatedAt: new Date() })
const application = new SchoolApplication({
  repositories,
  atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb),
  commandJournal: new PostgresCommandJournal(),
  notificationGateway: noOpNotificationGateway,
  fileStorage: {
    ...storage,
    async readObject(key, options) {
      expect(transactionContext.getStore()).toBeUndefined()
      // Both calls borrow the same pool's sole connection during object I/O.
      const school = (await repositories.schools.findById('asset-school'))!
      if (revokeDuringRead)
        await repositories.schools.save(new School({ ...school.data, ownerSubjectId: 'new-owner' }))
      return storage.readObject(key, options)
    },
  },
})
beforeAll(async () => {
  await runMigrations(handle.db, { driver: 'node-postgres' })
  await repositories.schools.save(new School({ id: 'asset-school', name: 'Asset fixture', timeZone: 'UTC', ownerSubjectId: actor.subjectId }))
  await repositories.staffMembers.save(new StaffMember({ id: 'asset-staff', schoolId: 'asset-school', firstName: 'Asset', lastName: 'Owner', subjectId: actor.subjectId }))
  await repositories.attachments.save(new Attachment({ id: 'native-asset', schoolId: 'asset-school', ownerKind: AttachmentOwnerKind.Staff, ownerId: 'asset-staff', fileName: 'asset.png', storageKey: 'asset-school/private/asset', mimeType: 'image/png', sizeBytes: 3 }))
  await storage.putObject({ key: 'asset-school/private/asset', body: new Uint8Array([1, 2, 3]), contentType: 'image/png' })
})
afterAll(() => handle.dispose())

test('private asset reads release the pool-size-one connection and recheck current access', async () => {
  const request = { attachmentId: 'native-asset', ownerKind: AttachmentOwnerKind.Staff, ownerId: 'asset-staff', maxBytes: 3, allowedMimeTypes: ['image/png'] }
  const base = application.forActor(actor).baseService
  await expect(loadAttachmentAsset(base, request)).resolves.toMatchObject({ body: new Uint8Array([1, 2, 3]) })
  revokeDuringRead = true
  await expect(loadAttachmentAsset(base, request)).rejects.toThrow()
}, 10000)

test('competing upload completions publish one immutable key without borrowing a connection inside SQL', async () => {
  const second = await createPostgresSchoolDatabase(url!)
  try {
    const uploadActor = createStaffActorMetadata({ schoolId: 'upload-school', staffMemberId: 'upload-staff', subjectId: 'upload-owner', requestId: 'upload', authenticatedAt: new Date() })
    await repositories.schools.save(new School({ id: 'upload-school', name: 'Uploads', timeZone: 'UTC', ownerSubjectId: uploadActor.subjectId }))
    await repositories.staffMembers.save(new StaffMember({ id: 'upload-staff', schoolId: 'upload-school', firstName: 'Upload', lastName: 'Owner', subjectId: uploadActor.subjectId }))
    const applications = [handle, second].map((current) => {
      const stores = new PostgresSchoolRepositories(current.db)
      const outsideTransaction = async () => {
        expect(transactionContext.getStore()).toBeUndefined()
        await stores.schools.findById('upload-school')
      }
      return new SchoolApplication({
        repositories: stores,
        atomicExecution: new PostgresAtomicExecution(current.db as PostgresTransactionalDb),
        commandJournal: new PostgresCommandJournal(),
        notificationGateway: noOpNotificationGateway,
        fileStorage: {
          ...storage,
          createPresignedUpload: async (input) => {
            await outsideTransaction()
            return storage.createPresignedUpload(input)
          },
          readObject: async (key, options) => {
            await outsideTransaction()
            return storage.readObject(key, options)
          },
          putObject: async (input) => {
            await outsideTransaction()
            return storage.putObject(input)
          },
        },
      }).forActor(uploadActor).baseService
    })
    const body = new TextEncoder().encode('%PDF-1.7\nSynthetic upload fixture\n%%EOF')
    const input = { attachmentId: 'concurrent-upload', ownerKind: AttachmentOwnerKind.Staff, ownerId: 'upload-staff', fileName: 'sample.pdf', mimeType: 'application/pdf', sizeBytes: body.byteLength }
    const intents = await Promise.all(Array.from({ length: 6 }, (_, index) => createAttachmentUpload(applications[index % 2]!, input)))
    expect(new Set(intents.map(intent => intent.storageKey)).size).toBe(1)
    const key = intents[0]!.storageKey
    await storage.putObject({ key, body, contentType: input.mimeType })
    const command = { ...input, id: input.attachmentId, schoolId: 'upload-school', storageKey: key }
    const completed = await Promise.all(Array.from({ length: 6 }, (_, index) => completeAttachmentUpload(applications[index % 2]!, command)))
    expect(new Set(completed.map(attachment => attachment.storageKey)).size).toBe(1)
    expect(completed[0]!.storageKey).not.toBe(key)
    const intent = await repositories.attachmentUploads.find('upload-school', input.attachmentId)
    expect(intent?.completedStorageKey).toBe(completed[0]!.storageKey)
    expect(intent?.checksum).toBe(completed[0]!.checksum)
    const receiptRows = await query(sql`SELECT command, count(*)::int AS total FROM command_receipts WHERE school_id = 'upload-school' GROUP BY command ORDER BY command`)
    expect(receiptRows.rows).toEqual([{ command: 'createAttachmentUpload', total: 1 }, { command: 'registerAttachment', total: 1 }])
    const auditRows = await query(sql`SELECT event, count(*)::int AS total FROM command_audit WHERE school_id = 'upload-school' GROUP BY event ORDER BY event`)
    expect(auditRows.rows).toEqual([{ event: 'attachment.upload_completed', total: 1 }, { event: 'attachment.upload_intent_authorized', total: 1 }])

    const retryInput = { ...input, attachmentId: 'rollback-upload' }
    const retryIntent = await createAttachmentUpload(applications[0]!, retryInput)
    await storage.putObject({ key: retryIntent.storageKey, body, contentType: input.mimeType })
    const retryCommand = { ...command, id: retryInput.attachmentId, storageKey: retryIntent.storageKey }
    const store = applications[0]!.repositories.attachmentUploads
    const complete = store.complete.bind(store)
    store.complete = async () => {
      throw new Error('Injected intent failure')
    }
    await expect(completeAttachmentUpload(applications[0]!, retryCommand)).rejects.toThrow('Injected intent failure')
    expect(await repositories.attachments.findById(retryInput.attachmentId)).toBeUndefined()
    expect((await repositories.attachmentUploads.find('upload-school', retryInput.attachmentId))?.completedStorageKey).toBeUndefined()
    store.complete = complete
    await expect(completeAttachmentUpload(applications[0]!, retryCommand)).resolves.toMatchObject({ id: retryInput.attachmentId })
  }
  finally {
    await second.dispose()
  }
}, 15000)

test('purpose-aware byte loading rechecks current policy outside a pool-size-one transaction', async () => {
  revokeDuringRead = false
  await repositories.schools.save(new School({ id: 'asset-school', name: 'Asset fixture', timeZone: 'UTC', ownerSubjectId: actor.subjectId }))
  const base = application.forActor(actor).baseService
  const purpose = 'fixture.private'
  await repositories.attachments.save(new Attachment({ id: 'native-purpose', schoolId: 'asset-school', ownerKind: AttachmentOwnerKind.Staff, ownerId: 'asset-staff', purpose, fileName: 'asset.png', storageKey: 'asset-school/private/purpose', mimeType: 'image/png', sizeBytes: 3 }))
  await storage.putObject({ key: 'asset-school/private/purpose', body: new Uint8Array([1, 2, 3]), contentType: 'image/png' })
  const access = { purpose, readScope: async () => {
    await base.access.attachments.assertConfigure()
    return resourceAccessScope('asset-school', 'attachments', [{ target: { kind: 'records', ids: ['asset-staff'] }, attachmentOwners: [AttachmentOwnerKind.Staff], attachmentPurposes: [purpose] }])
  } }
  const request = { attachmentId: 'native-purpose', ownerKind: AttachmentOwnerKind.Staff, ownerId: 'asset-staff', maxBytes: 3, allowedMimeTypes: ['image/png'], access }
  expect(await base.entities.attachments.findById('native-purpose')).toBeUndefined()
  await expect(loadAttachmentAsset(base, request)).resolves.toMatchObject({ body: new Uint8Array([1, 2, 3]) })
  revokeDuringRead = true
  await expect(loadAttachmentAsset(base, request)).rejects.toThrow()
}, 10000)
