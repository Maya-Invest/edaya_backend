import { describe, expect, mock, test } from 'bun:test'
import { AuthorizationError } from '../../../src/capabilities/authorization'
import { legacyScopeToResourcePath } from '../../../src/capabilities/authorization/scope/legacy-scope-path'
import {
  resolveActivitySessionResourcePath,
  resolveAssessmentResourcePath,
  resolveLessonSessionResourcePath,
  resourcePathForActivity,
  resourcePathForClassGroup,
  resourcePathForClassSubject,
  resourcePathForClassSubjectWildcard,
  resourcePathForStudent,
  TENANT_WIDE_RESOURCE_PATH,
} from '../../../src/capabilities/authorization/scope/resolve-resource-path'
import {
  scopeSegmentBounds,
  segmentScopeAt,
} from '../../../src/capabilities/authorization/scope/scope-segments'

describe('scopeSegmentBounds', () => {
  test('returns single-segment bounds for class group scope', () => {
    expect(scopeSegmentBounds('class_group')).toEqual({ min: 1, max: 1 })
  })

  test('returns two-segment bounds for class subject scope', () => {
    expect(scopeSegmentBounds('class_subject')).toEqual({ min: 2, max: 2 })
  })

  test('returns flexible bounds for activity scope', () => {
    expect(scopeSegmentBounds('activity')).toEqual({ min: 1, max: 2 })
  })
})

describe('segmentScopeAt', () => {
  test('maps class subject permission paths to class group then class subject', () => {
    expect(segmentScopeAt('class_subject', 0, 2)).toBe('class_group')
    expect(segmentScopeAt('class_subject', 1, 2)).toBe('class_subject')
  })

  test('maps activity paths with single segment to activity scope', () => {
    expect(segmentScopeAt('activity', 0, 1)).toBe('activity')
  })

  test('maps activity paths with class group prefix', () => {
    expect(segmentScopeAt('activity', 0, 2)).toBe('class_group')
    expect(segmentScopeAt('activity', 1, 2)).toBe('activity')
  })

  test('maps grade level permission paths', () => {
    expect(segmentScopeAt('grade_level', 0, 2)).toBe('grade_level')
    expect(segmentScopeAt('grade_level', 1, 2)).toBe('grade_level_subject')
    expect(segmentScopeAt('grade_level_subject', 0, 2)).toBe('grade_level')
  })

  test('returns portal and platform scopes directly', () => {
    expect(segmentScopeAt('student', 0, 1)).toBe('student')
    expect(segmentScopeAt('platform', 0, 1)).toBe('platform')
    expect(segmentScopeAt('class_group', 0, 1)).toBe('class_group')
  })
})

describe('scopeSegmentBounds grade level', () => {
  test('returns expected bounds for grade level scopes', () => {
    expect(scopeSegmentBounds('grade_level')).toEqual({ min: 1, max: 1 })
    expect(scopeSegmentBounds('grade_level_subject')).toEqual({ min: 2, max: 2 })
  })
})

describe('resolve-resource-path helpers', () => {
  test('builds static resource paths', () => {
    expect(TENANT_WIDE_RESOURCE_PATH).toBe('')
    expect(resourcePathForClassGroup('cg-1')).toBe('cg-1')
    expect(resourcePathForClassSubject('cg-1', 'cs-1')).toBe('cg-1:cs-1')
    expect(resourcePathForClassSubjectWildcard('cg-1')).toBe('cg-1:*')
    expect(resourcePathForStudent('student-1')).toBe('student-1')
    expect(resourcePathForActivity('activity-1', 'cg-1')).toBe('cg-1:activity-1')
    expect(resourcePathForActivity('activity-1')).toBe('activity-1')
  })

  test('resolveLessonSessionResourcePath loads class subject path', async () => {
    const path = await resolveLessonSessionResourcePath('ls-1', {
      lessonSessions: {
        findById: mock(async () => ({
          id: 'ls-1',
          classGroupId: 'cg-1',
          classSubjectId: 'cs-1',
        })),
      },
    } as never)

    expect(path).toBe('cg-1:cs-1')
  })

  test('resolveLessonSessionResourcePath rejects missing session', async () => {
    await expect(resolveLessonSessionResourcePath('missing', {
      lessonSessions: { findById: mock(async () => undefined) },
    } as never)).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('resolveActivitySessionResourcePath loads activity path', async () => {
    const path = await resolveActivitySessionResourcePath('as-1', {
      activitySessions: {
        findById: mock(async () => ({
          id: 'as-1',
          activityId: 'activity-1',
          classGroupId: 'cg-1',
        })),
      },
    } as never)

    expect(path).toBe('cg-1:activity-1')
  })

  test('resolveAssessmentResourcePath loads assessment class subject path', async () => {
    const path = await resolveAssessmentResourcePath('assessment-1', {
      assessments: {
        findById: mock(async () => ({
          id: 'assessment-1',
          classGroupId: 'cg-1',
          classSubjectId: 'cs-1',
        })),
      },
    } as never)

    expect(path).toBe('cg-1:cs-1')
  })
})

describe('legacyScopeToResourcePath', () => {
  test('maps tenant-wide and entity scopes to resource paths', () => {
    expect(legacyScopeToResourcePath('school', 'school-1')).toBe('')
    expect(legacyScopeToResourcePath('class_group', 'cg-1')).toBe('cg-1')
    expect(legacyScopeToResourcePath('class_subject', 'cs-1')).toBe('cs-1')
    expect(legacyScopeToResourcePath('session', 'ls-1')).toBe('ls-1')
  })
})
