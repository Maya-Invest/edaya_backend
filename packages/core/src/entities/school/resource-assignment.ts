import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'

export interface ResourceAssignmentArgs {
  id: string
  resourceId: string
  sessionId?: string | null
  groupedSessionId?: string | null
  classGroupId?: string | null
  createdAt?: Date
}

/**
 * Assigns a specific Resource (like a room or equipment) to a Session, GroupedSession, or ClassGroup.
 */
export class ResourceAssignment {
  readonly id: string
  readonly resourceId: string
  readonly classGroupId?: string
  readonly sessionId?: string
  readonly groupedSessionId?: string
  readonly createdAt: Date

  constructor({
    id,
    resourceId,
    sessionId,
    groupedSessionId,
    classGroupId,
    createdAt,
  }: ResourceAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.resourceId = requireNonBlank(resourceId, 'resourceId')

    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.groupedSessionId = requireOptionalNonBlank(groupedSessionId, 'groupedSessionId')
    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')

    const targets = [this.sessionId, this.groupedSessionId, this.classGroupId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A ResourceAssignment must target exactly one of: sessionId, groupedSessionId, or classGroupId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
