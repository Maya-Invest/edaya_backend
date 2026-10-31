import { ClassSubject, LessonSession, Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const lessonBase = {
  id: 'lesson-1',
  schoolId: 'school-1',
  classGroupId: 'class-1',
  classSubjectId: 'class-subject-1',
  startsAt: new Date('2026-09-07T08:00:00.000Z'),
  endsAt: new Date('2026-09-07T09:00:00.000Z'),
  displayLabel: 'Mathematics',
}

describe('timetable preparation domain contracts', () => {
  test('allows standalone and generated lesson sessions without a schedule', () => {
    const standalone = new LessonSession(lessonBase)
    const generated = new LessonSession({
      ...lessonBase,
      id: 'lesson-generated',
      timetableGenerated: true,
    })

    expect(standalone.scheduleId).toBeUndefined()
    expect(standalone.timetableGenerated).toBe(false)
    expect(generated.scheduleId).toBeUndefined()
    expect(generated.timetableGenerated).toBe(true)
  })

  test('preserves generated state through copyWith', () => {
    const generated = new LessonSession({
      ...lessonBase,
      timetableGenerated: true,
    })

    expect(generated.copyWith({ displayLabel: 'Updated' }).timetableGenerated).toBe(true)
  })

  test('accepts nullable weekly workload on grade and class subjects', () => {
    const gradeSubject = new Subject({
      categoryId: 'test-category',
      id: 'subject-1',
      schoolId: 'school-1',
      name: 'Math',
      gradeLevelId: 'grade-1',
      academicYearId: 'year-1',
      periodsPerWeek: 5,
    })
    const classSubject = new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
      periodsPerWeek: 5,
    })

    expect(gradeSubject.periodsPerWeek).toBe(5)
    expect(classSubject.periodsPerWeek).toBe(5)
  })
})
