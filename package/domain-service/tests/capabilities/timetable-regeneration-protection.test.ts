import type { SchoolRepositories } from '../../src/ports/school-repositories'
import { LessonSession, OccurrenceStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { regeneratableSessionIds } from '../../src/capabilities/timetable/regeneration-protection'

const lesson = new LessonSession({ id: 'session', schoolId: 'school', classGroupId: 'class', classSubjectId: 'subject', startsAt: new Date('2026-10-01T08:00Z'), endsAt: new Date('2026-10-01T09:00Z'), displayLabel: 'Math', timetableGenerated: true })
const referenceStores = ['attendance', 'classSubjectProgress', 'assessments', 'incidents', 'staffAssignments', 'resourceAssignments'] as const
function repositories(reference?: string): SchoolRepositories {
  return {
    ...Object.fromEntries(referenceStores.map(key => [key, { list: async () => key === reference ? [{ lessonSessionId: lesson.id }] : [] }])),
    teacherCorrections: { referencedLessonSessionIds: async () => reference === 'logbook' ? [lesson.id] : [] },
  } as unknown as SchoolRepositories
}

describe('generated session replacement eligibility', () => {
  test('only untouched, pending, generated sessions in the current school can be replaced', async () => {
    const protectedSessions = [
      lesson.copyWith({ id: 'manual', timetableGenerated: false }),
      lesson.copyWith({ id: 'completed', status: OccurrenceStatus.Completed }),
      lesson.copyWith({ id: 'cancelled', status: OccurrenceStatus.Cancelled }),
      lesson.copyWith({ id: 'edited', isException: true }),
      lesson.copyWith({ id: 'noted', sessionNote: 'Lesson work' }),
      lesson.copyWith({ id: 'foreign', schoolId: 'other' }),
    ]
    expect(await regeneratableSessionIds(repositories(), 'school', [lesson, ...protectedSessions])).toEqual(['session'])
  })
  for (const reference of [...referenceStores, 'logbook']) {
    test(`preserves a pending session with ${reference} records`, async () => {
      expect(await regeneratableSessionIds(repositories(reference), 'school', [lesson])).toEqual([])
    })
  }
})
