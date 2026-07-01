import type {
  DisciplinaryActionSeedRecord,
  DisciplineSeedPort,
  StudentDisciplinaryActionSeedRecord,
  StudentDisciplinaryStatusSeedRecord,
} from './port'
import { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'
import { SEED_DISCIPLINARY_ACTIONS, SEED_STUDENT_DISCIPLINARY_ACTIONS } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevDiscipline } from './workflow'

describe('discipline seed port workflow', () => {
  test('seeds the catalog before applied actions and performs non-active transitions', async () => {
    const catalog: DisciplinaryActionSeedRecord[] = []
    const applied: StudentDisciplinaryActionSeedRecord[] = []
    const statuses: StudentDisciplinaryStatusSeedRecord[] = []
    const port: DisciplineSeedPort = {
      saveDisciplinaryAction: async record => void catalog.push(record),
      applyDisciplinaryAction: async record => void applied.push(record),
      updateStudentDisciplinaryActionStatus: async record => void statuses.push(record),
    }

    const counts = await seedDevDiscipline(port)

    expect(counts).toEqual({
      disciplinaryActions: SEED_DISCIPLINARY_ACTIONS.length,
      studentDisciplinaryActions: SEED_STUDENT_DISCIPLINARY_ACTIONS.length,
    })
    expect(catalog.map(record => record.kind)).toContain(DisciplinaryActionKind.Reward)
    expect(applied[0]?.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(statuses).toHaveLength(
      SEED_STUDENT_DISCIPLINARY_ACTIONS.filter(record => record.status !== 'active').length,
    )
    expect(statuses[0]?.status).toBe(StudentDisciplinaryActionStatus.Completed)
  })
})
