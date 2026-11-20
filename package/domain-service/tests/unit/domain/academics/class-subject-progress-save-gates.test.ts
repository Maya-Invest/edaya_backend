import type { BusinessRuleViolationError } from '@edaya/core'
import { AuthorizationError } from '@edaya/authorization'
import { ClassSubjectMatterStatus, ClassSubjectProgress } from '@edaya/core'
import { validateClassSubjectProgressSave } from '@edaya/service'
import { describe, expect, mock, test } from 'bun:test'

const progress = new ClassSubjectProgress({
  id: 'progress-1',
  classSubjectMatterId: 'matter-1',
  lessonSessionId: 'session-1',
  completed: false,
})

function repositories(overrides: Record<string, unknown> = {}) {
  return {
    classSubjectMatters: {
      findById: mock(async () => ({
        id: 'matter-1',
        classSubjectId: 'cs-1',
        completedPercentage: 20,
      })),
    },
    lessonSessions: {
      findById: mock(async () => ({
        id: 'session-1',
        classGroupId: 'class-1',
        classSubjectId: 'cs-1',
      })),
    },
    classSubjects: {
      findById: mock(async () => ({ id: 'cs-1', classGroupId: 'class-1' })),
    },
    classSubjectProgress: {
      findOne: mock(async () => undefined),
    },
    ...overrides,
  } as never
}

describe('ClassSubjectProgress status derivation', () => {
  test('maps the completion flag to class subject matter status', () => {
    expect(new ClassSubjectProgress({
      id: 'p0',
      classSubjectMatterId: 'matter-1',
      lessonSessionId: 'session-1',
      completed: null,
    }).status).toBe(ClassSubjectMatterStatus.NotStarted)

    expect(new ClassSubjectProgress({
      id: 'p50',
      classSubjectMatterId: 'matter-1',
      lessonSessionId: 'session-1',
      completed: false,
    }).status).toBe(ClassSubjectMatterStatus.InProgress)

    expect(new ClassSubjectProgress({
      id: 'p100',
      classSubjectMatterId: 'matter-1',
      lessonSessionId: 'session-1',
      completed: true,
    }).status).toBe(ClassSubjectMatterStatus.Completed)
  })
})

describe('validateClassSubjectProgressSave', () => {
  test('accepts progress when matter, lesson session, and class subject align', async () => {
    await validateClassSubjectProgressSave(progress, undefined, repositories())
  })

  test('rejects progress when matter or lesson session is missing', async () => {
    await expect(validateClassSubjectProgressSave(progress, undefined, repositories({
      classSubjectMatters: { findById: mock(async () => undefined) },
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await expect(validateClassSubjectProgressSave(progress, undefined, repositories({
      lessonSessions: { findById: mock(async () => undefined) },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects progress when the lesson session class subject does not match the matter class subject', async () => {
    await expect(validateClassSubjectProgressSave(progress, undefined, repositories({
      lessonSessions: {
        findById: mock(async () => ({
          id: 'session-1',
          classGroupId: 'class-1',
          classSubjectId: 'cs-other',
        })),
      },
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('rejects duplicate progress records for the same matter and lesson session', async () => {
    await expect(validateClassSubjectProgressSave(progress, undefined, repositories({
      classSubjectProgress: {
        findOne: mock(async () => ({ id: 'progress-other', classSubjectMatterId: 'matter-1', lessonSessionId: 'session-1' })),
      },
    }))).rejects.toMatchObject({
      code: 'DUPLICATE_PROGRESS_RECORD',
    } satisfies Partial<BusinessRuleViolationError>)
  })
})
