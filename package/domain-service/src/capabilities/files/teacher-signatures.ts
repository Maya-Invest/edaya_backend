import type { Attachment, Teacher } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import type { AttachmentReadPolicy, AttachmentUploadPolicy } from './attachment-purpose-access'
import { denyResourceAccess } from '@edaya/authorization'
import { AttachmentOwnerKind, AttachmentStatus, BusinessRuleViolationError, resourceAccessScope, TEACHER_SIGNATURE_CAPABILITY, TEACHER_SIGNATURE_MAX_BYTES, TEACHER_SIGNATURE_PURPOSE } from '@edaya/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { completeAttachmentUpload, createAttachmentUpload } from './attachment-uploads'
import { validateTeacherSignaturePng } from './teacher-signature-image'

export interface CreateTeacherSignatureUploadInput {
  attachmentId?: string
  fileName: string
  mimeType: string
  sizeBytes: number
}

export interface CompleteTeacherSignatureUploadInput { attachmentId: string }
export interface ClearTeacherSignatureInput { requestId: string, attachmentId: string }

async function requireSelf(base: BaseSchoolService): Promise<Teacher> {
  if (base.actor.kind !== 'teacher')
    denyResourceAccess()
  const teacher = await base.repositories.teachers.forSchool!(base.actor.schoolId).findById(base.actor.teacherId)
  if (!teacher || teacher.schoolId !== base.actor.schoolId || !teacher.isActive || teacher.subjectId !== base.actor.subjectId)
    denyResourceAccess()
  return teacher
}

function scope(base: BaseSchoolService, teacherId: string, attachmentId?: string) {
  return resourceAccessScope(base.actor.schoolId, 'attachments', [{
    target: { kind: 'records', ids: [teacherId] },
    attachmentOwners: [AttachmentOwnerKind.Teacher],
    attachmentPurposes: [TEACHER_SIGNATURE_PURPOSE],
    ...(attachmentId ? { attachmentIds: [attachmentId] } : {}),
  }])
}

function uploadPolicy(base: BaseSchoolService): AttachmentUploadPolicy {
  return {
    purpose: TEACHER_SIGNATURE_PURPOSE,
    allowedMimeTypes: ['image/png'],
    maxBytes: TEACHER_SIGNATURE_MAX_BYTES,
    validateContent: validateTeacherSignaturePng,
    assertSave: async (attachment) => {
      const teacher = await requireSelf(base)
      if (attachment.ownerKind !== AttachmentOwnerKind.Teacher || attachment.ownerId !== teacher.id || attachment.purpose !== TEACHER_SIGNATURE_PURPOSE)
        denyResourceAccess()
      return scope(base, teacher.id)
    },
  }
}

/** Raw signature images are available only to their owner; reports expose the embedded image. */
export function teacherSignatureReadPolicy(base: BaseSchoolService, attachment: Attachment): AttachmentReadPolicy {
  return {
    purpose: TEACHER_SIGNATURE_PURPOSE,
    readScope: async () => {
      const teacher = await requireSelf(base)
      if (attachment.ownerKind !== AttachmentOwnerKind.Teacher || attachment.ownerId !== teacher.id || attachment.purpose !== TEACHER_SIGNATURE_PURPOSE)
        denyResourceAccess()
      return scope(base, teacher.id, attachment.id)
    },
  }
}

export async function createTeacherSignatureUpload(base: BaseSchoolService, input: CreateTeacherSignatureUploadInput) {
  const teacher = await requireSelf(base)
  return createAttachmentUpload(base, { ...input, ownerKind: AttachmentOwnerKind.Teacher, ownerId: teacher.id }, uploadPolicy(base))
}

async function writeSignature(base: BaseSchoolService, attachment?: Attachment): Promise<Teacher> {
  const teacher = await requireSelf(base)
  const previousId = teacher.signatureAttachmentId
  if (attachment && (attachment.ownerId !== teacher.id || attachment.ownerKind !== AttachmentOwnerKind.Teacher
    || attachment.schoolId !== teacher.schoolId || attachment.purpose !== TEACHER_SIGNATURE_PURPOSE
    || attachment.status !== AttachmentStatus.Ready || attachment.mimeType !== 'image/png'
    || !attachment.sizeBytes || attachment.sizeBytes > TEACHER_SIGNATURE_MAX_BYTES)) {
    denyResourceAccess()
  }
  const updated = teacher.copyWith({ signatureAttachmentId: attachment?.id })
  await base.repositories.teachers.forSchool!(teacher.schoolId).save(updated)
  if (attachment?.storageKey) {
    await base.repositories.privateFiles.retain({ schoolId: teacher.schoolId, sourceType: TEACHER_SIGNATURE_CAPABILITY, sourceId: teacher.id, slot: TEACHER_SIGNATURE_PURPOSE, attachmentId: attachment.id, storageKey: attachment.storageKey })
  }
  else {
    await base.repositories.privateFiles.release({ schoolId: teacher.schoolId, sourceType: TEACHER_SIGNATURE_CAPABILITY, sourceId: teacher.id, slot: TEACHER_SIGNATURE_PURPOSE })
  }
  if (previousId && previousId !== attachment?.id) {
    const previous = await base.repositories.attachments.forSchool!(teacher.schoolId).findById(previousId)
    if (previous?.storageKey)
      await base.repositories.privateFiles.reserve({ schoolId: teacher.schoolId, storageKey: previous.storageKey, protectedUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) })
  }
  return updated
}

export async function completeTeacherSignatureUpload(base: BaseSchoolService, input: CompleteTeacherSignatureUploadInput): Promise<Teacher> {
  const teacher = await requireSelf(base)
  const intent = await base.repositories.attachmentUploads.find(teacher.schoolId, input.attachmentId)
  if (!intent || intent.attachment.ownerKind !== AttachmentOwnerKind.Teacher || intent.attachment.ownerId !== teacher.id || intent.attachment.purpose !== TEACHER_SIGNATURE_PURPOSE)
    denyResourceAccess()
  const attachment = await completeAttachmentUpload(base, { ...intent.attachment, status: AttachmentStatus.Ready }, uploadPolicy(base))
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'completeTeacherSignatureUpload', attachment.id),
    input,
    resultMode: 'ordinary',
    lockKeys: [`teacher-signature:${teacher.id}`],
    authorize: async () => { await requireSelf(base) },
    execute: () => writeSignature(base, attachment),
    replay: () => requireSelf(base),
    persistResult: result => ({ teacherId: result.id }),
    audit: () => [{ event: 'teacher.signature_saved', resourceType: 'teachers', resourceId: teacher.id }],
  })
}

export async function clearTeacherSignature(base: BaseSchoolService, input: ClearTeacherSignatureInput): Promise<Teacher> {
  const teacher = await requireSelf(base)
  return base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'clearTeacherSignature', input.requestId),
    input,
    resultMode: 'ordinary',
    lockKeys: [`teacher-signature:${teacher.id}`],
    authorize: async () => { await requireSelf(base) },
    execute: async () => {
      const current = await requireSelf(base)
      if (current.signatureAttachmentId !== input.attachmentId)
        throw new BusinessRuleViolationError('TEACHER_SIGNATURE_CHANGED', 'Reload the signature before removing it')
      return writeSignature(base)
    },
    replay: () => requireSelf(base),
    persistResult: result => ({ teacherId: result.id }),
    audit: () => [{ event: 'teacher.signature_cleared', resourceType: 'teachers', resourceId: teacher.id }],
  })
}
