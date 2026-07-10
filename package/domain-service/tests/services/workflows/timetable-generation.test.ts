import type { AuthorizationPolicy } from '@edaya/authorization'
import type { AtomicExecutionPort, SchoolInput } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import {
  AcademicYear,
  CalendarEvent,
  CalendarEventKind,
  CalendarEventScopeKind,
  ClassGroup,
  ClassSubject,
  DayOfWeek,
  GradeLevel,
  LessonSession,
  noOpNotificationGateway,
  OccurrenceStatus,
  PeriodDefinition,
  School,
  Subject,
  SubjectCategory,
  SubjectColor,
  TeacherAssignment,
  TeacherAssignmentKind,
  TimetableGenerated,
} from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { resolveTimetableSpace, solveTimetable } from '../../../src/services/workflows/timetable-generation'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'

const weekStart = new Date('2026-09-07T00:00:00.000Z')
const weekEnd = new Date('2026-09-11T00:00:00.000Z')
const weekdays = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]

function period(dayOfWeek: DayOfWeek, suffix = '') {
  return new PeriodDefinition({
    id: `period-${dayOfWeek}${suffix}`,
    schoolId: 'school-1',
    academicYearId: 'year-1',
    label: `Period ${dayOfWeek}`,
    dayOfWeek,
    order: suffix ? 2 : 1,
    startTime: suffix ? '09:00' : '08:00',
    endTime: suffix ? '10:00' : '09:00',
    isBreak: suffix === '-break',
    isTeachingSlot: suffix !== '-disabled',
  })
}

describe('timetable resolver and solver', () => {
  test('resolves ordered teaching cells and excludes closures, breaks, and disabled slots', async () => {
    const classGroup = new ClassGroup({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 1',
    })
    const repositories = {
      classGroups: { findById: async () => classGroup },
      academicYears: {
        findById: async () => new AcademicYear({
          id: 'year-1',
          schoolId: 'school-1',
          name: '2026',
          startDate: weekStart,
          endDate: weekEnd,
          isActive: true,
        }),
      },
      periodDefinitions: {
        list: async () => [period(DayOfWeek.Monday), period(DayOfWeek.Monday, '-break'), period(DayOfWeek.Tuesday), period(DayOfWeek.Wednesday, '-disabled')],
      },
      calendarEvents: {
        list: async () => [new CalendarEvent({
          id: 'closure-1',
          schoolId: 'school-1',
          academicYearId: 'year-1',
          title: 'Tuesday closure',
          startDate: new Date('2026-09-08T00:00:00.000Z'),
          endDate: new Date('2026-09-08T00:00:00.000Z'),
          kind: CalendarEventKind.Holiday,
          isNonSchoolDay: true,
          scopeKind: CalendarEventScopeKind.ClassGroup,
          scopeId: 'class-1',
        })],
      },
    } as unknown as SchoolRepositories

    const cells = await resolveTimetableSpace(repositories, {
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(cells).toHaveLength(1)
    expect(cells[0]).toMatchObject({ date: '2026-09-07', weekKey: '2026-09-07', weeklyIndex: 0 })
  })

  test('places deterministically, honors preferred cells and teacher occupancy, and reports unmet workload', () => {
    const cells = weekdays.slice(0, 3).map((day, index) => ({
      date: `2026-09-0${7 + index}`,
      weekKey: '2026-09-07',
      weeklyIndex: index,
      periodDefinitionId: `period-${day}`,
      startsAt: new Date(Date.UTC(2026, 8, 7 + index, 8)),
      endsAt: new Date(Date.UTC(2026, 8, 7 + index, 9)),
    }))
    const result = solveTimetable({
      classGroupId: 'class-1',
      cells,
      subjects: [{ classSubjectId: 'subject-1', displayLabel: 'Math', periodsPerWeek: 3, teacherIds: ['teacher-1', 'teacher-2'] }],
      occupiedIntervals: [{
        layer: 'teacher',
        layerKey: 'teacher-2',
        startsAt: cells[0]!.startsAt,
        endsAt: cells[0]!.endsAt,
      }],
      options: {
        enforceWorkloadFulfillment: false,
        excludeBreakSlots: true,
        minPeriodGapSameSubject: 1,
        preferredPeriodDefinitionIds: [cells[2]!.periodDefinitionId],
      },
    })

    expect(result.placements.map(item => item.cell.periodDefinitionId)).toEqual([
      cells[2]!.periodDefinitionId,
      cells[1]!.periodDefinitionId,
    ])
    expect(result.unmetWorkloads).toEqual([{ classSubjectId: 'subject-1', weekKey: '2026-09-07', required: 3, placed: 2 }])
  })
})

function createWorkflowContext() {
  const school = new School({
    id: 'school-1',
    name: 'School',
    timeZone: 'UTC',
    timetableMinPeriodGapSameSubject: 1,
  } satisfies SchoolInput)
  const academicYear = new AcademicYear({
    id: 'year-1',
    schoolId: school.id,
    name: '2026',
    startDate: weekStart,
    endDate: weekEnd,
    isActive: true,
  })
  const grade = new GradeLevel({ id: 'grade-1', schoolId: school.id, name: 'Grade 1', order: 1 })
  const groups = [
    new ClassGroup({ id: 'class-1', schoolId: school.id, academicYearId: academicYear.id, gradeLevelId: grade.id, name: 'A' }),
    new ClassGroup({ id: 'class-2', schoolId: school.id, academicYearId: academicYear.id, gradeLevelId: grade.id, name: 'B' }),
  ]
  const subject = new Subject({
    id: 'subject-1',
    schoolId: school.id,
    name: 'Mathematics',
    category: SubjectCategory.Scientific,
    color: SubjectColor.Mint,
  })
  const classSubjects = groups.map((group, index) => new ClassSubject({
    id: `class-subject-${index + 1}`,
    classGroupId: group.id,
    subjectId: subject.id,
    periodsPerWeek: 2,
  }))
  const assignments = classSubjects.map((classSubject, index) => new TeacherAssignment({
    id: `assignment-${index + 1}`,
    teacherId: 'teacher-shared',
    academicYearId: academicYear.id,
    kind: TeacherAssignmentKind.Subject,
    classSubjectId: classSubject.id,
  }))
  const periods = weekdays.map(day => period(day))
  const sessions = new Map<string, LessonSession>()

  const repositories = {
    schools: { findById: async () => school },
    academicYears: { findById: async () => academicYear },
    gradeLevels: { findByIds: async () => [grade] },
    classGroups: {
      findById: async (id: string) => groups.find(group => group.id === id),
      list: async () => groups,
    },
    classSubjects: {
      list: async (filter: { classGroupId?: string } = {}) => classSubjects.filter(item => !filter.classGroupId || item.classGroupId === filter.classGroupId),
    },
    subjects: { findByIds: async () => [subject] },
    teacherAssignments: { list: async () => assignments },
    periodDefinitions: { list: async () => periods },
    calendarEvents: { list: async () => [] },
    lessonSessions: {
      findById: async (id: string) => sessions.get(id),
      list: async (filter: { classGroupId?: string, classSubjectId?: { $in?: string[] } } = {}) => [...sessions.values()].filter(session =>
        (!filter.classGroupId || session.classGroupId === filter.classGroupId)
        && (!filter.classSubjectId?.$in || filter.classSubjectId.$in.includes(session.classSubjectId))),
      save: async (session: LessonSession) => { sessions.set(session.id, session) },
      delete: async (id: string) => { sessions.delete(id) },
    },
    activitySessions: { list: async () => [] },
    assessments: { list: async () => [] },
  } as unknown as SchoolRepositories
  const atomicExecution: AtomicExecutionPort = { execute: operation => operation() }
  const authorizationPolicy = {
    checkClassGroupAccess: async () => {},
  } as unknown as AuthorizationPolicy
  const service = new SchoolService({
    actor: createElevatedTestStaffActor(school.id, 'staff-1'),
    repositories,
    authorizationPolicy,
    atomicExecution,
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })
  return { service, sessions }
}

describe('timetable generation workflow', () => {
  test('generates sequential school drafts without double-booking a shared teacher', async () => {
    const { service } = createWorkflowContext()
    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.classGroups).toHaveLength(2)
    const startsAt = result.classGroups.flatMap(group => group.sessions.map(session => session.startsAt.toISOString()))
    expect(new Set(startsAt).size).toBe(4)
    expect(result.classGroups.flatMap(group => group.sessions).every(session => session.timetableGenerated === TimetableGenerated.Draft)).toBe(true)
  })

  test('publishes and atomically republishes while preserving completed and standalone sessions', async () => {
    const { service, sessions } = createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    const publication = await service.timetableGenerationWorkflow.publishClassGroupTimetable({
      classGroupId: 'class-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    expect(publication.publishedSessionIds).toHaveLength(2)

    const completed = sessions.get(generated.sessions[0]!.id)!.copyWith({ status: OccurrenceStatus.Completed })
    sessions.set(completed.id, completed)
    const replacedSessionId = generated.sessions[1]!.id
    const standalone = new LessonSession({
      id: 'standalone',
      schoolId: 'school-1',
      classGroupId: 'class-1',
      classSubjectId: 'class-subject-1',
      startsAt: new Date('2026-09-08T08:00:00.000Z'),
      endsAt: new Date('2026-09-08T09:00:00.000Z'),
      displayLabel: 'Manual lesson',
    })
    sessions.set(standalone.id, standalone)

    const republished = await service.timetableGenerationWorkflow.republishClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    expect(sessions.has(completed.id)).toBe(true)
    expect(sessions.has(standalone.id)).toBe(true)
    expect(sessions.has(replacedSessionId)).toBe(false)
    expect(republished.publication.publishedSessionIds).toHaveLength(0)
  })

  test('keeps all drafts on publish fail and publishes conflict-free drafts with skip', async () => {
    const { service, sessions } = createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    const conflicting = new LessonSession({
      id: 'other-class-conflict',
      schoolId: 'school-1',
      classGroupId: 'class-2',
      classSubjectId: 'class-subject-2',
      startsAt: generated.sessions[0]!.startsAt,
      endsAt: generated.sessions[0]!.endsAt,
      displayLabel: 'Conflicting lesson',
    })
    sessions.set(conflicting.id, conflicting)

    await expect(service.timetableGenerationWorkflow.publishClassGroupTimetable({
      classGroupId: 'class-1',
      startDate: weekStart,
      endDate: weekEnd,
    })).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' })
    expect(generated.sessions.every(session => sessions.get(session.id)?.timetableGenerated === TimetableGenerated.Draft)).toBe(true)

    const skipped = await service.timetableGenerationWorkflow.publishClassGroupTimetable({
      classGroupId: 'class-1',
      startDate: weekStart,
      endDate: weekEnd,
      sessionConflictPolicy: 'skip',
    })
    expect(skipped.skippedSessionIds).toEqual([generated.sessions[0]!.id])
    expect(skipped.publishedSessionIds).toEqual([generated.sessions[1]!.id])
  })
})
