import type { AttachmentInput, AttachmentOwnerKind, AttachmentUploadIntent } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentUploadPolicy } from './attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import { Attachment, AttachmentStatus, BusinessRuleViolationError, FileStorageReadError, GENERAL_ATTACHMENT_PURPOSE, readBoundedStorageBody } from '@edaya/core'
import { fileTypeFromBuffer } from 'file-type/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { validateAttachmentSave } from '../../services/entities/config/school/attachment'
import { assertAttachmentScope, attachmentPurpose } from './attachment-purpose-access'
import { sanitizeFileName } from './sanitize-file-name'
import { assertUploadPolicyAllowed } from './upload-policy'

export interface CreateAttachmentUploadInput {
  attachmentId?: string
  ownerKind: AttachmentOwnerKind
  ownerId: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

function callerId(base: BaseSchoolService): string {
  return JSON.stringify([base.actor.kind, base.actor.kind === 'system' ? base.actor.systemId : base.actor.actorId, 'subjectId' in base.actor ? base.actor.subjectId : null])
}

function lock(attachmentId: string) {
  return { lockKeys: [`attachment-upload:${attachmentId}`] }
}

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

async function storageEffect<T>(effect: () => Promise<T>): Promise<T> {
  try {
    return await effect()
  }
  catch (error) {
    if (error instanceof FileStorageReadError && error.code === 'FILE_READ_LIMIT_EXCEEDED')
      fail('ATTACHMENT_SIZE_MISMATCH', 'Uploaded object exceeds the admitted size')
    throw new Error('ATTACHMENT_STORAGE_UNAVAILABLE')
  }
}

/** Local PUT adapter admission: possession of the random, expiring staging key is the upload capability. */
export async function receiveAttachmentUpload(
  dependencies: Pick<BaseSchoolService, 'repositories' | 'fileStorage'>,
  input: { storageKey: string, contentType: string, body: Parameters<typeof readBoundedStorageBody>[0] | null },
): Promise<boolean> {
  const intent = await dependencies.repositories.attachmentUploads.findPendingByStorageKey(input.storageKey)
  if (!intent || intent.completedStorageKey || intent.expiresAt.getTime() <= Date.now())
    return false
  if (!input.body || input.contentType !== intent.attachment.mimeType)
    fail('ATTACHMENT_MIME_TYPE_MISMATCH', 'Upload content type must match the issued intent')
  const body = await storageEffect(() => readBoundedStorageBody(input.body!, intent.attachment.sizeBytes!))
  if (body.byteLength !== intent.attachment.sizeBytes)
    fail('ATTACHMENT_SIZE_MISMATCH', 'Upload size must match the issued intent')
  if (intent.expiresAt.getTime() <= Date.now())
    return false
  await storageEffect(() => dependencies.fileStorage.putObject({ key: input.storageKey, body, contentType: intent.attachment.mimeType! }))
  return true
}

async function authorize(base: BaseSchoolService, attachment: Attachment, policy?: AttachmentUploadPolicy) {
  if (attachment.purpose !== attachmentPurpose(policy))
    denyResourceAccess()
  const existing = await base.repositories.attachments.forSchool!(base.actor.schoolId).findById(attachment.id)
  const scope = policy ? await policy.assertSave(attachment, existing) : await base.access.entity('attachments').assertSave(attachment, existing)
  assertAttachmentScope(base, scope)
  const repository = base.repositories.attachments.forAccess(scope)
  if (existing)
    await repository.assertAccess(existing)
  await repository.assertAccess(attachment)
  await validateAttachmentSave(attachment, existing, base.repositories)
  return { existing, repository }
}

async function admitted(base: BaseSchoolService, id: string, policy?: AttachmentUploadPolicy): Promise<AttachmentUploadIntent> {
  const intent = await base.repositories.attachmentUploads.find(base.actor.schoolId, id)
  if (!intent || intent.callerId !== callerId(base))
    denyResourceAccess()
  await authorize(base, new Attachment(intent.attachment), policy)
  if (!intent.completedStorageKey && intent.expiresAt.getTime() <= Date.now())
    fail('ATTACHMENT_UPLOAD_EXPIRED', 'Upload intent has expired')
  return intent
}

/** Persist authority before releasing temporary upload credentials. Never called inside another transaction. */
export async function createAttachmentUpload(base: BaseSchoolService, input: CreateAttachmentUploadInput, policy?: AttachmentUploadPolicy) {
  // The capability supplies purpose; arbitrary JSON cannot select a private or public audience.
  if ('purpose' in input)
    fail('ATTACHMENT_PURPOSE_NOT_ALLOWED', 'Upload purpose is fixed by the owning command')
  const purpose = attachmentPurpose(policy)
  for (const value of [input.attachmentId, input.ownerId, input.fileName, input.mimeType]) {
    if (value !== undefined && (!value.trim() || value !== value.trim()))
      fail('ATTACHMENT_UPLOAD_METADATA_INVALID', 'Upload metadata must be nonempty and have no surrounding whitespace')
  }
  assertUploadPolicyAllowed(input, policy)
  const id = input.attachmentId ?? `att-${crypto.randomUUID()}`
  let current: AttachmentUploadIntent | undefined
  const acceptedInput = { attachmentId: id, ownerKind: input.ownerKind, ownerId: input.ownerId, purpose, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes }
  const proposed = new Attachment({
    id,
    schoolId: base.actor.schoolId,
    ownerKind: input.ownerKind,
    ownerId: input.ownerId,
    purpose,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    storageKey: [encodeURIComponent(base.actor.schoolId), 'uploads', input.ownerKind, encodeURIComponent(input.ownerId), encodeURIComponent(id), crypto.randomUUID(), sanitizeFileName(input.fileName)].join('/'),
    status: AttachmentStatus.PendingUpload,
    uploadedById: base.actor.kind === 'system' ? undefined : base.actor.actorId,
  })
  await base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'createAttachmentUpload', id),
    input: acceptedInput,
    resultMode: 'secret-display',
    lockKeys: lock(id).lockKeys,
    authorize: async () => {
      const existingIntent = await base.repositories.attachmentUploads.find(base.actor.schoolId, id)
      current = existingIntent ? await admitted(base, id, policy) : undefined
      if (current) {
        for (const field of ['ownerKind', 'ownerId', 'fileName', 'mimeType', 'sizeBytes'] as const) {
          if (current.attachment[field] !== input[field])
            fail('ATTACHMENT_UPLOAD_CONFLICT', 'Attachment identity was already admitted with different metadata')
        }
        if (current.completedStorageKey)
          fail('ATTACHMENT_ALREADY_COMPLETED', 'Use a new attachment identity for a new upload')
      }
      else {
        const { existing } = await authorize(base, proposed, policy)
        if (existing)
          fail('ATTACHMENT_ALREADY_EXISTS', 'Use a new attachment identity for a new upload')
      }
    },
    execute: async () => {
      if (!current) {
        const attachment = proposed
        current = { attachmentId: id, schoolId: base.actor.schoolId, callerId: callerId(base), attachment: attachment.data, expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
        await base.repositories.attachmentUploads.create(current)
        await base.repositories.privateFiles.reserve({ schoolId: attachment.schoolId, storageKey: attachment.storageKey!, protectedUntil: new Date(current.expiresAt.getTime() + 60 * 60 * 1000) })
      }
      return { attachmentId: id }
    },
    replay: async (stored: { attachmentId: string }) => {
      if (stored.attachmentId !== id)
        fail('ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE', 'The upload result is unavailable')
      await admitted(base, id, policy)
      return stored
    },
    persistResult: result => result,
    audit: () => [{ event: 'attachment.upload_intent_authorized', resourceType: 'attachment-upload', resourceId: id }],
  })
  // The journal returns only a reference. The owning capability may reissue a temporary
  // grant after fresh authorization; neither a staging key nor a signed URL is replayed.
  const intent = await base.atomicExecution.execute(() => admitted(base, id, policy), lock(id))
  const presigned = await storageEffect(() => base.fileStorage.createPresignedUpload({
    key: intent.attachment.storageKey!,
    contentType: intent.attachment.mimeType!,
    sizeBytes: intent.attachment.sizeBytes!,
    expiresInSeconds: Math.max(1, Math.floor((intent.expiresAt.getTime() - Date.now()) / 1000)),
  }))
  await base.atomicExecution.execute(() => admitted(base, id, policy), lock(id))
  return { attachmentId: id, storageKey: intent.attachment.storageKey!, uploadUrl: presigned.uploadUrl, expiresAt: new Date(Math.min(presigned.expiresAt.getTime(), intent.expiresAt.getTime())), headers: presigned.headers, status: 'pending_upload' as const }
}

function assertCompletionInput(intent: AttachmentUploadIntent, input: AttachmentInput): void {
  if ((input.purpose ?? GENERAL_ATTACHMENT_PURPOSE) !== (intent.attachment.purpose ?? GENERAL_ATTACHMENT_PURPOSE))
    fail('ATTACHMENT_UPLOAD_CONFLICT', 'Completion must match the admitted purpose')
  for (const field of ['schoolId', 'ownerKind', 'ownerId', 'fileName', 'storageKey', 'mimeType', 'sizeBytes'] as const) {
    if (intent.attachment[field] !== input[field])
      fail('ATTACHMENT_UPLOAD_CONFLICT', 'Completion must match the admitted upload')
  }
  if (input.fileUrl || input.checksum || (input.status && input.status !== AttachmentStatus.Ready))
    fail('ATTACHMENT_UPLOAD_CONFLICT', 'Completion cannot supply an external URL, checksum or lifecycle state')
}

async function completedAttachment(base: BaseSchoolService, intent: AttachmentUploadIntent, policy?: AttachmentUploadPolicy): Promise<Attachment> {
  const { existing } = await authorize(base, new Attachment(intent.attachment), policy)
  if (!existing || existing.storageKey !== intent.completedStorageKey || existing.checksum !== intent.checksum
    || existing.status !== AttachmentStatus.Ready || existing.ownerKind !== intent.attachment.ownerKind || existing.ownerId !== intent.attachment.ownerId) {
    fail('ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE', 'The completed attachment is no longer available')
  }
  for (const field of ['fileName', 'mimeType', 'sizeBytes', 'purpose', 'uploadedById'] as const) {
    if (existing.data[field] !== intent.attachment[field])
      fail('ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE', 'The completed attachment metadata changed')
  }
  if (existing.createdAt.getTime() !== new Date(intent.attachment.createdAt!).getTime())
    fail('ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE', 'The completed attachment metadata changed')
  return existing
}

/** Validate a temporary object, copy accepted bytes outside SQL, then atomically publish the immutable key. */
export async function completeAttachmentUpload(base: BaseSchoolService, input: AttachmentInput, policy?: AttachmentUploadPolicy): Promise<Attachment> {
  const intent = await base.atomicExecution.execute(async () => {
    const value = await admitted(base, input.id, policy)
    assertCompletionInput(value, input)
    return value
  }, lock(input.id))
  if (intent.completedStorageKey)
    return journalCompletion(base, input, policy)

  const stored = await storageEffect(() => base.fileStorage.readObject(intent.attachment.storageKey!, { maxBytes: intent.attachment.sizeBytes! }))
  if (!stored)
    fail('ATTACHMENT_OBJECT_NOT_FOUND', 'Uploaded object was not found in storage')
  if (stored.body.byteLength !== intent.attachment.sizeBytes || stored.sizeBytes !== stored.body.byteLength)
    fail('ATTACHMENT_SIZE_MISMATCH', 'Uploaded object size does not match the admitted size')
  if (stored.contentType !== intent.attachment.mimeType)
    fail('ATTACHMENT_MIME_TYPE_MISMATCH', 'Uploaded object content type does not match the admitted type')
  let detected: Awaited<ReturnType<typeof fileTypeFromBuffer>>
  try {
    detected = await fileTypeFromBuffer(stored.body)
  }
  catch {
    fail('ATTACHMENT_CONTENT_INVALID', 'Uploaded content could not be identified')
  }
  // APNG is a PNG container; browsers may report either registered MIME type.
  const pngAlias = detected?.mime === 'image/apng' && intent.attachment.mimeType === 'image/png'
  if (!detected || (detected.mime !== intent.attachment.mimeType && !pngAlias))
    fail('ATTACHMENT_CONTENT_INVALID', 'Uploaded content does not match the admitted type')
  policy?.validateContent?.(stored.body)
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(stored.body))
  const checksum = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const storageKey = [encodeURIComponent(base.actor.schoolId), 'accepted', encodeURIComponent(input.id), checksum, sanitizeFileName(intent.attachment.fileName)].join('/')
  await base.atomicExecution.execute(async () => {
    await admitted(base, input.id, policy)
    await base.repositories.privateFiles.reserve({ schoolId: base.actor.schoolId, storageKey, protectedUntil: new Date(Date.now() + 60 * 60 * 1000) })
  }, lock(input.id))
  await storageEffect(() => base.fileStorage.putObject({ key: storageKey, body: stored.body, contentType: intent.attachment.mimeType! }))
  return journalCompletion(base, input, policy, { storageKey, checksum })
}

async function journalCompletion(base: BaseSchoolService, input: AttachmentInput, policy?: AttachmentUploadPolicy, copied?: { storageKey: string, checksum: string }): Promise<Attachment> {
  let current: AttachmentUploadIntent
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'registerAttachment', input.id),
    input: { attachmentId: input.id, ownerKind: input.ownerKind, ownerId: input.ownerId, purpose: input.purpose ?? GENERAL_ATTACHMENT_PURPOSE, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes },
    resultMode: 'ordinary',
    lockKeys: lock(input.id).lockKeys,
    authorize: async () => {
      current = await admitted(base, input.id, policy)
      assertCompletionInput(current, input)
    },
    execute: async () => {
      if (current.completedStorageKey)
        return completedAttachment(base, current, policy)
      if (!copied)
        fail('ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE', 'The completed upload is unavailable')
      const attachment = new Attachment({ ...current.attachment, ...copied, status: AttachmentStatus.Ready })
      const { existing, repository } = await authorize(base, attachment, policy)
      if (existing)
        fail('ATTACHMENT_ALREADY_EXISTS', 'Attachment identity already exists')
      await repository.save(attachment)
      await base.repositories.attachmentUploads.complete(base.actor.schoolId, input.id, copied.storageKey, copied.checksum)
      return attachment
    },
    replay: async (stored: { attachmentId: string }) => {
      if (stored.attachmentId !== input.id)
        fail('ATTACHMENT_UPLOAD_RESULT_UNAVAILABLE', 'The completed upload is unavailable')
      return completedAttachment(base, current, policy)
    },
    persistResult: result => ({ attachmentId: result.id }),
    audit: result => [{ event: 'attachment.upload_completed', resourceType: 'attachment', resourceId: result.id }],
  })
}
