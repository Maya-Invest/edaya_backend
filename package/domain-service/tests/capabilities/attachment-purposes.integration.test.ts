import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AttachmentReadPolicy, AttachmentUploadPolicy } from '../../src/capabilities/files/attachment-purpose-access'
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { Attachment, AttachmentOwnerKind, AttachmentStatus, createInMemoryFileStorage, noOpNotificationGateway, resourceAccessScope } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { PostgresCommandJournal } from '../../../adaptor-postgres/src/stores/command-journal-store'
import { seedAuthorizationRelationships } from '../../../adaptor-postgres/tests/support/authorization-database'
import { usePooledDatabases } from '../../../adaptor-postgres/tests/support/pooled-database'
import { completeAttachmentUpload, createAttachmentUpload } from '../../src/capabilities/files/attachment-uploads'
import { grantAttachmentDownload } from '../../src/capabilities/files/grant-attachment-download'
import { loadAttachmentAsset } from '../../src/capabilities/files/load-attachment-asset'
import { SchoolService } from '../../src/services/school-service'

const { createAuthorizationDatabase, releaseDatabase } = usePooledDatabases()

const identity = { schoolId: 'school-a', subjectId: 'person-a', academicYearId: 'year-a', requestId: 'purpose-matrix', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
const staff = createStaffActorMetadata({ ...identity, staffMemberId: 'staff-a' })
const teacher = createTeacherActorMetadata({ ...identity, teacherId: 'teacher-a' })
const guardian = createGuardianActorMetadata({ ...identity, guardianId: 'guardian-a' })
const student = createStudentActorMetadata({ ...identity, studentId: 'student-a' })
const purpose = 'fixture.review'
const body = new TextEncoder().encode('%PDF-1.7\nSynthetic purpose fixture\n%%EOF')

describe('purpose-restricted private attachments', () => {
  let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
  let storage: ReturnType<typeof createInMemoryFileStorage>
  beforeEach(async () => {
    fixture = await createAuthorizationDatabase()
    storage = createInMemoryFileStorage()
    await seedAuthorizationRelationships(fixture.db)
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'; UPDATE students SET subject_id = \'person-a\' WHERE id = \'student-a\'')
  })
  afterEach(async () => releaseDatabase(fixture.db))
  function service(actor: SchoolScopedActorMetadata = staff) {
    return new SchoolService({ actor, repositories: fixture.repositories, atomicExecution: fixture.atomic, commandJournal: new PostgresCommandJournal(), notificationGateway: noOpNotificationGateway, fileStorage: storage })
  }
  async function attachment(id: string, selectedPurpose = 'general', schoolId = 'school-a', ownerId = 'student-a') {
    const value = new Attachment({ id, schoolId, ownerKind: AttachmentOwnerKind.Student, ownerId, purpose: selectedPurpose, fileName: 'private.pdf', storageKey: `${schoolId}/${id}.pdf`, mimeType: 'application/pdf', sizeBytes: body.byteLength })
    await fixture.repositories.attachments.save(value)
    await storage.putObject({ key: value.storageKey!, contentType: value.mimeType!, body })
    return value
  }
  function featurePolicy(base: ReturnType<typeof service>['baseService']): AttachmentReadPolicy & AttachmentUploadPolicy {
    // A synthetic owning policy exercises the extension without implementing a future feature.
    // Its school-wide configure authority is reloaded; scope additionally fixes child and purpose.
    const scope = async () => {
      await base.access.attachments.assertConfigure()
      return resourceAccessScope('school-a', 'attachments', [{ target: { kind: 'student', studentId: 'student-a' }, attachmentOwners: [AttachmentOwnerKind.Student], attachmentPurposes: [purpose] }])
    }
    return { purpose, readScope: scope, assertSave: scope }
  }

  test.each([staff, teacher, guardian, student])('$kind metadata and downloads exclude restricted purposes before pagination', async (actor) => {
    await attachment('a-private', purpose)
    await attachment('b-general')
    await attachment('c-unknown', 'unregistered.secret')
    await attachment('d-general')
    await attachment('foreign', 'general', 'school-b', 'student-b')
    const base = service(actor).baseService
    expect((await base.entities.attachments.list({ $orderBy: [{ field: 'id', direction: 'asc' }], $offset: 1, $limit: 1 })).map(row => row.id)).toEqual(['d-general'])
    expect(await base.entities.attachments.count()).toBe(2)
    expect(await base.entities.attachments.count({ purpose })).toBe(0)
    expect(await base.entities.attachments.findById('a-private')).toBeUndefined()
    expect(await base.entities.attachments.findById('foreign')).toBeUndefined()
    expect(await grantAttachmentDownload(base, 'a-private')).toBeNull()
    await expect(loadAttachmentAsset(base, { attachmentId: 'a-private', ownerKind: AttachmentOwnerKind.Student, ownerId: 'student-a', maxBytes: body.byteLength, allowedMimeTypes: ['application/pdf'] })).rejects.toThrow()
  })

  test('purpose is immutable in persistence and cannot be selected in a generic upload', async () => {
    const value = await attachment('private', purpose)
    await expect(fixture.repositories.attachments.save(new Attachment({ ...value.data, purpose: 'general' }))).rejects.toMatchObject({ code: 'ATTACHMENT_PURPOSE_INVALID' })
    expect((await fixture.repositories.attachments.findById(value.id))!.purpose).toBe(purpose)
    const input = { ownerKind: AttachmentOwnerKind.Student, ownerId: 'student-a', fileName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: body.byteLength, purpose }
    await expect(createAttachmentUpload(service().baseService, input)).rejects.toMatchObject({ code: 'ATTACHMENT_PURPOSE_NOT_ALLOWED' })
  })

  test('a named capability admits and completes only its persisted purpose; generic replay remains concealed', async () => {
    const base = service().baseService
    const policy = featurePolicy(base)
    const input = { attachmentId: 'feature-upload', ownerKind: AttachmentOwnerKind.Student, ownerId: 'student-a', fileName: 'test.pdf', mimeType: 'application/pdf', sizeBytes: body.byteLength }
    const proposals: Attachment[] = []
    const upload = await createAttachmentUpload(base, input, { ...policy, assertSave: async (candidate, existing) => {
      proposals.push(candidate)
      return policy.assertSave(candidate, existing)
    } })
    await storage.putObject({ key: upload.storageKey, contentType: input.mimeType, body })
    const intent = (await fixture.repositories.attachmentUploads.find('school-a', upload.attachmentId))!
    expect(proposals[0]!.data).toEqual(intent.attachment)
    const completion = { ...intent.attachment, status: AttachmentStatus.Ready }
    await expect(completeAttachmentUpload(base, completion)).rejects.toThrow()
    await expect(completeAttachmentUpload(base, { ...completion, purpose: 'general' }, policy)).rejects.toMatchObject({ code: 'ATTACHMENT_UPLOAD_CONFLICT' })
    const result = await completeAttachmentUpload(base, completion, policy)
    expect(result.purpose).toBe(purpose)
    expect((await completeAttachmentUpload(base, completion, policy)).storageKey).toBe(result.storageKey)
    await expect(completeAttachmentUpload(base, completion)).rejects.toThrow()
    expect(await base.entities.attachments.findById(result.id)).toBeUndefined()
    expect(await grantAttachmentDownload(base, result.id, { access: policy })).not.toBeNull()
    expect((await loadAttachmentAsset(base, { attachmentId: result.id, ownerKind: AttachmentOwnerKind.Student, ownerId: 'student-a', maxBytes: body.byteLength, allowedMimeTypes: ['application/pdf'], access: policy })).body).toEqual(body)
    await attachment('other-child', purpose, 'school-a', 'student-other')
    expect(await grantAttachmentDownload(base, 'other-child', { access: policy })).toBeNull()
  })

  test('a purpose-specific policy cannot turn a legacy URL into a private download', async () => {
    const base = service().baseService
    await fixture.repositories.attachments.save(new Attachment({ id: 'legacy-private', schoolId: 'school-a', ownerKind: AttachmentOwnerKind.Student, ownerId: 'student-a', purpose, fileName: 'legacy.pdf', fileUrl: 'https://legacy.example/file.pdf', mimeType: 'application/pdf', sizeBytes: body.byteLength }))
    expect(await grantAttachmentDownload(base, 'legacy-private', { access: featurePolicy(base) })).toBeNull()
  })

  test('purpose access rechecks actual authority after byte reads and signing', async () => {
    await attachment('private', purpose)
    const base = service().baseService
    const access = featurePolicy(base)
    const revoke = () => fixture.db.exec('UPDATE schools SET owner_subject_id = \'revoked\' WHERE id = \'school-a\'')
    const read = storage.readObject
    storage.readObject = async (...args) => {
      const result = await read(...args)
      await revoke()
      return result
    }
    await expect(loadAttachmentAsset(base, { attachmentId: 'private', ownerKind: AttachmentOwnerKind.Student, ownerId: 'student-a', maxBytes: body.byteLength, allowedMimeTypes: ['application/pdf'], access })).rejects.toThrow()
    await fixture.db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const sign = storage.createPresignedDownload
    storage.createPresignedDownload = async (...args) => {
      const result = await sign(...args)
      await revoke()
      return result
    }
    await expect(grantAttachmentDownload(base, 'private', { access })).rejects.toThrow()
  })

  test('rejects a foreign-school policy scope and an empty purpose selection', async () => {
    await attachment('private', purpose)
    const base = service().baseService
    const foreign = resourceAccessScope('school-b', 'attachments', [{ target: { kind: 'school' }, attachmentPurposes: [purpose] }])
    const empty = resourceAccessScope('school-a', 'attachments', [{ target: { kind: 'school' }, attachmentPurposes: [] }])
    await expect(grantAttachmentDownload(base, 'private', { access: { purpose, readScope: async () => foreign } })).rejects.toMatchObject({ code: 'forbidden' })
    expect(await grantAttachmentDownload(base, 'private', { access: { purpose, readScope: async () => empty } })).toBeNull()
  })
})
