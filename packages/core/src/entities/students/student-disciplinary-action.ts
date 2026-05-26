import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum StudentDisciplinaryActionStatus {
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export interface StudentDisciplinaryActionArgs {
  id: string
  schoolId: string
  incidentId: string
  studentId: string
  disciplinaryActionId: string
  assignedByStaffId: string
  startsAt?: Date | null
  endsAt?: Date | null
  status?: StudentDisciplinaryActionStatus
  notes?: string | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Represents a disciplinary catalog action actually applied to a student.
 */
export class StudentDisciplinaryAction {
  readonly id: string
  readonly schoolId: string
  readonly incidentId: string
  readonly studentId: string
  readonly disciplinaryActionId: string
  readonly assignedByStaffId: string
  readonly startsAt?: Date
  readonly endsAt?: Date
  readonly status: StudentDisciplinaryActionStatus
  readonly notes?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    incidentId,
    studentId,
    disciplinaryActionId,
    assignedByStaffId,
    startsAt,
    endsAt,
    status = StudentDisciplinaryActionStatus.Active,
    notes,
    createdAt,
    updatedAt,
  }: StudentDisciplinaryActionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.incidentId = requireNonBlank(incidentId, 'incidentId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.disciplinaryActionId = requireNonBlank(disciplinaryActionId, 'disciplinaryActionId')
    this.assignedByStaffId = requireNonBlank(assignedByStaffId, 'assignedByStaffId')
    this.startsAt = startsAt ? requireValidDate(startsAt, 'startsAt') : undefined
    this.endsAt = endsAt ? requireValidDate(endsAt, 'endsAt') : undefined
    this.status = status
    this.notes = requireOptionalNonBlank(notes, 'notes')

    const now = new Date()
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.updatedAt = updatedAt ? requireValidDate(updatedAt, 'updatedAt') : now

    if (this.endsAt && this.startsAt && this.endsAt.getTime() < this.startsAt.getTime()) {
      throw new Error('endsAt must not be before startsAt')
    }
    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}
