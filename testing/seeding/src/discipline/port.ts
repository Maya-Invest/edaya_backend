import type { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'

export interface DisciplinaryActionSeedRecord {
  id: string
  schoolId: string
  name: string
  kind: DisciplinaryActionKind
  severity?: number
  defaultDurationDays?: number
  description: string
}

export interface StudentDisciplinaryActionSeedRecord {
  id: string
  schoolId: string
  incidentId: string
  studentId: string
  disciplinaryActionId: string
  assignedByStaffId: string
  startsAt?: string
  endsAt?: string
  notes?: string
  createdAt: string
}

export interface StudentDisciplinaryStatusSeedRecord {
  studentDisciplinaryActionId: string
  status: StudentDisciplinaryActionStatus
}

export interface DisciplineSeedPort {
  saveDisciplinaryAction: (record: DisciplinaryActionSeedRecord) => Promise<void>
  applyDisciplinaryAction: (record: StudentDisciplinaryActionSeedRecord) => Promise<void>
  updateStudentDisciplinaryActionStatus: (
    record: StudentDisciplinaryStatusSeedRecord,
  ) => Promise<void>
}
