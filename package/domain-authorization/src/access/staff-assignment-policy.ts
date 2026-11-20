import type { AuthorityScope, StaffAssignment } from '@edaya/core'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import { BusinessRuleViolationError } from '@edaya/core'
import { Permission } from '../permissions/permission'
import { permissionDefinitions } from '../permissions/permission-definitions'

export type StaffAssignmentTargetKind
  = | 'class_group'
    | 'class_subject'
    | 'lesson_session'
    | 'activity_session'
    | 'assessment'

export interface StaffAssignmentResolvedTarget {
  readonly kind: StaffAssignmentTargetKind
  readonly schoolId: string
  readonly classGroupId: string
  readonly classSubjectId?: string
  readonly gradeLevelId?: string
  readonly subjectId?: string
  readonly activityId?: string
  readonly lessonSessionId?: string
  readonly activitySessionId?: string
  readonly assessmentId?: string
}

export const ASSESSMENT_STAFF_ASSIGNMENT_PERMISSIONS: readonly Permission[] = Object.values(Permission).filter(permission => permissionDefinitions[permission].assignmentTargets.includes('assessment'))

async function resolvePlacement(
  assignment: StaffAssignment,
  repositories: AuthorizationRepositories,
): Promise<StaffAssignmentResolvedTarget> {
  if (assignment.classGroupId) {
    const classGroup = await repositories.classGroups.findById(assignment.classGroupId)
    if (!classGroup) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_CLASS_GROUP_NOT_FOUND', 'StaffAssignment classGroupId does not exist')
    }
    return {
      kind: 'class_group',
      schoolId: classGroup.schoolId,
      classGroupId: assignment.classGroupId,
    }
  }

  if (assignment.classSubjectId) {
    const classSubject = await repositories.classSubjects.findById(assignment.classSubjectId)
    if (!classSubject) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_CLASS_SUBJECT_NOT_FOUND', 'StaffAssignment classSubjectId does not exist')
    }
    const classGroup = await repositories.classGroups.findById(classSubject.classGroupId)
    if (!classGroup) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_CLASS_GROUP_NOT_FOUND', 'StaffAssignment class subject class group does not exist')
    }
    return {
      kind: 'class_subject',
      schoolId: classGroup.schoolId,
      classGroupId: classSubject.classGroupId,
      classSubjectId: assignment.classSubjectId,
      gradeLevelId: classGroup.gradeLevelId,
      subjectId: classSubject.subjectId,
    }
  }

  if (assignment.lessonSessionId) {
    const session = await repositories.lessonSessions.findById(assignment.lessonSessionId)
    if (!session) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_LESSON_SESSION_NOT_FOUND', 'StaffAssignment lessonSessionId does not exist')
    }
    return {
      kind: 'lesson_session',
      lessonSessionId: session.id,
      schoolId: session.schoolId,
      classGroupId: session.classGroupId,
      classSubjectId: session.classSubjectId,
    }
  }

  if (assignment.activitySessionId) {
    const session = await repositories.activitySessions.findById(assignment.activitySessionId)
    if (!session) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_ACTIVITY_SESSION_NOT_FOUND', 'StaffAssignment activitySessionId does not exist')
    }
    return {
      kind: 'activity_session',
      activitySessionId: session.id,
      schoolId: session.schoolId,
      classGroupId: session.classGroupId,
      activityId: session.activityId,
    }
  }

  if (assignment.assessmentId) {
    const assessment = await repositories.assessments.findById(assignment.assessmentId)
    if (!assessment) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_ASSESSMENT_NOT_FOUND', 'StaffAssignment assessmentId does not exist')
    }
    const classGroup = await repositories.classGroups.findById(assessment.classGroupId)
    if (!classGroup) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_ASSESSMENT_CLASS_GROUP_NOT_FOUND', 'StaffAssignment assessment class group does not exist')
    }
    return {
      kind: 'assessment',
      assessmentId: assessment.id,
      lessonSessionId: assessment.lessonSessionId,
      schoolId: classGroup.schoolId,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
    }
  }

  throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_TARGET_REQUIRED', 'StaffAssignment must target exactly one placement entity')
}

export function assertPermissionAllowedOnStaffAssignmentTarget(permission: Permission, targetKind: StaffAssignmentTargetKind): void {
  if (!permissionDefinitions[permission].assignmentTargets.includes(targetKind))
    throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_SCOPE_MISMATCH', `Permission "${permission}" cannot be granted at "${targetKind}"`)
}

export function scopesForStaffAssignmentPermission(permission: Permission, target: StaffAssignmentResolvedTarget): AuthorityScope[] {
  assertPermissionAllowedOnStaffAssignmentTarget(permission, target.kind)
  const { classGroupId, classSubjectId, lessonSessionId, activitySessionId, assessmentId, activityId, gradeLevelId, subjectId } = target
  if (target.kind === 'class_group')
    return [{ kind: 'class_group', classGroupId }]
  if (target.kind === 'class_subject' && gradeLevelId && subjectId)
    return [{ kind: 'subject', gradeLevelId, subjectId, classGroupId }]
  if (target.kind === 'lesson_session' && lessonSessionId && classSubjectId)
    return [{ kind: 'lesson_session', lessonSessionId, classGroupId, classSubjectId }]
  if (target.kind === 'activity_session' && activitySessionId && activityId)
    return [{ kind: 'activity_session', activitySessionId, classGroupId, activityId }]
  if (target.kind === 'assessment' && assessmentId && classSubjectId)
    return [{ kind: 'assessment', assessmentId, classGroupId, classSubjectId, ...(lessonSessionId ? { lessonSessionId } : {}) }]
  throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_SCOPE_UNRESOLVED', 'The assignment cannot grant this action at its placement')
}

export function validateStaffAssignmentPermissionSelection(assignment: Pick<StaffAssignment, 'permissions'>, target: StaffAssignmentResolvedTarget): void {
  for (const permission of new Set(assignment.permissions))
    scopesForStaffAssignmentPermission(permission, target)
}

export async function resolveStaffAssignmentTarget(assignment: StaffAssignment, repositories: AuthorizationRepositories): Promise<StaffAssignmentResolvedTarget> {
  const target = await resolvePlacement(assignment, repositories)
  const [staff, group, year] = await Promise.all([
    repositories.staffMembers.findById(assignment.staffId),
    repositories.classGroups.findById(target.classGroupId),
    repositories.academicYears.findById(assignment.academicYearId),
  ])
  if (!staff || !group || !year || staff.schoolId !== target.schoolId
    || group.schoolId !== target.schoolId || year.schoolId !== target.schoolId || group.academicYearId !== year.id) {
    throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_PLACEMENT_MISMATCH', 'Staff assignment must remain in one school and academic year')
  }
  validateStaffAssignmentPermissionSelection(assignment, target)
  return target
}
