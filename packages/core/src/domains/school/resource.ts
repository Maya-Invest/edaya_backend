import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requirePositiveInt } from '../utils'

export enum ResourceKind {
  Location = 'location',
  Equipment = 'equipment',
  Vehicle = 'vehicle',
  Other = 'other',
}

export interface ResourceArgs {
  id: string
  schoolId: string
  name: string
  description?: string | null
  kind: ResourceKind
  capacity?: number | null
  createdAt?: Date
}

/**
 * Represents a physical resource such as a room, piece of equipment, or vehicle.
 */
export class Resource {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly description?: string
  readonly kind: ResourceKind
  readonly capacity?: number
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    name,
    description,
    kind,
    capacity,
    createdAt,
  }: ResourceArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    if (description != null && description.trim() !== '') {
      this.description = description.trim()
    }
    this.kind = kind
    if (capacity != null) {
      this.capacity = requirePositiveInt(capacity, 'capacity')
    }
    this.createdAt = createdAt ?? new Date()
  }
}

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
