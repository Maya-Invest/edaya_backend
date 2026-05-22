import type { StaffRole } from '$lib/core/entities/core/staff-member'
import { requireNonBlank, requireOptionalNonBlank } from '$lib/core/validation'

export interface StaffAssignmentArgs {
  id: string
  staffId: string
  role: StaffRole
  classroomId?: string | null
  moduleId?: string | null
  sessionId?: string | null
  groupedSessionId?: string | null
  createdAt?: Date
}

/**
 * Assigns a staff member (with a specific role) to a Classroom, Module, Session, or GroupedSession.
 */
export class StaffAssignment {
  readonly id: string
  readonly staffId: string
  readonly role: StaffRole
  readonly classroomId?: string
  readonly moduleId?: string
  readonly sessionId?: string
  readonly groupedSessionId?: string
  readonly createdAt: Date

  constructor({
    id,
    staffId,
    role,
    classroomId,
    moduleId,
    sessionId,
    groupedSessionId,
    createdAt,
  }: StaffAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.staffId = requireNonBlank(staffId, 'staffId')
    this.role = role

    this.classroomId = requireOptionalNonBlank(classroomId, 'classroomId')
    this.moduleId = requireOptionalNonBlank(moduleId, 'moduleId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.groupedSessionId = requireOptionalNonBlank(groupedSessionId, 'groupedSessionId')

    const targets = [this.classroomId, this.moduleId, this.sessionId, this.groupedSessionId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A StaffAssignment must target exactly one of: classroomId, moduleId, sessionId, or groupedSessionId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
