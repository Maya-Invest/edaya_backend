import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export interface ResourceAssignmentArgs {
  id: string
  resourceId: string
  sessionId?: string | null
  classGroupId?: string | null
  createdAt?: Date
}

/**
 * Assigns a specific Resource (like a room or equipment) to a Session or ClassGroup.
 */
export class ResourceAssignment {
  readonly id: string
  readonly resourceId: string
  readonly classGroupId?: string
  readonly sessionId?: string
  readonly createdAt: Date

  constructor({
    id,
    resourceId,
    sessionId,
    classGroupId,
    createdAt,
  }: ResourceAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.resourceId = requireNonBlank(resourceId, 'resourceId')

    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')

    const targets = [this.sessionId, this.classGroupId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A ResourceAssignment must target exactly one of: sessionId or classGroupId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
