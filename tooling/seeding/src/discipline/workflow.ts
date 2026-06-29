import type { DisciplineSeedPort } from './port'
import { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'
import {
  SEED_DISCIPLINARY_ACTIONS,
  SEED_SCHOOL_ID,
  SEED_STUDENT_DISCIPLINARY_ACTIONS,
} from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

const DISCIPLINARY_KIND_BY_SEED = {
  sanction: DisciplinaryActionKind.Sanction,
  reward: DisciplinaryActionKind.Reward,
} as const

const STUDENT_DISCIPLINARY_STATUS_BY_SEED = {
  active: StudentDisciplinaryActionStatus.Active,
  completed: StudentDisciplinaryActionStatus.Completed,
  cancelled: StudentDisciplinaryActionStatus.Cancelled,
} as const

export interface DevDisciplineSeedCounts {
  disciplinaryActions: number
  studentDisciplinaryActions: number
}

export async function seedDevDiscipline(
  port: DisciplineSeedPort,
): Promise<DevDisciplineSeedCounts> {
  for (const action of SEED_DISCIPLINARY_ACTIONS) {
    await port.saveDisciplinaryAction({
      id: action.id,
      schoolId: action.schoolId,
      name: action.name,
      kind: DISCIPLINARY_KIND_BY_SEED[action.kind],
      severity: action.severity,
      defaultDurationDays: action.defaultDurationDays,
      description: action.description,
    })
  }

  for (const applied of SEED_STUDENT_DISCIPLINARY_ACTIONS) {
    await port.applyDisciplinaryAction({
      id: applied.id,
      schoolId: SEED_SCHOOL_ID,
      incidentId: applied.incidentId,
      studentId: applied.studentId,
      disciplinaryActionId: applied.disciplinaryActionId,
      assignedByStaffId: applied.assignedByStaffId,
      startsAt: applied.startsAt ? seedDateTime(applied.startsAt) : undefined,
      endsAt: applied.endsAt ? seedDateTime(applied.endsAt) : undefined,
      notes: applied.notes,
      createdAt: seedDateTime(applied.createdAt),
    })

    if (applied.status !== 'active') {
      await port.updateStudentDisciplinaryActionStatus({
        studentDisciplinaryActionId: applied.id,
        status: STUDENT_DISCIPLINARY_STATUS_BY_SEED[applied.status],
      })
    }
  }

  return {
    disciplinaryActions: SEED_DISCIPLINARY_ACTIONS.length,
    studentDisciplinaryActions: SEED_STUDENT_DISCIPLINARY_ACTIONS.length,
  }
}
