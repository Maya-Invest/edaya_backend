import type { Resource } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { ResourceOperations } from '@edaya/authorization'
import { BusinessRuleViolationError } from '@edaya/core'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, noopReadAccess, operationModule, read, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/school/resource.ts (PR3)
export const resourceConfig: EntityConfigFactory<Resource> = ({ repositories, atomicExecution }) => ({
  ...config({
    repository: repositories.resources,
    tenant: directSchoolTenant(),
    read: read(operationModule(ResourceOperations.read), noopReadAccess),
    write: write(
      operationModule(ResourceOperations.configure),
      authorizeExistingById(noopReadAccess),
      authorizeDeleteByReadAccess(noopReadAccess),
    ),
    atomicExecution,
  }),
  gates: {
    preDelete: validateResourceDelete,
  },
})

async function validateResourceDelete(
  resource: Resource,
  repositories: SchoolRepositories,
): Promise<void> {
  const assignments = await repositories.resourceAssignments.list({ resourceId: resource.id })
  if (assignments.length > 0) {
    throw new BusinessRuleViolationError('RESOURCE_HAS_DEPENDENCIES', `Cannot delete resource ${resource.id}: dependent records still exist`)
  }
}
