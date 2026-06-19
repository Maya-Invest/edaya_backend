import type { SchoolService } from '@edaya/core'
import {
  DisciplinaryAction,
  DisciplinaryActionKind,
  StudentDisciplinaryActionStatus,
} from '@edaya/core'
import {
  countSeedDisciplinaryActions,
  countSeedStudentDisciplinaryActions,
  parseSeedDate,
  SEED_DISCIPLINARY_ACTIONS,
  SEED_STUDENT_DISCIPLINARY_ACTIONS,
} from '@edaya/dev-fixtures'

const disciplinaryKindBySeed = {
  sanction: DisciplinaryActionKind.Sanction,
  reward: DisciplinaryActionKind.Reward,
} as const

const studentDisciplinaryStatusBySeed = {
  active: StudentDisciplinaryActionStatus.Active,
  completed: StudentDisciplinaryActionStatus.Completed,
  cancelled: StudentDisciplinaryActionStatus.Cancelled,
} as const

export async function seedDiscipline(service: SchoolService): Promise<{
  disciplinaryActions: number
  studentDisciplinaryActions: number
}> {
  for (const action of SEED_DISCIPLINARY_ACTIONS) {
    await service.baseService.disciplinaryActions.save(new DisciplinaryAction({
      id: action.id,
      schoolId: action.schoolId,
      name: action.name,
      kind: disciplinaryKindBySeed[action.kind],
      severity: action.severity,
      defaultDurationDays: action.defaultDurationDays,
      description: action.description,
    }), { moduleChecked: true })
  }

  for (const applied of SEED_STUDENT_DISCIPLINARY_ACTIONS) {
    await service.applyDisciplinaryAction({
      id: applied.id,
      incidentId: applied.incidentId,
      studentId: applied.studentId,
      disciplinaryActionId: applied.disciplinaryActionId,
      startsAt: applied.startsAt ? parseSeedDate(applied.startsAt) : undefined,
      endsAt: applied.endsAt ? parseSeedDate(applied.endsAt) : undefined,
      notes: applied.notes,
      createdAt: parseSeedDate(applied.createdAt),
    })

    if (applied.status !== 'active') {
      await service.updateStudentDisciplinaryActionStatus({
        studentDisciplinaryActionId: applied.id,
        status: studentDisciplinaryStatusBySeed[applied.status],
      })
    }
  }

  return {
    disciplinaryActions: countSeedDisciplinaryActions(),
    studentDisciplinaryActions: countSeedStudentDisciplinaryActions(),
  }
}
