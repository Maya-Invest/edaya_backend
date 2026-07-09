import type { DisciplinaryActionInput, StudentDisciplinaryActionInput } from '@edaya/core'
import { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'
import { DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

export const demoCiDisciplinaryActions = [
  {
    id: 'ci-da-warning',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Avertissement',
    kind: DisciplinaryActionKind.Sanction,
    severity: 1,
    defaultDurationDays: undefined,
    description: 'Rappel oral ou écrit des règles de vie scolaire.',
  },
  {
    id: 'ci-da-detention',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Retenue',
    kind: DisciplinaryActionKind.Sanction,
    severity: 2,
    defaultDurationDays: 1,
    description: 'Retenue surveillée en fin de journée.',
  },
  {
    id: 'ci-da-suspension',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Exclusion temporaire',
    kind: DisciplinaryActionKind.Sanction,
    severity: 3,
    defaultDurationDays: 3,
    description: 'Exclusion temporaire de l\'établissement.',
  },
  {
    id: 'ci-da-merit',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Encouragement officiel',
    kind: DisciplinaryActionKind.Reward,
    severity: undefined,
    defaultDurationDays: undefined,
    description: 'Reconnaissance écrite pour comportement exemplaire.',
  },
] as const satisfies readonly DisciplinaryActionInput[]

export const demoCiStudentDisciplinaryActions = [
  {
    id: 'ci-sda-i1-s3',
    schoolId: DEMO_CI_SCHOOL_ID,
    incidentId: 'ci-i1',
    studentId: 'ci-s3',
    disciplinaryActionId: 'ci-da-warning',
    assignedByStaffId: 'ci-st7',
    startsAt: '2026-04-12T12:00:00.000Z',
    endsAt: undefined,
    status: StudentDisciplinaryActionStatus.Active,
    notes: 'Troisième retard du mois — avertissement formalisé.',
    createdAt: '2026-04-12T12:00:00.000Z',
  },
  {
    id: 'ci-sda-i2-s2',
    schoolId: DEMO_CI_SCHOOL_ID,
    incidentId: 'ci-i2',
    studentId: 'ci-s2',
    disciplinaryActionId: 'ci-da-detention',
    assignedByStaffId: 'ci-st5',
    startsAt: '2026-03-23T12:00:00.000Z',
    endsAt: '2026-03-23T12:00:00.000Z',
    status: StudentDisciplinaryActionStatus.Completed,
    notes: 'Retenue de 45 minutes — travail de réflexion sur le respect du cours.',
    createdAt: '2026-03-23T12:00:00.000Z',
  },
  {
    id: 'ci-sda-i3-s14',
    schoolId: DEMO_CI_SCHOOL_ID,
    incidentId: 'ci-i3',
    studentId: 'ci-s14',
    disciplinaryActionId: 'ci-da-detention',
    assignedByStaffId: 'ci-st7',
    startsAt: '2026-04-27T12:00:00.000Z',
    endsAt: undefined,
    status: StudentDisciplinaryActionStatus.Active,
    notes: 'Conflit pendant la récréation — retenue programmée.',
    createdAt: '2026-04-27T12:00:00.000Z',
  },
] as const satisfies readonly StudentDisciplinaryActionInput[]
