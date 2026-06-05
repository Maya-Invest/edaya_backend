import type { Resource } from '../../../entities/school/resource'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { directPermissionEntityConfig } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const resourceConfig: EntityConfigFactory<Resource> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.resources,
    Permission.RESOURCE_READ,
    Permission.RESOURCE_CONFIGURE,
  )
  return {
    ...config,
    gates: {
      preDelete: validateResourceDelete,
    },
  }
}

async function validateResourceDelete(
  resource: Resource,
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.resourceAssignments.list({ resourceId: resource.id })
  if (assignments.length > 0) {
    throw new BusinessRuleViolationError('RESOURCE_HAS_DEPENDENCIES', `Cannot delete resource ${resource.id}: dependent records still exist`)
  }
}
