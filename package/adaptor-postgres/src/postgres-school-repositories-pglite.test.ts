import { ClassSubject, DayOfWeek, GradeLevelSubject, LessonSession, PeriodDefinition, School, TeacherUnavailability, TeacherUnavailabilityRecurrence, TimetableGenerated } from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { PostgresSchoolRepositories } from './postgres-school-repositories'

describe('PostgresSchoolRepositories with PGlite', () => {
  let pglite: PGlite
  let repos: PostgresSchoolRepositories

  beforeEach(async () => {
    pglite = new PGlite()
    repos = new PostgresSchoolRepositories(drizzle(pglite))
    await repos.init({ driver: 'pglite' })
  })

  afterEach(async () => {
    await pglite.close()
  })

  test('persists and reads schools through PostgresStore', async () => {
    const school = new School({
      id: 'school-1',
      name: 'Edaya Academy',
      timeZone: 'Africa/Douala',
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinPeriodGapSameSubject: 4,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })

    await repos.schoolsStore.save(school)

    await expect(repos.schoolsStore.findById('school-1')).resolves.toMatchObject({
      id: 'school-1',
      name: 'Edaya Academy',
      timeZone: 'Africa/Douala',
      timetableEnforceWorkloadFulfillment: false,
      timetableExcludeBreakSlots: false,
      timetableMinPeriodGapSameSubject: 4,
      timetablePreferredPeriodDefinitionIds: ['period-1'],
    })
  })

  test('lists and counts schools with repository filters', async () => {
    await repos.schoolsStore.batchSave([
      new School({
        id: 'school-a',
        name: 'North Campus',
        timeZone: 'Africa/Douala',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      new School({
        id: 'school-b',
        name: 'South Campus',
        timeZone: 'Africa/Douala',
        createdAt: new Date('2026-01-02T00:00:00.000Z'),
      }),
    ])

    await expect(repos.schoolsStore.list({ name: 'North Campus' })).resolves.toHaveLength(1)
    await expect(repos.schoolsStore.count({})).resolves.toBe(2)
  })

  test('deletes persisted schools by id', async () => {
    await repos.schoolsStore.save(new School({
      id: 'school-delete',
      name: 'Temporary School',
      timeZone: 'Africa/Douala',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    }))

    await repos.schoolsStore.delete('school-delete')
    await expect(repos.schoolsStore.findById('school-delete')).resolves.toBeUndefined()
  })

  test('round trips timetable preparation fields', async () => {
    await repos.periodDefinitions.save(new PeriodDefinition({
      id: 'period-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      label: 'Monday morning',
      dayOfWeek: DayOfWeek.Monday,
      order: 1,
      startTime: '08:00',
      endTime: '09:00',
      isTeachingSlot: false,
    }))
    await repos.gradeLevelSubjects.save(new GradeLevelSubject({
      id: 'grade-subject-1',
      gradeLevelId: 'grade-1',
      academicYearId: 'year-1',
      subjectId: 'subject-1',
      periodsPerWeek: 5,
    }))
    await repos.classSubjects.save(new ClassSubject({
      id: 'class-subject-1',
      classGroupId: 'class-1',
      subjectId: 'subject-1',
      periodsPerWeek: 5,
    }))
    await repos.lessonSessions.save(new LessonSession({
      id: 'lesson-1',
      schoolId: 'school-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      timetableGenerated: TimetableGenerated.Draft,
      startsAt: new Date('2026-09-07T08:00:00.000Z'),
      endsAt: new Date('2026-09-07T09:00:00.000Z'),
      displayLabel: 'Mathematics',
    }))

    expect(await repos.periodDefinitions.findById('period-1')).toMatchObject({
      dayOfWeek: DayOfWeek.Monday,
      isTeachingSlot: false,
    })
    expect((await repos.gradeLevelSubjects.findById('grade-subject-1'))?.periodsPerWeek).toBe(5)
    expect((await repos.classSubjects.findById('class-subject-1'))?.periodsPerWeek).toBe(5)
    expect(await repos.lessonSessions.findById('lesson-1')).toMatchObject({
      scheduleId: undefined,
      timetableGenerated: TimetableGenerated.Draft,
    })
  })

  test('round trips weekly teacher unavailability', async () => {
    await repos.teacherUnavailabilities.save(new TeacherUnavailability({
      id: 'unavailability-1',
      teacherId: 'teacher-1',
      academicYearId: 'year-1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:30',
      endTime: '11:00',
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      effectiveUntil: new Date('2026-12-31T00:00:00.000Z'),
      reason: 'Contract teaching hours',
    }))

    expect(await repos.teacherUnavailabilities.findById('unavailability-1')).toMatchObject({
      teacherId: 'teacher-1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:30',
      reason: 'Contract teaching hours',
    })
  })
})
