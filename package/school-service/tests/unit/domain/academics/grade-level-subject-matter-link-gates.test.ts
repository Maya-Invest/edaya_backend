import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { GradeLevelSubjectMatter } from '@edaya/core'
import { validateGradeLevelSubjectMatterSave } from '@edaya/school-service'
import { describe, expect, mock, test } from 'bun:test'

const link = new GradeLevelSubjectMatter({
  id: 'glsm-1',
  gradeLevelSubjectId: 'gls-1',
  subjectMatterId: 'matter-1',
})

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    gradeLevelSubjects: {
      findById: mock(async () => ({ id: 'gls-1', subjectId: 'sub-1' })),
    },
    subjectMatters: {
      findById: mock(async () => ({ id: 'matter-1', subjectId: 'sub-1' })),
    },
    gradeLevelSubjectMatters: {
      findOne: mock(async () => undefined),
    },
    ...overrides,
  } as never
}

describe('validateGradeLevelSubjectMatterSave', () => {
  test('accepts chapter links that belong to the allocated subject', async () => {
    await validateGradeLevelSubjectMatterSave(link, undefined, repositories())
  })

  test('rejects chapter links whose subject matter belongs to another subject', async () => {
    await expect(validateGradeLevelSubjectMatterSave(link, undefined, repositories({
      subjectMatters: {
        findById: mock(async () => ({ id: 'matter-1', subjectId: 'sub-2' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects duplicate chapter links on the same grade level subject', async () => {
    await expect(validateGradeLevelSubjectMatterSave(link, undefined, repositories({
      gradeLevelSubjectMatters: {
        findOne: mock(async () => ({ id: 'glsm-other', gradeLevelSubjectId: 'gls-1', subjectMatterId: 'matter-1' })),
      },
    }))).rejects.toMatchObject({
      code: 'GRADE_LEVEL_SUBJECT_MATTER_ALREADY_EXISTS',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
