import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum IncidentInvolvementRole {
  Subject = 'subject',
  Witness = 'witness',
  Victim = 'victim',
}

export const studentIncidentInvolvementBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  incidentId: z.string().trim().min(1, 'incidentId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  role: z.nativeEnum(IncidentInvolvementRole),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export const studentIncidentInvolvementSchema = studentIncidentInvolvementBaseSchema

export type StudentIncidentInvolvementData = z.infer<typeof studentIncidentInvolvementSchema>
export type StudentIncidentInvolvementInput = z.input<typeof studentIncidentInvolvementSchema>

export const studentIncidentInvolvementCreateSchema = studentIncidentInvolvementBaseSchema.omit({ createdAt: true })
export const studentIncidentInvolvementUpdateSchema = studentIncidentInvolvementBaseSchema.partial().required({ id: true })

/**
 * Links a Student to an Incident, specifying their role and any resulting disciplinary action.
 * References a DisciplinaryAction from the school catalog and allows freeform notes.
 */
export class StudentIncidentInvolvement {
  readonly data: StudentIncidentInvolvementData

  constructor(args: StudentIncidentInvolvementInput) {
    this.data = parseDomain(studentIncidentInvolvementSchema, args)
  }

  get id() { return this.data.id }
  get incidentId() { return this.data.incidentId }
  get studentId() { return this.data.studentId }
  get role() { return this.data.role }
  get notes() { return this.data.notes }
  get createdAt() { return this.data.createdAt }
}
