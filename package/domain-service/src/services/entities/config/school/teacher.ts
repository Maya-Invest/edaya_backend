import type { Teacher } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'

import { AttachmentOwnerKind, AttachmentStatus, BusinessRuleViolationError, DEFAULT_PROFILE_PHOTO_MAX_BYTES, parseAttachmentIdFromContentUrl, PROFILE_PHOTO_JPEG_MIME, TEACHER_PORTRAIT_PURPOSE } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'
import { assertUniquePersonCode } from '../person-code-uniqueness'

// Extracted from domain/school/teacher.ts (PR3)
export const teacherConfig: EntityConfigFactory<Teacher> = (input) => {
  return {
    ...config({
      repository: input.repositories.teachers,
      tenant: directSchoolTenant(),
      resource: 'teachers',

      atomicExecution: input.atomicExecution,
    }),
    gates: {
      preSave: validateTeacherSave,
      preDelete: validateTeacherDelete,
    },
  }
}

async function validateTeacherSave(
  teacher: Teacher,
  existing: Teacher | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (teacher.signatureAttachmentId !== existing?.signatureAttachmentId)
    throw new BusinessRuleViolationError('TEACHER_SIGNATURE_COMMAND_REQUIRED', 'Signatures require the teacher signature commands')
  await assertUniquePersonCode({
    code: teacher.code,
    schoolId: teacher.schoolId,
    entityId: teacher.id,
    errorCode: 'TEACHER_CODE_ALREADY_EXISTS',
    entityLabel: 'Teacher',
    findCandidates: code => repositories.teachers.list({ schoolId: teacher.schoolId, code: { $normalizedCandidate: code } }),
  })
  await validateTeacherPortrait(teacher, repositories)
}

async function validateTeacherPortrait(
  teacher: Teacher,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!teacher.photoUrl)
    return
  const attachmentId = parseAttachmentIdFromContentUrl(teacher.photoUrl)
  if (!attachmentId)
    throw new BusinessRuleViolationError('PROFILE_PHOTO_URL_INVALID', 'Portrait URL must be a private content projection')
  const attachment = await repositories.attachments.findById(attachmentId)
  if (!attachment
    || attachment.ownerKind !== AttachmentOwnerKind.Teacher
    || attachment.ownerId !== teacher.id
    || attachment.purpose !== TEACHER_PORTRAIT_PURPOSE
    || attachment.status !== AttachmentStatus.Ready
    || attachment.mimeType !== PROFILE_PHOTO_JPEG_MIME
    || !attachment.sizeBytes
    || attachment.sizeBytes > DEFAULT_PROFILE_PHOTO_MAX_BYTES) {
    throw new BusinessRuleViolationError('PROFILE_PHOTO_URL_INVALID', 'Portrait URL must reference this owner’s completed portrait')
  }
}

async function validateTeacherDelete(
  teacher: Teacher,
  repositories: SchoolRepositories,
): Promise<void> {
  if (await repositories.teacherAcademicYearProfiles.count({ teacherId: teacher.id }))
    throw new BusinessRuleViolationError('TEACHER_HAS_ANNUAL_PROFILES', 'Remove annual information before deleting this teacher')
  const assignments = await repositories.teacherAssignments.list({ teacherId: teacher.id })
  const unavailabilities = await repositories.teacherUnavailabilities.list({ teacherId: teacher.id })
  if (assignments.length > 0 || unavailabilities.length > 0) {
    throw new BusinessRuleViolationError('TEACHER_HAS_DEPENDENCIES', `Cannot delete teacher ${teacher.id}: dependent records still exist`)
  }
}
