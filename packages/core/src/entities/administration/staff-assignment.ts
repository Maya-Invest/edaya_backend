import type { StaffRole } from '$lib/core/entities/core/staff-member'
import { requireNonBlank, requireOptionalNonBlank } from '$lib/core/utils/validation'

export interface StaffAssignmentArgs {
  id: string
  staffId: string
  role: StaffRole
  classGroupId?: string | null
  classSubjectId?: string | null
  sessionId?: string | null
  groupedSessionId?: string | null
  createdAt?: Date
}

/**
 * Assigns a staff member (with a specific role) to a ClassGroup, ClassSubject, Session, or GroupedSession.
 */
export class StaffAssignment {
  readonly id: string
  readonly staffId: string
  readonly role: StaffRole
  readonly classGroupId?: string
  readonly classSubjectId?: string
  readonly sessionId?: string
  readonly groupedSessionId?: string
  readonly createdAt: Date

  constructor({
    id,
    staffId,
    role,
    classGroupId,
    classSubjectId,
    sessionId,
    groupedSessionId,
    createdAt,
  }: StaffAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.staffId = requireNonBlank(staffId, 'staffId')
    this.role = role

    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.groupedSessionId = requireOptionalNonBlank(groupedSessionId, 'groupedSessionId')

    const targets = [this.classGroupId, this.classSubjectId, this.sessionId, this.groupedSessionId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, sessionId, or groupedSessionId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
