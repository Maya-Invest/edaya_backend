import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { GradeLevelSubject } from '@edaya/core'
import { validateGradeLevelSubjectDelete, validateGradeLevelSubjectSave } from '@edaya/school-service'
import { describe, expect, mock, test } from 'bun:test'

const gradeLevelSubject = new GradeLevelSubject({
  id: 'gls-1',
  gradeLevelId: 'gl-1',
  academicYearId: 'year-1',
  subjectId: 'sub-1',
  coefficient: 2,
})

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    gradeLevels: {
      findById: mock(async () => ({ id: 'gl-1', schoolId: 'school-1' })),
    },
    academicYears: {
      findById: mock(async () => ({ id: 'year-1', schoolId: 'school-1' })),
    },
    subjects: {
      findById: mock(async () => ({ id: 'sub-1', schoolId: 'school-1' })),
    },
    gradeLevelSubjects: {
      findOne: mock(async () => undefined),
    },
    classSubjects: {
      list: mock(async () => []),
    },
    assessments: { list: mock(async () => []) },
    lessonSessions: { list: mock(async () => []) },
    staffAssignments: { list: mock(async () => []) },
    ...overrides,
  } as never
}

describe('validateGradeLevelSubjectSave', () => {
  test('accepts a new allocation when references belong to the same school', async () => {
    await validateGradeLevelSubjectSave(gradeLevelSubject, undefined, repositories())
  })

  test('rejects duplicate allocations for the same grade level and subject', async () => {
    await expect(validateGradeLevelSubjectSave(gradeLevelSubject, undefined, repositories({
      gradeLevelSubjects: {
        findOne: mock(async () => ({ id: 'gls-other', gradeLevelId: 'gl-1', academicYearId: 'year-1', subjectId: 'sub-1' })),
      },
    }))).rejects.toMatchObject({
      code: 'GRADE_LEVEL_SUBJECT_ALREADY_EXISTS',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects identity changes on existing allocations', async () => {
    const existing = new GradeLevelSubject({
      id: 'gls-1',
      gradeLevelId: 'gl-1',
      academicYearId: 'year-1',
      subjectId: 'sub-1',
    })

    await expect(validateGradeLevelSubjectSave(new GradeLevelSubject({
      ...existing.data,
      subjectId: 'sub-2',
    }), existing, repositories())).rejects.toMatchObject({
      code: 'GRADE_LEVEL_SUBJECT_IDENTITY_IMMUTABLE',
    } satisfies Partial<BusinessRuleViolationError>)
  })

  test('rejects allocations whose academic year belongs to another school', async () => {
    await expect(validateGradeLevelSubjectSave(gradeLevelSubject, undefined, repositories({
      academicYears: {
        findById: mock(async () => ({ id: 'year-1', schoolId: 'other-school' })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('validateGradeLevelSubjectDelete', () => {
  test('allows delete when mirrored class subjects have no dependent records', async () => {
    await validateGradeLevelSubjectDelete(gradeLevelSubject, repositories())
  })

  test('blocks delete when assessments still reference mirrored class subjects', async () => {
    await expect(validateGradeLevelSubjectDelete(gradeLevelSubject, repositories({
      classSubjects: {
        list: mock(async () => [{ id: 'cs-1', gradeLevelSubjectId: 'gls-1' }]),
      },
      assessments: {
        list: mock(async () => [{ id: 'assessment-1' }]),
      },
    }))).rejects.toMatchObject({
      code: 'GRADE_LEVEL_SUBJECT_HAS_DEPENDENCIES',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
