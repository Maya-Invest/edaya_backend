import type { Guardian, StaffMember, Student } from '../../domain'
import type { SchoolRepositories } from '../../ports'
import type { BaseSchoolService } from '../base-school-service'
import { Guardian as GuardianEntity, StaffMember as StaffMemberEntity } from '../../domain'
import {
  buildGuardianRecipientProfile,
  buildStaffRecipientProfile,
  buildStudentRecipientProfile,
  scheduleNotificationRecipientUpsert,
} from '../../capabilities/notifications'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'

export interface LinkSubjectToActorInput {
  subjectId: string
  staffMemberId?: string
  guardianId?: string
  studentId?: string
}

export type LinkSubjectToActorResult
  = | { kind: 'staff', entity: StaffMember }
    | { kind: 'guardian', entity: Guardian }
    | { kind: 'student', entity: Student }

export async function assertSubjectIdAvailable(
  repositories: Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students'>,
  subjectId: string,
  input: LinkSubjectToActorInput,
): Promise<void> {
  const [staff, guardian, student] = await Promise.all([
    repositories.staffMembers.findOne({ subjectId }),
    repositories.guardians.findOne({ subjectId }),
    repositories.students.findOne({ subjectId }),
  ])

  const conflicts = [
    staff && staff.id !== input.staffMemberId ? { kind: 'staff' as const, id: staff.id } : null,
    guardian && guardian.id !== input.guardianId ? { kind: 'guardian' as const, id: guardian.id } : null,
    student && student.id !== input.studentId ? { kind: 'student' as const, id: student.id } : null,
  ].filter((entry): entry is { kind: 'staff' | 'guardian' | 'student', id: string } => entry !== null)

  if (conflicts.length > 0) {
    const [conflict] = conflicts
    throw new BusinessRuleViolationError(
      'SUBJECT_ID_ALREADY_LINKED',
      `Auth subject ${subjectId} is already linked to ${conflict?.kind} ${conflict?.id}`,
    )
  }
}

export function assertEntitySubjectLinkable(
  existingSubjectId: string | undefined,
  nextSubjectId: string,
): void {
  if (existingSubjectId && existingSubjectId !== nextSubjectId) {
    throw new BusinessRuleViolationError(
      'ACTOR_SUBJECT_ALREADY_LINKED',
      'The target entity is already linked to a different auth subject',
    )
  }
}

export async function linkSubjectToActor(
  baseService: BaseSchoolService,
  repositories: Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students' | 'guardianLinks'>,
  schoolId: string,
  input: LinkSubjectToActorInput,
): Promise<LinkSubjectToActorResult> {
  const targetCount = [input.staffMemberId, input.guardianId, input.studentId].filter(Boolean).length
  if (targetCount !== 1) {
    throw new BusinessRuleViolationError(
      'LINK_ACTOR_SUBJECT_AMBIGUOUS',
      'Exactly one of staffMemberId, guardianId, or studentId is required',
    )
  }

  await assertSubjectIdAvailable(repositories, input.subjectId, input)

  if (input.staffMemberId) {
    const existing = await repositories.staffMembers.findById(input.staffMemberId)
    if (!existing || existing.schoolId !== schoolId) {
      throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Staff member not found in school')
    }
    assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
    const staffMember = new StaffMemberEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      notificationEmail: existing.notificationEmail,
      notificationPhone: existing.notificationPhone,
      subjectId: input.subjectId,
      isActive: existing.isActive,
      createdAt: existing.createdAt,
    })
    await baseService.entities.staffMembers.save(staffMember, { moduleChecked: true })
    scheduleNotificationRecipientUpsert(baseService, buildStaffRecipientProfile(staffMember))
    return { kind: 'staff', entity: staffMember }
  }

  if (input.guardianId) {
    const existing = await repositories.guardians.findById(input.guardianId)
    if (!existing || existing.schoolId !== schoolId) {
      throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Guardian not found in school')
    }
    assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
    const guardian = new GuardianEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      phone: existing.phone,
      notificationEmail: existing.notificationEmail,
      notificationPhone: existing.notificationPhone,
      subjectId: input.subjectId,
      contactMethods: [...existing.contactMethods],
      hasAccess: existing.hasAccess,
      createdAt: existing.createdAt,
    })
    await baseService.entities.guardians.save(guardian, { moduleChecked: true })
    const links = await repositories.guardianLinks.list({ guardianId: guardian.id })
    scheduleNotificationRecipientUpsert(
      baseService,
      buildGuardianRecipientProfile(guardian, links),
    )
    return { kind: 'guardian', entity: guardian }
  }

  const existing = await repositories.students.findById(input.studentId!)
  if (!existing || existing.schoolId !== schoolId) {
    throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Student not found in school')
  }
  assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
  const student = existing.copyWith({ subjectId: input.subjectId })
  await baseService.entities.students.save(student, { moduleChecked: true })
  scheduleNotificationRecipientUpsert(baseService, buildStudentRecipientProfile(student))
  return { kind: 'student', entity: student }
}
