import { Permission } from '@edaya/core';
import type { Resource } from '@edaya/core';
import type { SchoolRepositories } from '../../../../ports/school-repositories';
import type { EntityConfigFactory } from '../../entity-config';

import { BusinessRuleViolationError } from '@edaya/core';
import { config } from '../../entity-config';
import { directSchoolTenant } from '../../entity-config/tenant';

// Extracted from domain/school/resource.ts (PR3)
export const resourceConfig: EntityConfigFactory<Resource> = ({ repositories, atomicExecution }) => ({
  ...config({
    repository: repositories.resources,
    tenant: directSchoolTenant(),
    authorization: { resource: 'resources', read: [Permission.RESOURCE_READ], write: [Permission.RESOURCE_CONFIGURE] },
    
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
