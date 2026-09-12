import type { GrantScope, Permission } from '@edaya/core';
import { grantScopeContains, validatePermissionScopes } from '@edaya/core';
import type { AccessFacts } from './facts';
import { denied } from './facts';

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
  await facts.one('academicYears', grant.academicYearId)
  for (const scope of grant.scopes) {
    switch (scope.kind) {
      case 'school': break
      case 'all': break
      case 'student': await facts.one('students', scope.studentId); break
      case 'grade_level': await facts.one('gradeLevels', scope.gradeLevelId); break
      case 'grade_level_subject': {
        await facts.one('gradeLevels', scope.gradeLevelId)
        if (scope.gradeLevelSubjectId && (await facts.one('gradeLevelSubjects', scope.gradeLevelSubjectId)).gradeLevelId !== scope.gradeLevelId) denied()
        break
      }
      case 'class_group':
      case 'class_subject': {
        const group = await facts.one('classGroups', scope.classGroupId)
        if (group.academicYearId !== grant.academicYearId) denied('Grant placement belongs to a different academic year')
        if (scope.kind === 'class_subject' && scope.classSubjectId
          && (await facts.one('classSubjects', scope.classSubjectId)).classGroupId !== group.id) denied()
        break
      }
      case 'activity': {
        if (scope.activityId) await facts.one('activities', scope.activityId)
        if (scope.classGroupId && (await facts.one('classGroups', scope.classGroupId)).academicYearId !== grant.academicYearId) denied()
        break
      }
    }
  }
}

/** An administrator can delegate only authority they hold for the same action and year. */
export async function assertGrantDelegation(facts: AccessFacts, grants: readonly DelegatedGrant[]): Promise<void> {
  await facts.validateActor()
  if (facts.actor.kind !== 'staff') denied()
  const owner = await facts.owner()
  for (const requested of grants) {
    await validateGrantTargets(facts, requested)
    if (owner) continue
    const held = await facts.staffGrants(requested.permission, requested.academicYearId)
    const startsAt = requested.startsAt ?? facts.now
    for (const scope of requested.scopes) {
      if (!held.some(grant => (!grant.startsAt || grant.startsAt <= startsAt)
        && (!grant.endsAt || (requested.endsAt !== undefined && requested.endsAt <= grant.endsAt))
        && grant.scopes.some(heldScope => grantScopeContains(heldScope, scope)))) {
        denied('Delegation exceeds the administrator’s action, scope, year, or validity period')
      }
    }
  }
}
