import type { GrantScope, StaffAssignment } from '@edaya/core';
import type { ScopeType } from '../permissions/scope-type';
import type { AuthorizationRepositories } from '../ports/authorization-repositories';
import { BusinessRuleViolationError } from '@edaya/core';
import { Permission } from '../permissions/permission';
import { permissionDefinitions } from '../permissions/permission-definitions';
import { validatePermissionScopes } from '@edaya/core';

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
  readonly activityId?: string
}

const TARGET_ALLOWED_SCOPES: Record<StaffAssignmentTargetKind, readonly (ScopeType | undefined)[]> = {
  class_group: ['class_group', 'class_subject'],
  class_subject: ['class_group', 'class_subject'],
  lesson_session: ['class_group', 'class_subject'],
  activity_session: ['activity'],
  assessment: ['class_group', 'class_subject'],
}

export const ASSESSMENT_STAFF_ASSIGNMENT_PERMISSIONS: readonly Permission[] = [
  Permission.EXAM_CONFIG_CREATE,
  Permission.GRADE_INPUT,
  Permission.GRADE_UPDATE,
  Permission.ATTENDANCE_RECORD,
]

const ASSESSMENT_STAFF_ASSIGNMENT_PERMISSION_SET = new Set(ASSESSMENT_STAFF_ASSIGNMENT_PERMISSIONS)

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
    }
  }

  if (assignment.lessonSessionId) {
    const session = await repositories.lessonSessions.findById(assignment.lessonSessionId)
    if (!session) {
      throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_LESSON_SESSION_NOT_FOUND', 'StaffAssignment lessonSessionId does not exist')
    }
    return {
      kind: 'lesson_session',
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
      schoolId: classGroup.schoolId,
      classGroupId: assessment.classGroupId,
      classSubjectId: assessment.classSubjectId,
    }
  }

  throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_TARGET_REQUIRED', 'StaffAssignment must target exactly one placement entity')
}

export function assertPermissionAllowedOnStaffAssignmentTarget(
  permission: Permission,
  targetKind: StaffAssignmentTargetKind,
): void {
  if (targetKind === 'assessment' && !ASSESSMENT_STAFF_ASSIGNMENT_PERMISSION_SET.has(permission)) {
    throw new BusinessRuleViolationError(
      'STAFF_ASSIGNMENT_PERMISSION_NOT_ALLOWED',
      `Permission "${permission}" is not allowed on assessment StaffAssignment targets`,
    )
  }

  const catalogScope = permissionDefinitions[permission].scope
  if (!catalogScope) {
    throw new BusinessRuleViolationError(
      'STAFF_ASSIGNMENT_TENANT_PERMISSION',
      `Tenant-wide permission "${permission}" cannot be granted through StaffAssignment`,
    )
  }

  if (!TARGET_ALLOWED_SCOPES[targetKind].includes(catalogScope)) {
    throw new BusinessRuleViolationError(
      'STAFF_ASSIGNMENT_SCOPE_MISMATCH',
      `Permission "${permission}" scope "${catalogScope}" is not valid for StaffAssignment target "${targetKind}"`,
    )
  }
}

export function scopesForStaffAssignmentPermission(permission: Permission, target: StaffAssignmentResolvedTarget): GrantScope[] {
  assertPermissionAllowedOnStaffAssignmentTarget(permission, target.kind)
  const grain = permissionDefinitions[permission].scope
  if (grain === 'class_group') return [{ kind: 'class_group', classGroupId: target.classGroupId }]
  if (grain === 'class_subject' && (target.kind === 'class_group' || target.classSubjectId))
    return [{ kind: 'class_subject', classGroupId: target.classGroupId, ...(target.classSubjectId ? { classSubjectId: target.classSubjectId } : {}) }]
  if (grain === 'activity' && target.activityId)
    return [{ kind: 'activity', activityId: target.activityId, classGroupId: target.classGroupId }]
  throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_SCOPE_UNRESOLVED', 'The assignment cannot grant this action at its placement')
}

export function validateStaffAssignmentPermissionSelection(assignment: Pick<StaffAssignment, 'permissions'>, target: StaffAssignmentResolvedTarget): void {
  for (const permission of new Set(assignment.permissions)) validatePermissionScopes(permission, scopesForStaffAssignmentPermission(permission, target))
}

export async function resolveStaffAssignmentTarget(assignment: StaffAssignment, repositories: AuthorizationRepositories): Promise<StaffAssignmentResolvedTarget> {
  const target = await resolvePlacement(assignment, repositories)
  const [staff, group, year] = await Promise.all([
    repositories.staffMembers.findById(assignment.staffId),
    repositories.classGroups.findById(target.classGroupId),
    repositories.academicYears.findById(assignment.academicYearId),
  ])
  if (!staff || !group || !year || staff.schoolId !== target.schoolId
    || group.schoolId !== target.schoolId || year.schoolId !== target.schoolId || group.academicYearId !== year.id)
    throw new BusinessRuleViolationError('STAFF_ASSIGNMENT_PLACEMENT_MISMATCH', 'Staff assignment must remain in one school and academic year')
  validateStaffAssignmentPermissionSelection(assignment, target)
  return target
}
