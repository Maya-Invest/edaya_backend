import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'

export enum IncidentInvolvementRole {
  Subject = 'subject',
  Witness = 'witness',
  Victim = 'victim',
}

export interface StudentIncidentInvolvementArgs {
  id: string
  incidentId: string
  studentId: string
  role: IncidentInvolvementRole
  notes?: string | null
  createdAt?: Date
}

/**
 * Links a Student to an Incident, specifying their role and any resulting disciplinary action.
 * References a DisciplinaryAction from the school catalog and allows freeform notes.
 */
export class StudentIncidentInvolvement {
  readonly id: string
  readonly incidentId: string
  readonly studentId: string
  readonly role: IncidentInvolvementRole
  readonly notes?: string
  readonly createdAt: Date

  constructor({
    id,
    incidentId,
    studentId,
    role,
    notes,
    createdAt,
  }: StudentIncidentInvolvementArgs) {
    this.id = requireNonBlank(id, 'id')
    this.incidentId = requireNonBlank(incidentId, 'incidentId')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.role = role
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.createdAt = createdAt ?? new Date()
  }
}
