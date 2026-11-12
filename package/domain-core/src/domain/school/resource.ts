import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'

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
  shortName: shortNameSchema.optional(),
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

  copyWith(changes: Partial<ResourceInput>): Resource { return new Resource({ ...this.data, ...changes }) }

  constructor(args: ResourceInput) {
    this.data = parseDomain(resourceSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.name }
  get description() { return this.data.description }
  get kind() { return this.data.kind }
  get capacity() { return this.data.capacity }
  get createdAt() { return this.data.createdAt }
}
