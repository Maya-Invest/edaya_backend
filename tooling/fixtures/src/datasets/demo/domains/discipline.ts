import type { DisciplinaryActionInput, StudentDisciplinaryActionInput } from '@edaya/core'
import { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../../shared/ids'

export const demoDisciplinaryActions = [
  {
    id: 'da-warning',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    name: 'Avertissement',
    kind: DisciplinaryActionKind.Sanction,
    severity: 1,
    defaultDurationDays: undefined,
    description: 'Rappel oral ou écrit des règles de vie scolaire.',
  },
  {
    id: 'da-detention',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    name: 'Retenue',
    kind: DisciplinaryActionKind.Sanction,
    severity: 2,
    defaultDurationDays: 1,
    description: 'Retenue surveillée en fin de journée.',
  },
  {
    id: 'da-suspension',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    name: 'Exclusion temporaire',
    kind: DisciplinaryActionKind.Sanction,
    severity: 3,
    defaultDurationDays: 3,
    description: 'Exclusion temporaire de l\'établissement.',
  },
  {
    id: 'da-merit',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    name: 'Encouragement officiel',
    kind: DisciplinaryActionKind.Reward,
    severity: undefined,
    defaultDurationDays: undefined,
    description: 'Reconnaissance écrite pour comportement exemplaire.',
  },
] as const satisfies readonly DisciplinaryActionInput[]

export const demoStudentDisciplinaryActions = [
  {
    id: 'sda-i1-s3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    incidentId: 'i1',
    studentId: 's3',
    disciplinaryActionId: 'da-warning',
    assignedByStaffId: 'st7',
    startsAt: '2026-04-12T12:00:00.000Z',
    endsAt: undefined,
    status: StudentDisciplinaryActionStatus.Active,
    notes: 'Troisième retard du mois — avertissement formalisé.',
    createdAt: '2026-04-12T12:00:00.000Z',
  },
  {
    id: 'sda-i2-s2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    incidentId: 'i2',
    studentId: 's2',
    disciplinaryActionId: 'da-detention',
    assignedByStaffId: 'st5',
    startsAt: '2026-03-23T12:00:00.000Z',
    endsAt: '2026-03-23T12:00:00.000Z',
    status: StudentDisciplinaryActionStatus.Completed,
    notes: 'Retenue de 45 minutes — travail de réflexion sur le respect du cours.',
    createdAt: '2026-03-23T12:00:00.000Z',
  },
  {
    id: 'sda-i3-s3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    incidentId: 'i3',
    studentId: 's3',
    disciplinaryActionId: 'da-detention',
    assignedByStaffId: 'st7',
    startsAt: '2026-04-27T12:00:00.000Z',
    endsAt: undefined,
    status: StudentDisciplinaryActionStatus.Active,
    notes: 'Conflit pendant la récréation — retenue programmée.',
    createdAt: '2026-04-27T12:00:00.000Z',
  },
] as const satisfies readonly StudentDisciplinaryActionInput[]
