import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export interface StaffAssignmentArgs {
  id: string
  staffId: string
  responsibility: string
  classGroupId?: string | null
  classSubjectId?: string | null
  sessionId?: string | null
  createdAt?: Date
}

/**
 * Assigns a staff member (with a free-form responsibility label) to a ClassGroup, ClassSubject, or Session.
 */
export class StaffAssignment {
  readonly id: string
  readonly staffId: string
  readonly responsibility: string
  readonly classGroupId?: string
  readonly classSubjectId?: string
  readonly sessionId?: string
  readonly createdAt: Date

  constructor({
    id,
    staffId,
    responsibility,
    classGroupId,
    classSubjectId,
    sessionId,
    createdAt,
  }: StaffAssignmentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.staffId = requireNonBlank(staffId, 'staffId')
    this.responsibility = requireNonBlank(responsibility, 'responsibility')

    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.classSubjectId = requireOptionalNonBlank(classSubjectId, 'classSubjectId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')

    const targets = [this.classGroupId, this.classSubjectId, this.sessionId].filter(Boolean)
    if (targets.length !== 1) {
      throw new Error('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, or sessionId')
    }

    this.createdAt = createdAt ?? new Date()
  }
}
