import type { StaffPermissionAssignment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { BusinessRuleViolationError, grantScopesEquivalent } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

export const staffPermissionAssignmentConfig: EntityConfigFactory<StaffPermissionAssignment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.staffPermissionAssignments,
    tenant: directSchoolTenant(),
    resource: 'staffPermissionAssignments',
    gates: {
      preSave: validateCustomGrantSave,
      preDelete: validateCustomGrantDelete,
    },
    atomicExecution,
  })

async function validateCustomGrantSave(
  entity: StaffPermissionAssignment,
  existing: StaffPermissionAssignment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (entity.sourceProfileId || existing?.sourceProfileId || entity.sourceManualAssignmentId || existing?.sourceManualAssignmentId) {
    throw new BusinessRuleViolationError(
      'PROFILE_BOUND_GRANT_LOCKED',
      'Profile-bound grants cannot be edited directly',
    )
  }

  const candidates = await repositories.staffPermissionAssignments.list({
    staffId: entity.staffId,
    permission: entity.permission,
  })
  if (candidates.some(grant => grant.sourceProfileId
    && grant.id !== entity.id
    && grantScopesEquivalent(grant.scopes, entity.scopes))) {
    throw new BusinessRuleViolationError(
      'PROFILE_GRANT_DUPLICATE',
      'A profile already grants this permission with the same scopes',
    )
  }
}

async function validateCustomGrantDelete(entity: StaffPermissionAssignment): Promise<void> {
  if (entity.sourceProfileId || entity.sourceManualAssignmentId) {
    throw new BusinessRuleViolationError(
      'PROFILE_BOUND_GRANT_LOCKED',
      'Profile-bound grants cannot be removed directly',
    )
  }
}
