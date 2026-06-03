import type { Resource } from '../../../entities/school/resource'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { directEntityConfig } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const resourceConfig: EntityConfigFactory<Resource> = (input) => {
  const config = directEntityConfig(input, input.repositories.resources, 'resources.read', 'resources.manage')
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
