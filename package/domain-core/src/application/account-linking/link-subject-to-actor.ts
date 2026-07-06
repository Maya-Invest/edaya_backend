import type { Guardian, StaffMember, Student, Teacher } from '../../domain'
import type { SchoolRepositories } from '../../ports'
import type { BaseSchoolService } from '../base-school-service'
import {
  buildGuardianRecipientProfile,
  buildStaffRecipientProfile,
  buildStudentRecipientProfile,
  buildTeacherRecipientProfile,
  scheduleNotificationRecipientUpsert,
} from '../../capabilities/notifications'
import { Guardian as GuardianEntity, StaffMember as StaffMemberEntity, Teacher as TeacherEntity } from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'

export interface LinkSubjectToActorInput {
  subjectId: string
  staffMemberId?: string
  guardianId?: string
  studentId?: string
  teacherId?: string
}

export type LinkSubjectToActorResult
  = | { kind: 'staff', entity: StaffMember }
    | { kind: 'guardian', entity: Guardian }
    | { kind: 'student', entity: Student }
    | { kind: 'teacher', entity: Teacher }

export async function assertSubjectIdAvailable(
  repositories: Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students' | 'teachers'>,
  schoolId: string,
  subjectId: string,
  input: LinkSubjectToActorInput,
): Promise<void> {
  if (input.staffMemberId) {
    const existing = await repositories.staffMembers.findOne({ subjectId, schoolId })
    if (existing && existing.id !== input.staffMemberId) {
      throw new BusinessRuleViolationError(
        'SUBJECT_ID_ALREADY_LINKED',
        `Auth subject ${subjectId} is already linked to staff ${existing.id} in school ${schoolId}`,
      )
    }
  }

  if (input.guardianId) {
    const existing = await repositories.guardians.findOne({ subjectId, schoolId })
    if (existing && existing.id !== input.guardianId) {
      throw new BusinessRuleViolationError(
        'SUBJECT_ID_ALREADY_LINKED',
        `Auth subject ${subjectId} is already linked to guardian ${existing.id} in school ${schoolId}`,
      )
    }
  }

  if (input.studentId) {
    const existing = await repositories.students.findOne({ subjectId, schoolId })
    if (existing && existing.id !== input.studentId) {
      throw new BusinessRuleViolationError(
        'SUBJECT_ID_ALREADY_LINKED',
        `Auth subject ${subjectId} is already linked to student ${existing.id} in school ${schoolId}`,
      )
    }
  }

  if (input.teacherId) {
    const existing = await repositories.teachers.findOne({ subjectId, schoolId })
    if (existing && existing.id !== input.teacherId) {
      throw new BusinessRuleViolationError(
        'SUBJECT_ID_ALREADY_LINKED',
        `Auth subject ${subjectId} is already linked to teacher ${existing.id} in school ${schoolId}`,
      )
    }
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
  repositories: Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students' | 'guardianLinks' | 'teachers'>,
  schoolId: string,
  input: LinkSubjectToActorInput,
): Promise<LinkSubjectToActorResult> {
  return replaceActorSubject(baseService, repositories, schoolId, input, { allowReplace: false })
}

export async function relinkSubjectToActor(
  baseService: BaseSchoolService,
  repositories: Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students' | 'guardianLinks' | 'teachers'>,
  schoolId: string,
  input: LinkSubjectToActorInput,
): Promise<LinkSubjectToActorResult> {
  return replaceActorSubject(baseService, repositories, schoolId, input, { allowReplace: true })
}

async function replaceActorSubject(
  baseService: BaseSchoolService,
  repositories: Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students' | 'guardianLinks' | 'teachers'>,
  schoolId: string,
  input: LinkSubjectToActorInput,
  options: { allowReplace: boolean },
): Promise<LinkSubjectToActorResult> {
  const targetCount = [input.staffMemberId, input.guardianId, input.studentId, input.teacherId].filter(Boolean).length
  if (targetCount !== 1) {
    throw new BusinessRuleViolationError(
      'LINK_ACTOR_SUBJECT_AMBIGUOUS',
      'Exactly one of staffMemberId, guardianId, studentId, or teacherId is required',
    )
  }

  await assertSubjectIdAvailable(repositories, schoolId, input.subjectId, input)

  if (input.staffMemberId) {
    const existing = await repositories.staffMembers.findById(input.staffMemberId)
    if (!existing || existing.schoolId !== schoolId) {
      throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Staff member not found in school')
    }
    if (!options.allowReplace) {
      assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
    }
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
    if (!options.allowReplace) {
      assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
    }
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

  if (input.teacherId) {
    const existing = await repositories.teachers.findById(input.teacherId)
    if (!existing || existing.schoolId !== schoolId) {
      throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Teacher not found in school')
    }
    if (!options.allowReplace) {
      assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
    }
    const teacher = new TeacherEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName: existing.firstName,
      lastName: existing.lastName,
      photoUrl: existing.photoUrl,
      email: existing.email,
      phone: existing.phone,
      notificationEmail: existing.notificationEmail,
      notificationPhone: existing.notificationPhone,
      subjectId: input.subjectId,
      isActive: existing.isActive,
      createdAt: existing.createdAt,
    })
    await baseService.entities.teachers.save(teacher, { moduleChecked: true })
    scheduleNotificationRecipientUpsert(baseService, buildTeacherRecipientProfile(teacher))
    return { kind: 'teacher', entity: teacher }
  }

  const existing = await repositories.students.findById(input.studentId!)
  if (!existing || existing.schoolId !== schoolId) {
    throw new BusinessRuleViolationError('INVITATION_TARGET_NOT_FOUND', 'Student not found in school')
  }
  if (!options.allowReplace) {
    assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
  }
  const student = existing.copyWith({ subjectId: input.subjectId })
  await baseService.entities.students.save(student, { moduleChecked: true })
  scheduleNotificationRecipientUpsert(baseService, buildStudentRecipientProfile(student))
  return { kind: 'student', entity: student }
}
