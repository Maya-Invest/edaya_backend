import { requireNonBlank, requireOptionalNonBlank } from '$lib/core/utils/validation'

export interface ResourceAssignmentArgs {
  id: string
  resourceId: string
  sessionId?: string | null
  groupedSessionId?: string | null
  classroomId?: string | null
  createdAt?: Date
}

/**
 * Assigns a specific Resource (like a room or equipment) to a Session, GroupedSession, or Classroom.
 */
export class ResourceAssignment {
  readonly id: string
  readonly resourceId: string
  readonly sessionId?: string
  readonly groupedSessionId?: string
  readonly classroomId?: string
  readonly createdAt: Date

  constructor({
    id,
    resourceId,
    sessionId,
    groupedSessionId,
    classroomId,
    createdAt,
  }: ResourceAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.resourceId = requireNonBlank(resourceId, 'resourceId')

    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.groupedSessionId = requireOptionalNonBlank(groupedSessionId, 'groupedSessionId')
    this.classroomId = requireOptionalNonBlank(classroomId, 'classroomId')

    const targets = [this.sessionId, this.groupedSessionId, this.classroomId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A ResourceAssignment must target exactly one of: sessionId, groupedSessionId, or classroomId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
