import type { FamilyFeedbackCampaign } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, FAMILY_FEEDBACK_FAILURES, Permission } from '@edaya/core'

function fail(code: string, message: string): never {
  throw new BusinessRuleViolationError(code, message)
}

export function actorSubjectId(base: BaseSchoolService): string | undefined {
  const actor = base.actor
  if (actor.kind === 'staff' || actor.kind === 'guardian' || actor.kind === 'student' || actor.kind === 'teacher' || actor.kind === 's2s')
    return actor.subjectId
  return undefined
}

export function isFamilyFeedbackSystemActor(base: BaseSchoolService): boolean {
  return base.actor.kind === 'system' && base.actor.systemId === 'advanceFamilyFeedbackCampaigns'
}

export function isFamilyFeedbackSeedActor(base: BaseSchoolService): boolean {
  return base.actor.kind === 'system' && base.actor.systemId === 'fixture-seed'
}

export async function evaluatedTeacherSubjectId(base: BaseSchoolService, teacherId: string): Promise<string | undefined> {
  const teacher = await base.repositories.teachers.forSchool!(base.actor.schoolId).findById(teacherId)
  return teacher?.subjectId
}

export async function assertNotEvaluatedSubject(base: BaseSchoolService, teacherId: string): Promise<void> {
  const evaluatedSubjectId = await evaluatedTeacherSubjectId(base, teacherId)
  const subjectId = actorSubjectId(base)
  if (evaluatedSubjectId && subjectId && evaluatedSubjectId === subjectId)
    denyResourceAccess()
}

export async function assertFamilyFeedbackManage(base: BaseSchoolService): Promise<void> {
  if (isFamilyFeedbackSystemActor(base) || isFamilyFeedbackSeedActor(base))
    return
  if (base.actor.kind !== 'staff' && base.actor.kind !== 's2s')
    denyResourceAccess()
  await base.access.assertSchool(Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE)
}

export async function assertFamilyFeedbackRead(base: BaseSchoolService): Promise<void> {
  if (isFamilyFeedbackSystemActor(base) || isFamilyFeedbackSeedActor(base))
    return
  if (base.actor.kind !== 'staff' && base.actor.kind !== 's2s')
    denyResourceAccess()
  await base.access.assertSchool([Permission.FAMILY_FEEDBACK_CAMPAIGN_READ, Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE, Permission.FAMILY_FEEDBACK_PUBLISH])
}

export async function assertFamilyFeedbackPublish(base: BaseSchoolService, campaign: FamilyFeedbackCampaign): Promise<void> {
  if (base.actor.kind !== 'staff')
    denyResourceAccess()
  await base.access.assertSchool(Permission.FAMILY_FEEDBACK_PUBLISH)
  await assertNotEvaluatedSubject(base, campaign.teacherId)
}

export async function assertFamilyFeedbackModerate(base: BaseSchoolService, campaign: FamilyFeedbackCampaign): Promise<void> {
  if (base.actor.kind !== 'staff')
    denyResourceAccess()
  await assertNotEvaluatedSubject(base, campaign.teacherId)
  await base.access.assertSchool(Permission.FAMILY_FEEDBACK_MODERATE)
  if (base.actor.staffMemberId !== campaign.moderatorStaffId)
    denyResourceAccess()
}

export async function assertStaffMayBeModerator(
  base: BaseSchoolService,
  staffId: string,
  teacherId: string,
  academicYearId: string,
): Promise<void> {
  const staff = await base.repositories.staffMembers.forSchool!(base.actor.schoolId).findById(staffId)
  if (!staff || !staff.isActive || staff.accountKind !== 'human' || staff.schoolId !== base.actor.schoolId)
    fail(FAMILY_FEEDBACK_FAILURES.MODERATOR_REQUIRED, 'A live human moderator is required')
  const evaluatedSubjectId = await evaluatedTeacherSubjectId(base, teacherId)
  if (evaluatedSubjectId && staff.subjectId && staff.subjectId === evaluatedSubjectId)
    fail(FAMILY_FEEDBACK_FAILURES.MODERATOR_CONFLICT, 'The evaluated teacher cannot moderate this campaign')
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  if (school?.ownerSubjectId && staff.subjectId === school.ownerSubjectId)
    return
  const grants = await base.repositories.staffPermissionAssignments.forSchool!(base.actor.schoolId).list({
    staffId,
    permission: Permission.FAMILY_FEEDBACK_MODERATE,
    academicYearId,
  })
  if (!grants.length)
    fail(FAMILY_FEEDBACK_FAILURES.MODERATOR_REQUIRED, 'The moderator must hold FAMILY_FEEDBACK_MODERATE')
}
