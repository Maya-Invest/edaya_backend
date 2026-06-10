import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { directPermissionEntityConfig } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { parseDomain, zodDate } from '../utils'

export enum ResourceKind {
  Location = 'location',
  Equipment = 'equipment',
  Vehicle = 'vehicle',
  Other = 'other',
}

export const resourceBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  description: z.preprocess(
    val => typeof val === 'string' && val.trim() === '' ? undefined : val,
    z.string().trim().min(1, 'description must not be blank').nullable().optional(),
  ).transform(v => v === null ? undefined : v),
  kind: z.nativeEnum(ResourceKind),
  capacity: z.number().int().positive('capacity must be a strictly positive integer').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export const resourceSchema = resourceBaseSchema

export type ResourceData = z.infer<typeof resourceSchema>
export type ResourceInput = z.input<typeof resourceSchema>

export const resourceCreateSchema = resourceBaseSchema.omit({ createdAt: true })
export const resourceUpdateSchema = resourceBaseSchema.partial().required({ id: true })

/**
 * Represents a physical resource such as a room, piece of equipment, or vehicle.
 */
export class Resource {
  readonly data: ResourceData

  constructor(args: ResourceInput) {
    this.data = parseDomain(resourceSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get description() { return this.data.description }
  get kind() { return this.data.kind }
  get capacity() { return this.data.capacity }
  get createdAt() { return this.data.createdAt }
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
