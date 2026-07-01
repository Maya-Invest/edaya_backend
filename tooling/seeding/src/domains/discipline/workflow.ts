import type { FixtureDataset } from '@edaya/fixtures'
import type { DisciplineSeedPort } from './port'
import { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'
import { seedDateTime } from '../../support/seed-date'

export interface DevDisciplineSeedCounts {
  disciplinaryActions: number
  studentDisciplinaryActions: number
}

export async function seedDevDiscipline(
  port: DisciplineSeedPort,
  dataset: FixtureDataset,
): Promise<DevDisciplineSeedCounts> {
  const disciplinaryActions = dataset.entities.disciplinaryActions ?? []
  const studentDisciplinaryActions = dataset.entities.studentDisciplinaryActions ?? []

  for (const action of disciplinaryActions) {
    await port.saveDisciplinaryAction({
      id: action.id,
      schoolId: action.schoolId,
      name: action.name,
      kind: action.kind ?? DisciplinaryActionKind.Sanction,
      severity: action.severity ?? undefined,
      defaultDurationDays: action.defaultDurationDays ?? undefined,
      description: action.description ?? '',
    })
  }

  for (const applied of studentDisciplinaryActions) {
    await port.applyDisciplinaryAction({
      id: applied.id,
      schoolId: applied.schoolId,
      incidentId: applied.incidentId,
      studentId: applied.studentId,
      disciplinaryActionId: applied.disciplinaryActionId,
      assignedByStaffId: applied.assignedByStaffId,
      startsAt: applied.startsAt ? seedDateTime(String(applied.startsAt).slice(0, 10)) : undefined,
      endsAt: applied.endsAt ? seedDateTime(String(applied.endsAt).slice(0, 10)) : undefined,
      notes: applied.notes ?? undefined,
      createdAt: seedDateTime(String(applied.createdAt).slice(0, 10)),
    })

    const status = applied.status ?? StudentDisciplinaryActionStatus.Active
    if (status !== StudentDisciplinaryActionStatus.Active) {
      await port.updateStudentDisciplinaryActionStatus({
        studentDisciplinaryActionId: applied.id,
        status,
      })
    }
  }

  return {
    disciplinaryActions: disciplinaryActions.length,
    studentDisciplinaryActions: studentDisciplinaryActions.length,
  }
}
