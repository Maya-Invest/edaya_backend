import { createStaffActorMetadata, createSystemActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, createInMemoryFileStorage, noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { dispatchPrivateFileCleanup, preparePrivateFileCleanup, SchoolApplication } from '@edaya/service'
import { expect, onTestFinished, test } from 'bun:test'
import { transactionContext } from '../../../adaptor-postgres/src/lib/transaction'
import { PostgresCommandJournal } from '../../../adaptor-postgres/src/stores/command-journal-store'
import { PostgresDurableWork } from '../../../adaptor-postgres/src/stores/durable-work-store'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'

const { createRepositoryDatabase, releaseDatabase } = usePooledDatabases()

async function fixture() {
  const f = await createRepositoryDatabase()
  onTestFinished(() => releaseDatabase(f.db))
  const storage = createInMemoryFileStorage()
  const actor = createStaffActorMetadata({ schoolId: 'file-school', subjectId: 'file-owner', staffMemberId: 'file-staff', requestId: 'file-test', authenticatedAt: new Date() })
  await f.repositories.schools.save(new School({ id: actor.schoolId, name: 'Files', ownerSubjectId: actor.subjectId, timeZone: 'UTC' }))
  const staff = new StaffMember({ id: actor.staffMemberId, schoolId: actor.schoolId, firstName: 'File', lastName: 'Owner', subjectId: actor.subjectId })
  await f.repositories.staffMembers.save(staff)
  const deleted: string[] = []
  let failDelete = false
  const journal = new PostgresCommandJournal()
  const application = new SchoolApplication({ repositories: f.repositories, atomicExecution: f.atomic, commandJournal: journal, durableWork: new PostgresDurableWork(f.connection), notificationGateway: noOpNotificationGateway, fileStorage: {
    ...storage,
    async deleteObject(key) {
      expect(transactionContext.getStore()).toBeUndefined()
      if (failDelete)
        throw new Error('Provider credential=private-secret')
      deleted.push(key)
      await storage.deleteObject(key)
    },
  } })
  const service = application.forActor(actor)
  const cleanupActor = createSystemActorMetadata({ schoolId: actor.schoolId, systemId: 'preparePrivateFileCleanup', requestId: 'cleanup', reason: 'test' })
  const prepare = () => preparePrivateFileCleanup({ service: application.forActor(cleanupActor), actor: cleanupActor, asOf: new Date() })
  const attachment = new Attachment({ id: 'file-attachment', schoolId: actor.schoolId, ownerKind: AttachmentOwnerKind.Staff, ownerId: staff.id, fileName: 'test.pdf', storageKey: 'file-school/private/test.pdf', mimeType: 'application/pdf', sizeBytes: 3 })
  await f.repositories.attachments.save(attachment)
  await storage.putObject({ key: attachment.storageKey!, body: new Uint8Array([1, 2, 3]), contentType: 'application/pdf' })
  const remove = () => service.setupWorkflow.removeAttachment({ attachmentId: attachment.id })
  return { ...f, storage, service, application, prepare, remove, attachment, staff, deleted, journal, setFailure: (value: boolean) => {
    failDelete = value
  } }
}

test('canonical photo references protect metadata, and detachment schedules private deletion after commit', async () => {
  const f = await fixture()
  await f.repositories.staffMembers.save(new StaffMember({ ...f.staff.data, photoUrl: `https://school.test/core/files/${f.attachment.id}/content` }))
  await expect(f.remove()).rejects.toMatchObject({ code: 'ATTACHMENT_REFERENCED' })
  expect(await f.repositories.attachments.findById(f.attachment.id)).toBeDefined()
  await f.repositories.staffMembers.save(f.staff)
  await f.remove()
  expect(f.deleted).toEqual([])
  expect((await f.repositories.privateFiles.listDue('file-school', 10)).map(value => value.storageKey)).toEqual([f.attachment.storageKey!])
  expect(await f.prepare()).toEqual({ processed: 1, skipped: 0 })
  expect(f.deleted).toEqual([])
  expect(await dispatchPrivateFileCleanup(f.application)).toEqual({ completed: 1, failed: 0, lostLease: 0 })
  expect(f.deleted).toEqual([f.attachment.storageKey!])
  expect(await f.storage.readObject(f.attachment.storageKey!, { maxBytes: 10 })).toBeNull()
  expect(await dispatchPrivateFileCleanup(f.application)).toEqual({ completed: 0, failed: 0, lostLease: 0 })
  const audit = await f.db.query('SELECT event, resource_type, resource_id FROM command_audit ORDER BY event')
  expect(audit.rows).toMatchObject([{ event: 'attachment.removed', resource_type: 'attachment', resource_id: f.attachment.id }, { event: 'private_file.cleanup_requested', resource_type: 'private-file-object' }])
  expect(JSON.stringify(audit.rows)).not.toContain('test.pdf')
})

test('encoded direct object references retain bytes until cleared', async () => {
  const f = await fixture()
  await f.repositories.staffMembers.save(new StaffMember({ ...f.staff.data, photoUrl: `https://files.test/memory/${encodeURIComponent(f.attachment.storageKey!)}?signature=redacted` }))
  await f.remove()
  expect(await f.prepare()).toEqual({ processed: 0, skipped: 0 })
  expect(f.deleted).toEqual([])
  await f.repositories.staffMembers.save(f.staff)
  expect(await f.prepare()).toEqual({ processed: 1, skipped: 0 })
  await dispatchPrivateFileCleanup(f.application)
  expect(f.deleted).toEqual([f.attachment.storageKey!])
})

test('removal failure rolls metadata and cleanup eligibility back together', async () => {
  const f = await fixture()
  await expect(f.atomic.execute(async () => {
    await f.remove()
    throw new Error('Rollback removal')
  })).rejects.toThrow('Rollback removal')
  expect(await f.repositories.attachments.findById(f.attachment.id)).toBeDefined()
  expect(await f.prepare()).toEqual({ processed: 0, skipped: 0 })
  expect(f.deleted).toEqual([])
})

test('outbox persistence failure rolls the deletion tombstone back', async () => {
  const f = await fixture()
  await f.remove()
  const beforeReceipts = (await f.db.query('SELECT id FROM command_receipts ORDER BY id')).rows
  const complete = f.journal.complete.bind(f.journal)
  f.journal.complete = async () => {
    throw new Error('Journal failure')
  }
  await expect(f.prepare()).rejects.toThrow('Journal failure')
  expect((await f.repositories.privateFiles.listDue('file-school', 10))[0]?.status).toBe('reserved')
  expect((await f.db.query('SELECT id FROM command_receipts ORDER BY id')).rows).toEqual(beforeReceipts)
  expect((await f.db.query('SELECT id FROM command_outbox')).rows).toEqual([])
  f.journal.complete = complete
  await f.prepare()
  await dispatchPrivateFileCleanup(f.application)
  expect(f.deleted).toEqual([f.attachment.storageKey!])
})

test('provider failure retries with a stable code, and daily tombstone sweeps remove late writes', async () => {
  const f = await fixture()
  await f.remove()
  await f.prepare()
  f.setFailure(true)
  expect(await dispatchPrivateFileCleanup(f.application)).toEqual({ completed: 0, failed: 1, lostLease: 0 })
  expect((await f.db.query('SELECT failure_code FROM command_outbox')).rows).toEqual([{ failure_code: 'PRIVATE_FILE_STORAGE_UNAVAILABLE' }])
  f.setFailure(false)
  await f.db.exec('UPDATE command_outbox SET next_attempt_at = \'2000-01-01\'')
  await dispatchPrivateFileCleanup(f.application)
  await f.storage.putObject({ key: f.attachment.storageKey!, body: new Uint8Array([4]), contentType: 'application/pdf' })
  await f.db.exec('UPDATE private_file_objects SET protected_until = \'2000-01-01\'')
  expect(await f.prepare()).toEqual({ processed: 1, skipped: 0 })
  await dispatchPrivateFileCleanup(f.application)
  expect(f.deleted).toEqual([f.attachment.storageKey!, f.attachment.storageKey!])
})

test('tombstones forbid new metadata, direct photo references and reservation renewal', async () => {
  const f = await fixture()
  await f.remove()
  await f.prepare()
  await expect(f.repositories.attachments.save(f.attachment)).rejects.toThrow()
  await expect(f.repositories.staffMembers.save(new StaffMember({ ...f.staff.data, photoUrl: `https://files.test/${f.attachment.storageKey}` }))).rejects.toThrow()
  await expect(f.atomic.execute(() => f.repositories.privateFiles.reserve({ schoolId: 'file-school', storageKey: f.attachment.storageKey!, protectedUntil: new Date(Date.now() + 10000) }))).rejects.toMatchObject({ code: 'PRIVATE_FILE_UNAVAILABLE' })
  expect((await f.repositories.staffMembers.findById(f.staff.id))?.photoUrl).toBeUndefined()
})

test('cleanup is internal-only and school-scoped', async () => {
  const f = await fixture()
  await expect(f.service.baseService.access.attachments.assertCleanup()).rejects.toThrow()
  await f.remove()
  expect(await f.repositories.privateFiles.listDue('foreign-school', 10)).toEqual([])
  const candidate = (await f.repositories.privateFiles.listDue('file-school', 10))[0]!
  expect(await f.atomic.execute(() => f.repositories.privateFiles.prepareDeletion('foreign-school', candidate.id, 'forged-job'))).toBe(false)
  await f.prepare()
  const work = (await f.db.query<{ id: string }>('SELECT id FROM command_outbox')).rows[0]!
  expect(await f.repositories.privateFiles.findDeletion('foreign-school', candidate.id, work.id)).toBeUndefined()
  expect(await f.repositories.privateFiles.findDeletion('file-school', candidate.id, 'forged-job')).toBeUndefined()
})

test('capability references participate in the same transaction and cannot overwrite native reference namespaces', async () => {
  const f = await fixture()
  const source = { schoolId: 'file-school', sourceType: 'capability.fixture', sourceId: 'synthetic-record', slot: 'document' }
  await f.atomic.execute(() => f.repositories.privateFiles.retain({ ...source, attachmentId: f.attachment.id }))
  await expect(f.remove()).rejects.toMatchObject({ code: 'ATTACHMENT_REFERENCED' })
  await expect(f.atomic.execute(() => f.repositories.privateFiles.release({ ...source, sourceType: 'staff_members' }))).rejects.toMatchObject({ code: 'PRIVATE_FILE_REFERENCE_INVALID' })
  await f.atomic.execute(() => f.repositories.privateFiles.release({ ...source, schoolId: 'foreign-school' }))
  await expect(f.remove()).rejects.toMatchObject({ code: 'ATTACHMENT_REFERENCED' })
  await f.atomic.execute(() => f.repositories.privateFiles.release(source))
  await f.remove()
  expect(await f.prepare()).toEqual({ processed: 1, skipped: 0 })
})

test('abandoned staging and failed accepted copies are inventoried before I/O and swept after their protection window', async () => {
  const f = await fixture()
  const { createAttachmentUpload, completeAttachmentUpload } = await import('../../src/capabilities/files/attachment-uploads')
  const body = new TextEncoder().encode('%PDF-1.7\nSynthetic upload\n%%EOF')
  const input = { attachmentId: 'abandoned', ownerKind: AttachmentOwnerKind.Staff, ownerId: f.staff.id, fileName: 'abandoned.pdf', mimeType: 'application/pdf', sizeBytes: body.byteLength }
  const intent = await createAttachmentUpload(f.service.baseService, input)
  await f.storage.putObject({ key: intent.storageKey, body, contentType: input.mimeType })
  f.repositories.attachmentUploads.complete = async () => {
    throw new Error('Injected completion failure')
  }
  await expect(completeAttachmentUpload(f.service.baseService, { ...input, id: input.attachmentId, schoolId: 'file-school', storageKey: intent.storageKey })).rejects.toThrow('Injected completion failure')
  expect(await f.repositories.attachments.findById(input.attachmentId)).toBeUndefined()
  expect(await f.prepare()).toEqual({ processed: 0, skipped: 0 })
  await f.db.exec('UPDATE private_file_objects SET protected_until = \'2000-01-01\' WHERE isfinite(protected_until); UPDATE attachment_uploads SET expires_at = \'2000-01-01\'')
  expect(await f.prepare()).toEqual({ processed: 2, skipped: 0 })
  await dispatchPrivateFileCleanup(f.application)
  expect(f.deleted).toContain(intent.storageKey)
  expect(f.deleted.some(key => key.startsWith('file-school/accepted/abandoned/'))).toBe(true)
  expect(f.deleted).not.toContain(f.attachment.storageKey!)
})

test('ambiguous legacy disk key families are retained and cannot be introduced by new write reservations', async () => {
  const f = await fixture()
  const alias = `${f.attachment.storageKey}.meta.json`
  await expect(f.atomic.execute(() => f.repositories.privateFiles.reserve({ schoolId: 'file-school', storageKey: alias, protectedUntil: new Date(Date.now() + 10000) }))).rejects.toMatchObject({ code: 'PRIVATE_FILE_UNAVAILABLE' })
  // Imported raw metadata may already have an alias; preserve both until migration resolves it.
  await f.repositories.attachments.save(new Attachment({ ...f.attachment.data, id: 'legacy-alias', storageKey: alias }))
  await f.remove()
  expect(await f.prepare()).toEqual({ processed: 0, skipped: 0 })
  expect(f.deleted).toEqual([])
  expect(await f.repositories.attachments.findById('legacy-alias')).toBeDefined()
})

test('opaque legacy external aliases retain their private object until the owning feature migrates them', async () => {
  const f = await fixture()
  const fileUrl = 'https://legacy-files.test/opaque-public-alias'
  await f.repositories.attachments.save(new Attachment({ ...f.attachment.data, fileUrl }))
  await f.repositories.staffMembers.save(new StaffMember({ ...f.staff.data, photoUrl: fileUrl }))
  await expect(f.remove()).rejects.toMatchObject({ code: 'ATTACHMENT_LEGACY_ALIAS' })
  expect(await f.repositories.attachments.findById(f.attachment.id)).toBeDefined()
  expect(await f.prepare()).toEqual({ processed: 0, skipped: 0 })
  expect(f.deleted).toEqual([])
  expect(await f.storage.readObject(f.attachment.storageKey!, { maxBytes: 10 })).not.toBeNull()
})
