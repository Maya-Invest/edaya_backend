import type { DisciplinaryActionInput, StudentDisciplinaryActionInput } from '@edaya/core'
import { DisciplinaryActionKind, StudentDisciplinaryActionStatus } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoDisciplinaryActions,
  demoStudentDisciplinaryActions,
} from '../../../../src/datasets/demo/domains/discipline'

describe('demo discipline', () => {
  it('typed catalog actions satisfy DisciplinaryActionInput', () => {
    const action = demoDisciplinaryActions[0] satisfies DisciplinaryActionInput
    expect(action.kind).toBe(DisciplinaryActionKind.Sanction)
  })

  it('typed applied actions satisfy StudentDisciplinaryActionInput', () => {
    const action = demoStudentDisciplinaryActions[0] satisfies StudentDisciplinaryActionInput
    expect(action.status).toBe(StudentDisciplinaryActionStatus.Active)
  })

  it('includes catalog and applied actions', () => {
    expect(demoDisciplinaryActions).toHaveLength(4)
    expect(demoStudentDisciplinaryActions).toHaveLength(3)
  })
})
