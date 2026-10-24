import { LessonSession, resourceAccessScope } from '@edaya/core'
import { expect, test } from 'bun:test'
import { createAuthorizationDatabase, seedAuthorizationRelationships } from './support/authorization-database'

test('family participation filters direct reads, lists and counts by occurrence dates while retaining historical offerings', async () => {
  const fixture = await createAuthorizationDatabase()
  try {
    await seedAuthorizationRelationships(fixture.db)
    const { repositories } = fixture
    await fixture.db.exec('UPDATE student_subject_enrollments SET ended_at=\'2026-06-01\' WHERE student_class_enrollment_id=\'enrollment-a\'; UPDATE class_subjects SET is_offered=false WHERE id=\'math-a\'')
    for (const [id, date] of [['taken', '2026-05-31T09:00:00Z'], ['after-withdrawal', '2026-06-01T09:00:00Z']]) {
      const startsAt = new Date(date!)
      await repositories.lessonSessions.save(new LessonSession({ id: id!, schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', displayLabel: 'Math', startsAt, endsAt: new Date(startsAt.getTime() + 3600000) }))
    }
    const clauses = [{ target: { kind: 'student' as const, studentId: 'student-a' }, academicYearId: 'year-a' }]
    const lessons = repositories.lessonSessions.forAccess(resourceAccessScope('school-a', 'lessonSessions', clauses))
    expect(await lessons.count()).toBe(1)
    expect((await lessons.list({ $limit: 1 })).map(row => row.id)).toEqual(['taken'])
    expect(await lessons.findById('after-withdrawal')).toBeUndefined()
    expect((await lessons.findById('taken'))?.id).toBe('taken')
    const offerings = repositories.classSubjects.forAccess(resourceAccessScope('school-a', 'classSubjects', clauses))
    expect((await offerings.findById('math-a'))?.isOffered).toBe(false)
    expect(await offerings.findById('math-b')).toBeUndefined()
    const sibling = repositories.lessonSessions.forAccess(resourceAccessScope('school-a', 'lessonSessions', [{ target: { kind: 'student', studentId: 'student-other' }, academicYearId: 'year-a' }]))
    expect(await sibling.count()).toBe(0)
  }
  finally { await fixture.db.close() }
}, 30000)
