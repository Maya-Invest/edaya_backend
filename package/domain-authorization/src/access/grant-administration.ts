import type { AuthorityScope, GrantScope, Permission, StaffAssignment } from '@edaya/core'
import type { AccessFacts } from './facts'
import { authorityScopeContains, validatePermissionScopes } from '@edaya/core'
import { denied } from './facts'
import { scopesForStaffAssignmentPermission } from './staff-assignment-policy'

export interface DelegatedGrant {
  permission: Permission
  scopes: readonly GrantScope[]
  academicYearId: string
  startsAt?: Date
  endsAt?: Date
}

/** Validate the complete placement against this tenant, including redundant parent IDs. */
export async function validateGrantTargets(facts: AccessFacts, grant: DelegatedGrant): Promise<void> {
  validatePermissionScopes(grant.permission, grant.scopes)
  await validateScopeSelectionTargets(facts, grant)
}

/** Validate saved selections without treating them as grants for a particular action. */
export async function validateScopeSelectionTargets(facts: AccessFacts, grant: { scopes: readonly GrantScope[], academicYearId: string }): Promise<void> {
  await facts.one('academicYears', grant.academicYearId)
  for (const scope of grant.scopes) {
    switch (scope.kind) {
      case 'school': break
      case 'all': break
      case 'student':
        await facts.one('students', scope.studentId)
        break
      case 'grade_level':
        await facts.one('gradeLevels', scope.gradeLevelId)
        break
      case 'grade_level_subject': {
        await facts.one('gradeLevels', scope.gradeLevelId)
        if (scope.gradeLevelSubjectId) {
          const subject = await facts.one('gradeLevelSubjects', scope.gradeLevelSubjectId)
          if (subject.gradeLevelId !== scope.gradeLevelId || subject.academicYearId !== grant.academicYearId)
            denied('Grant subject belongs to a different placement or academic year')
        }
        break
      }
      case 'class_group':
      case 'class_subject': {
        const group = await facts.one('classGroups', scope.classGroupId)
        if (group.academicYearId !== grant.academicYearId)
          denied('Grant placement belongs to a different academic year')
        if (scope.kind === 'class_subject' && scope.classSubjectId
          && (await facts.one('classSubjects', scope.classSubjectId)).classGroupId !== group.id) {
          denied()
        }
        break
      }
      case 'activity': {
        if (scope.activityId)
          await facts.one('activities', scope.activityId)
        if (scope.classGroupId && (await facts.one('classGroups', scope.classGroupId)).academicYearId !== grant.academicYearId)
          denied()
        break
      }
    }
  }
}

/** An administrator can delegate only authority they hold for the same action and year. */
export async function assertGrantDelegation(facts: AccessFacts, grants: readonly DelegatedGrant[]): Promise<void> {
  await facts.validateActor()
  if (facts.actor.kind === 'system' && facts.actor.systemId === 'fixture-seed') {
    for (const requested of grants) await validateGrantTargets(facts, requested)
    return
  }
  if (facts.actor.kind !== 'staff')
    denied()
  const owner = await facts.owner()
  for (const requested of grants) {
    await validateGrantTargets(facts, requested)
    if (owner)
      continue
    const held = await facts.staffGrants(requested.permission, requested.academicYearId)
    const startsAt = requested.startsAt ?? facts.now
    for (const scope of requested.scopes) {
      if (!held.some(grant => (!grant.startsAt || grant.startsAt <= startsAt)
        && (!grant.endsAt || (requested.endsAt !== undefined && requested.endsAt <= grant.endsAt))
        && grant.scopes.some(heldScope => authorityScopeContains(heldScope, scope)))) {
        denied('Delegation exceeds the administrator’s action, scope, year, or validity period')
      }
    }
  }
}

/** Assignment delegation retains the exact business placement, including occurrence-only duties. */
export async function assertAssignmentDelegation(facts: AccessFacts, assignment: StaffAssignment): Promise<void> {
  await facts.validateActor()
  const target = await facts.assignmentTarget(assignment)
  if ((facts.actor.kind === 'system' && facts.actor.systemId === 'fixture-seed') || await facts.owner())
    return
  if (facts.actor.kind !== 'staff')
    return denied()
  for (const permission of assignment.permissions) {
    const held = await facts.staffGrants(permission, assignment.academicYearId)
    const requested: AuthorityScope[] = scopesForStaffAssignmentPermission(permission, target)
    if (requested.some(scope => !held.some(grant => !grant.endsAt && grant.scopes.some(existing => authorityScopeContains(existing, scope)))))
      denied('Assignment exceeds the administrator’s action, placement, year, or validity period')
  }
}
