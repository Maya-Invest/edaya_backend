import { SEED_SCHOOL_ID } from '../core'

export type SeedDisciplinaryActionKind = 'sanction' | 'reward'

export interface SeedDisciplinaryAction {
  id: string
  schoolId: string
  name: string
  kind: SeedDisciplinaryActionKind
  severity?: number
  defaultDurationDays?: number
  description: string
}

export type SeedStudentDisciplinaryActionStatus = 'active' | 'completed' | 'cancelled'

export interface SeedStudentDisciplinaryAction {
  id: string
  incidentId: string
  studentId: string
  disciplinaryActionId: string
  assignedByStaffId: string
  startsAt?: string
  endsAt?: string
  status: SeedStudentDisciplinaryActionStatus
  notes?: string
  createdAt: string
}

/** School disciplinary catalog — sanctions and rewards. */
export const SEED_DISCIPLINARY_ACTIONS: readonly SeedDisciplinaryAction[] = [
  {
    id: 'da-warning',
    schoolId: SEED_SCHOOL_ID,
    name: 'Avertissement',
    kind: 'sanction',
    severity: 1,
    description: 'Rappel oral ou écrit des règles de vie scolaire.',
  },
  {
    id: 'da-detention',
    schoolId: SEED_SCHOOL_ID,
    name: 'Retenue',
    kind: 'sanction',
    severity: 2,
    defaultDurationDays: 1,
    description: 'Retenue surveillée en fin de journée.',
  },
  {
    id: 'da-suspension',
    schoolId: SEED_SCHOOL_ID,
    name: 'Exclusion temporaire',
    kind: 'sanction',
    severity: 3,
    defaultDurationDays: 3,
    description: 'Exclusion temporaire de l\'établissement.',
  },
  {
    id: 'da-merit',
    schoolId: SEED_SCHOOL_ID,
    name: 'Encouragement officiel',
    kind: 'reward',
    description: 'Reconnaissance écrite pour comportement exemplaire.',
  },
] as const

/** Applied disciplinary actions linked to seeded incidents. */
export const SEED_STUDENT_DISCIPLINARY_ACTIONS: readonly SeedStudentDisciplinaryAction[] = [
  {
    id: 'sda-i1-s3',
    incidentId: 'i1',
    studentId: 's3',
    disciplinaryActionId: 'da-warning',
    assignedByStaffId: 'st7',
    startsAt: '2026-04-12',
    status: 'active',
    notes: 'Troisième retard du mois — avertissement formalisé.',
    createdAt: '2026-04-12',
  },
  {
    id: 'sda-i2-s2',
    incidentId: 'i2',
    studentId: 's2',
    disciplinaryActionId: 'da-detention',
    assignedByStaffId: 'st5',
    startsAt: '2026-03-23',
    endsAt: '2026-03-23',
    status: 'completed',
    notes: 'Retenue de 45 minutes — travail de réflexion sur le respect du cours.',
    createdAt: '2026-03-23',
  },
  {
    id: 'sda-i3-s3',
    incidentId: 'i3',
    studentId: 's3',
    disciplinaryActionId: 'da-detention',
    assignedByStaffId: 'st7',
    startsAt: '2026-04-27',
    status: 'active',
    notes: 'Conflit pendant la récréation — retenue programmée.',
    createdAt: '2026-04-27',
  },
] as const

export function countSeedDisciplinaryActions(): number {
  return SEED_DISCIPLINARY_ACTIONS.length
}

export function countSeedStudentDisciplinaryActions(): number {
  return SEED_STUDENT_DISCIPLINARY_ACTIONS.length
}
