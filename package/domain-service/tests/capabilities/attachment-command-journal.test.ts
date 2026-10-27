import { createStaffActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, AttachmentStatus, createInMemoryFileStorage, noOpNotificationGateway, School, StaffMember } from '@edaya/core'
import { completeAttachmentUpload, createAttachmentUpload, SchoolApplication } from '@edaya/service'
import { expect, onTestFinished, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../adaptor-postgres/src/stores/command-journal-store'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'

const { createRepositoryDatabase, releaseDatabase } = usePooledDatabases()

const bytes = new TextEncoder().encode('%PDF-1.7\nSynthetic command audit body\n%%EOF')
async function fixture() {
  const f = await createRepositoryDatabase()
  onTestFinished(() => releaseDatabase(f.db))
  const journal = new PostgresCommandJournal()
  const storage = createInMemoryFileStorage()
  const actor = createStaffActorMetadata({ schoolId: 'journal-school', subjectId: 'journal-owner', staffMemberId: 'journal-staff', requestId: 'ephemeral-http-request', authenticatedAt: new Date() })
  await f.repositories.schools.save(new School({ id: actor.schoolId, ownerSubjectId: actor.subjectId, name: 'Journal', timeZone: 'UTC' }))
  await f.repositories.staffMembers.save(new StaffMember({ id: actor.staffMemberId, schoolId: actor.schoolId, subjectId: actor.subjectId, firstName: 'Journal', lastName: 'Owner' }))
  const application = new SchoolApplication({ repositories: f.repositories, atomicExecution: f.atomic, commandJournal: journal, fileStorage: storage, notificationGateway: noOpNotificationGateway })
  const service = application.forActor(actor)
  const input = { attachmentId: 'audited-upload', ownerKind: AttachmentOwnerKind.Staff, ownerId: actor.staffMemberId, fileName: 'private-name-not-in-audit.pdf', mimeType: 'application/pdf', sizeBytes: bytes.byteLength }
  async function uploaded() {
    const grant = await createAttachmentUpload(service.baseService, input)
    await storage.putObject({ key: grant.storageKey, body: bytes, contentType: input.mimeType })
    const intent = (await f.repositories.attachmentUploads.find(actor.schoolId, input.attachmentId))!
    return { grant, intent, completion: { ...intent.attachment, status: AttachmentStatus.Ready } }
  }
  return { ...f, actor, application, service, journal, storage, input, uploaded }
}

test('lost upload URL recovery reauthorizes the original intent without replaying credentials', async () => {
  const f = await fixture()
  const originalSign = f.storage.createPresignedUpload
  f.storage.createPresignedUpload = async () => {
    throw new Error('provider token=not-persisted')
  }
  await expect(createAttachmentUpload(f.service.baseService, f.input)).rejects.toThrow('ATTACHMENT_STORAGE_UNAVAILABLE')
  const before = (await f.repositories.attachmentUploads.find(f.actor.schoolId, f.input.attachmentId))!
  f.storage.createPresignedUpload = originalSign
  const renewedActor = createStaffActorMetadata({ ...f.actor, staffMemberId: f.actor.staffMemberId, subjectId: f.actor.subjectId, requestId: 'renewed-http-request', authenticatedAt: new Date() })
  const grant = await createAttachmentUpload(f.application.forActor(renewedActor).baseService, f.input)
  expect(grant.storageKey).toBe(before.attachment.storageKey!)
  expect((await f.repositories.attachmentUploads.find(f.actor.schoolId, f.input.attachmentId))!.expiresAt).toEqual(before.expiresAt)
  const receipts = (await f.db.query('SELECT result, result_mode FROM command_receipts')).rows
  expect(receipts).toEqual([{ result: { attachmentId: f.input.attachmentId }, result_mode: 'secret-display' }])
  const serialized = JSON.stringify((await f.db.query('SELECT * FROM command_receipts')).rows) + JSON.stringify((await f.db.query('SELECT * FROM command_audit')).rows)
  for (const secret of [grant.storageKey, grant.uploadUrl, f.input.fileName, 'provider token', '%PDF'])
    expect(serialized).not.toContain(secret)
  await f.db.exec('UPDATE schools SET owner_subject_id = \'revoked\' WHERE id = \'journal-school\'')
  await expect(createAttachmentUpload(f.service.baseService, f.input)).rejects.toThrow()
})

test('admission audit failure rolls back intent, inventory and receipt together', async () => {
  const f = await fixture()
  const complete = f.journal.complete.bind(f.journal)
  f.journal.complete = async (...args) => {
    await complete(...args)
    throw new Error('audit commit failed')
  }
  await expect(createAttachmentUpload(f.service.baseService, f.input)).rejects.toThrow('audit commit failed')
  expect(await f.repositories.attachmentUploads.find(f.actor.schoolId, f.input.attachmentId)).toBeUndefined()
  for (const table of ['command_receipts', 'command_audit', 'private_file_objects'])
    expect((await f.db.query(`SELECT id FROM ${table}`)).rows).toEqual([])
})

test('completion audit failure cannot publish a ready attachment or completed receipt', async () => {
  const f = await fixture()
  const { completion } = await f.uploaded()
  const complete = f.journal.complete.bind(f.journal)
  f.journal.complete = async (...args) => {
    await complete(...args)
    throw new Error('audit commit failed')
  }
  await expect(completeAttachmentUpload(f.service.baseService, completion)).rejects.toThrow('audit commit failed')
  expect(await f.repositories.attachments.findById(f.input.attachmentId)).toBeUndefined()
  expect((await f.repositories.attachmentUploads.find(f.actor.schoolId, f.input.attachmentId))!.completedStorageKey).toBeUndefined()
  expect((await f.db.query('SELECT command FROM command_receipts')).rows).toEqual([{ command: 'createAttachmentUpload' }])
  expect((await f.db.query('SELECT event FROM command_audit')).rows).toEqual([{ event: 'attachment.upload_intent_authorized' }])
  f.journal.complete = complete
  const first = await completeAttachmentUpload(f.service.baseService, completion)
  const replay = await completeAttachmentUpload(f.service.baseService, completion)
  expect(replay.data).toEqual(first.data)
  expect((await f.db.query('SELECT result FROM command_receipts WHERE command = \'registerAttachment\'')).rows).toEqual([{ result: { attachmentId: first.id } }])
  await f.repositories.attachments.save(new Attachment({ ...first.data, fileName: 'changed.pdf' }))
  await expect(completeAttachmentUpload(f.service.baseService, completion)).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE' })
})

test('removal audit rollback preserves metadata and replay cannot remove a replacement identity', async () => {
  const f = await fixture()
  const { completion } = await f.uploaded()
  const attachment = await completeAttachmentUpload(f.service.baseService, completion)
  const remove = () => f.service.setupWorkflow.removeAttachment({ attachmentId: attachment.id })
  const complete = f.journal.complete.bind(f.journal)
  f.journal.complete = async (...args) => {
    await complete(...args)
    throw new Error('audit commit failed')
  }
  await expect(remove()).rejects.toThrow('audit commit failed')
  expect((await f.repositories.attachments.findById(attachment.id))!.data).toEqual(attachment.data)
  expect((await f.db.query('SELECT id FROM command_receipts WHERE command = \'removeAttachment\'')).rows).toEqual([])
  f.journal.complete = complete
  await remove()
  await remove()
  expect((await f.db.query('SELECT event FROM command_audit WHERE event = \'attachment.removed\'')).rows).toHaveLength(1)
  expect(await f.storage.readObject(attachment.storageKey!, { maxBytes: bytes.byteLength })).not.toBeNull()
  await f.db.exec('UPDATE schools SET owner_subject_id = \'revoked\' WHERE id = \'journal-school\'')
  await expect(remove()).rejects.toThrow()
  await f.db.exec('UPDATE schools SET owner_subject_id = \'journal-owner\' WHERE id = \'journal-school\'')
  await f.repositories.attachments.save(new Attachment({ ...attachment.data, fileName: 'replacement.pdf' }))
  await expect(remove()).rejects.toMatchObject({ code: 'ATTACHMENT_REMOVAL_RESULT_UNAVAILABLE' })
  expect((await f.repositories.attachments.findById(attachment.id))!.fileName).toBe('replacement.pdf')
})
