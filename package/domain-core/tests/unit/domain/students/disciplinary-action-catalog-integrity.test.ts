import { DisciplinaryAction, DisciplinaryActionKind } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('DisciplinaryAction entity catalog integrity', () => {
  const baseArgs = {
    id: 'action-warning',
    schoolId: 'school-1',
    name: 'Written Warning',
    kind: DisciplinaryActionKind.Sanction,
  }

  it('instantiates successfully with valid inputs and defaults', () => {
    const action = new DisciplinaryAction(baseArgs)

    expect(action.id).toBe('action-warning')
    expect(action.schoolId).toBe('school-1')
    expect(action.name).toBe('Written Warning')
    expect(action.kind).toBe(DisciplinaryActionKind.Sanction)
    expect(action.createdAt).toBeInstanceOf(Date)
    expect(action.severity).toBeUndefined()
    expect(action.defaultDurationDays).toBeUndefined()
    expect(action.description).toBeUndefined()
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const action = new DisciplinaryAction({
      ...baseArgs,
      severity: 2.5,
      defaultDurationDays: 5,
      description: 'Official written warning to student and guardian',
      createdAt: createdDate,
    })

    expect(action.severity).toBe(2.5)
    expect(action.defaultDurationDays).toBe(5)
    expect(action.description).toBe('Official written warning to student and guardian')
    expect(action.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new DisciplinaryAction({ ...baseArgs, id: '' })).toThrow()
    expect(() => new DisciplinaryAction({ ...baseArgs, schoolId: ' ' })).toThrow()
    expect(() => new DisciplinaryAction({ ...baseArgs, name: '\t' })).toThrow()
  })

  it('throws error when severity is zero or negative', () => {
    expect(() => new DisciplinaryAction({ ...baseArgs, severity: 0 })).toThrow()
    expect(() => new DisciplinaryAction({ ...baseArgs, severity: -1 })).toThrow()
  })

  it('throws error when defaultDurationDays is zero or negative', () => {
    expect(() => new DisciplinaryAction({ ...baseArgs, defaultDurationDays: 0 })).toThrow()
    expect(() => new DisciplinaryAction({ ...baseArgs, defaultDurationDays: -5 })).toThrow()
  })

  it('throws error when optional description is empty string', () => {
    expect(() => new DisciplinaryAction({ ...baseArgs, description: '   ' })).toThrow()
  })
})
