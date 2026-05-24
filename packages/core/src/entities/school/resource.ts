import { requireNonBlank, requirePositiveInt } from '$lib/core/utils/validation'

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
