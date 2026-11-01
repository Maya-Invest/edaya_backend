import {
  ActivitySession,
  CalendarEvent,
  CalendarEventKind,
  CalendarEventScopeKind,
  ClassGroup,
  ClassSubject,
  DayOfWeek,
  GradeLevel,
  PeriodDefinition,
  Subject,
  SubjectColor,
  TeacherAssignment,
  TeacherAssignmentKind,
  TimetableGenerationMode,
} from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { createFixtureSubjectCategory, saveSchool } from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

const startDate = new Date('2026-09-07T00:00:00.000Z')
const endDate = new Date('2026-09-11T00:00:00.000Z')

describeIntegration('timetable generation lifecycle', () => {
  it('resolves calendar and activity constraints and persists generated sessions', async () => {
    const { app, schoolRepositories } = await createTestApp()
    await saveSchool(app, {
      id: 'school',
      name: 'Edaya',
      timeZone: 'UTC',
      timetableMinDayGapSameSubject: 1,
      timetableGenerationMode: TimetableGenerationMode.Free,
    })
    await app.setupWorkflow.createAcademicYear({
      id: 'year',
      schoolId: 'school',
      name: '2026-2027',
      startDate,
      endDate,
    })
    await schoolRepositories.gradeLevels.save(new GradeLevel({
      id: 'grade',
      schoolId: 'school',
      name: 'Grade 6',
      label: 'G6',
      order: 1,
    }))
    await schoolRepositories.classGroups.save(new ClassGroup({
      id: 'class',
      schoolId: 'school',
      academicYearId: 'year',
      gradeLevelId: 'grade',
      name: 'Grade 6 A',
    }))
    await schoolRepositories.subjects.save(new Subject({ gradeLevelId: 'grade', academicYearId: 'year', id: 'math', schoolId: 'school', name: 'Mathematics', categoryId: (await createFixtureSubjectCategory(app, 'school')).id, color: SubjectColor.Mint }))
    await schoolRepositories.classSubjects.save(new ClassSubject({
      id: 'class-math',
      classGroupId: 'class',
      subjectId: 'math',
      periodsPerWeek: 2,
    }))
    await schoolRepositories.teacherAssignments.save(new TeacherAssignment({
      id: 'math-teacher',
      teacherId: 'teacher',
      academicYearId: 'year',
      kind: TeacherAssignmentKind.Subject,
      classSubjectId: 'class-math',
    }))

    const weekdays = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]
    for (const dayOfWeek of weekdays) {
      await schoolRepositories.periodDefinitions.save(new PeriodDefinition({
        id: `period-${dayOfWeek}`,
        schoolId: 'school',
        academicYearId: 'year',
        label: 'Period 1',
        dayOfWeek,
        order: 1,
        startTime: '08:00',
        endTime: '09:00',
        isTeachingSlot: dayOfWeek !== DayOfWeek.Wednesday,
      }))
    }
    await schoolRepositories.calendarEvents.save(new CalendarEvent({
      id: 'closure',
      schoolId: 'school',
      academicYearId: 'year',
      title: 'Tuesday closure',
      startDate: new Date('2026-09-08T00:00:00.000Z'),
      endDate: new Date('2026-09-08T00:00:00.000Z'),
      kind: CalendarEventKind.Holiday,
      isNonSchoolDay: true,
      scopeKind: CalendarEventScopeKind.ClassGroup,
      scopeId: 'class',
    }))
    await schoolRepositories.activitySessions.save(new ActivitySession({
      id: 'friday-activity',
      schoolId: 'school',
      classGroupId: 'class',
      scheduleId: 'activity-schedule',
      activityId: 'activity',
      startsAt: new Date('2026-09-11T08:00:00.000Z'),
      endsAt: new Date('2026-09-11T09:00:00.000Z'),
      displayLabel: 'Assembly',
    }))

    const cells = await app.resolveTimetableSpace({ classGroupId: 'class', academicYearId: 'year', startDate, endDate })
    expect(cells.map(cell => cell.date)).toEqual(['2026-09-07', '2026-09-10', '2026-09-11'])

    const generated = await app.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class',
      academicYearId: 'year',
      startDate,
      endDate,
    })
    expect(generated.sessions.map(session => session.startsAt.toISOString().slice(0, 10))).toEqual(['2026-09-07', '2026-09-10'])
    expect(generated.sessions.every(session => session.timetableGenerated === true)).toBe(true)
  })
})
