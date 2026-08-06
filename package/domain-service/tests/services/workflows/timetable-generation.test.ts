import type { AuthorizationPolicy } from '@edaya/authorization'
import type { AtomicExecutionPort, SchoolInput } from '@edaya/core'
import type { SchoolRepositories } from '@edaya/service'
import type { ResolvedTimetableCell, TimetableGenerationDefaults, TimetablePlacement, TimetableSubjectDemand } from '../../../src/services/workflows/timetable-generation'
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
  StaffMember,
  Subject,
  SubjectCategory,
  SubjectColor,
  Teacher,
  TeacherAssignment,
  TeacherAssignmentKind,
  TeacherUnavailability,
  TeacherUnavailabilityRecurrence,
  TimetableGenerated,
  TimetableGenerationMode,
} from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { resolveTimetableSpace, resolveWeeklyTemplateSpace, solveTimetable, spreadWeeklyTemplate, WEEKLY_TEMPLATE_WEEK_KEY } from '../../../src/services/workflows/timetable-generation'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'

const weekStart = new Date('2026-09-07T00:00:00.000Z')
const weekEnd = new Date('2026-09-11T00:00:00.000Z')
const weekdays = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]

function solverOptions(overrides: Partial<TimetableGenerationDefaults> = {}): TimetableGenerationDefaults {
  return {
    generationMode: TimetableGenerationMode.Free,
    enforceWorkloadFulfillment: false,
    excludeBreakSlots: true,
    minDayGapSameSubject: 1,
    preferredPeriodDefinitionIds: [],
    allowUnassignedTeacherPlacements: false,
    useHomeroomTeacherFallback: false,
    defaultMinPeriodSpan: 1,
    defaultMaxPeriodSpan: 1,
    ...overrides,
  }
}

function subjectDemand(
  base: Pick<TimetableSubjectDemand, 'classSubjectId' | 'displayLabel' | 'periodsPerWeek' | 'teacherIds'>
    & Partial<Pick<TimetableSubjectDemand, 'minPeriodSpan' | 'maxPeriodSpan'>>,
): TimetableSubjectDemand {
  return {
    minPeriodSpan: 1,
    maxPeriodSpan: 1,
    ...base,
  }
}

function singlePlacement(
  base: Pick<TimetablePlacement, 'classSubjectId' | 'displayLabel' | 'teacherIds'>,
  cell: ResolvedTimetableCell,
): TimetablePlacement {
  return {
    ...base,
    cell,
    span: 1,
    cells: [cell],
  }
}

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

  test('resolves cells on partial closure days when isNonSchoolDay is false', async () => {
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
        list: async () => [period(DayOfWeek.Monday), period(DayOfWeek.Tuesday)],
      },
      calendarEvents: {
        list: async () => [new CalendarEvent({
          id: 'staff-training',
          schoolId: 'school-1',
          academicYearId: 'year-1',
          title: 'Teacher training day',
          startDate: new Date('2026-09-08T12:00:00.000Z'),
          endDate: new Date('2026-09-08T12:00:00.000Z'),
          kind: CalendarEventKind.Other,
          isNonSchoolDay: false,
          scopeKind: CalendarEventScopeKind.School,
        })],
      },
    } as unknown as SchoolRepositories

    const cells = await resolveTimetableSpace(repositories, {
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(cells.map(cell => cell.date)).toEqual(['2026-09-07', '2026-09-08'])
  })

  test('resolves cells for other classes on class-scoped non-school days', async () => {
    const classGroup = new ClassGroup({
      id: 'class-2',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 2',
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
        list: async () => [period(DayOfWeek.Monday), period(DayOfWeek.Tuesday)],
      },
      calendarEvents: {
        list: async () => [new CalendarEvent({
          id: 'closure-1',
          schoolId: 'school-1',
          academicYearId: 'year-1',
          title: 'Tuesday closure',
          startDate: new Date('2026-09-08T12:00:00.000Z'),
          endDate: new Date('2026-09-08T12:00:00.000Z'),
          kind: CalendarEventKind.Holiday,
          isNonSchoolDay: true,
          scopeKind: CalendarEventScopeKind.ClassGroup,
          scopeId: 'class-1',
        })],
      },
    } as unknown as SchoolRepositories

    const cells = await resolveTimetableSpace(repositories, {
      classGroupId: 'class-2',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(cells.map(cell => cell.date)).toEqual(['2026-09-07', '2026-09-08'])
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
      subjects: [subjectDemand({ classSubjectId: 'subject-1', displayLabel: 'Math', periodsPerWeek: 3, teacherIds: ['teacher-1', 'teacher-2'] })],
      occupiedIntervals: [{
        layer: 'teacher',
        layerKey: 'teacher-2',
        startsAt: cells[0]!.startsAt,
        endsAt: cells[0]!.endsAt,
      }],
      options: solverOptions({
        preferredPeriodDefinitionIds: [cells[2]!.periodDefinitionId],
      }),
    })

    expect(result.placements.map(item => item.cell.periodDefinitionId)).toEqual([
      cells[2]!.periodDefinitionId,
      cells[1]!.periodDefinitionId,
    ])
    expect(result.unmetWorkloads).toEqual([{ classSubjectId: 'subject-1', weekKey: '2026-09-07', required: 3, placed: 2 }])
  })

  test('cannot place four same-subject periods in a short week when min gap is too large', () => {
    const cells = Array.from({ length: 16 }, (_, index) => ({
      date: `2025-12-${index < 8 ? 18 : 19}`,
      weekKey: '2025-12-15',
      weeklyIndex: index,
      periodDefinitionId: `period-${index}`,
      startsAt: new Date(Date.UTC(2025, 11, index < 8 ? 18 : 19, 8 + (index % 8))),
      endsAt: new Date(Date.UTC(2025, 11, index < 8 ? 18 : 19, 9 + (index % 8))),
    }))

    expect(() => solveTimetable({
      classGroupId: 'class-1',
      cells,
      subjects: [subjectDemand({ classSubjectId: 'ci-cs-6a-fr', displayLabel: 'Français', periodsPerWeek: 4, teacherIds: ['ci-t3'] })],
      occupiedIntervals: [],
      options: solverOptions({
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: true,
        minDayGapSameSubject: 8,
      }),
    })).toThrow('Could not place 1/4 periods for class subject ci-cs-6a-fr in week 2025-12-15')
  })

  test('places four same-subject periods in a full teaching week with day gap 1', () => {
    const cells = Array.from({ length: 40 }, (_, index) => ({
      date: `2026-01-${String(5 + Math.floor(index / 8)).padStart(2, '0')}`,
      weekKey: '2026-01-05',
      weeklyIndex: index,
      periodDefinitionId: `period-${index}`,
      startsAt: new Date(Date.UTC(2026, 0, 5 + Math.floor(index / 8), 7 + (index % 8))),
      endsAt: new Date(Date.UTC(2026, 0, 5 + Math.floor(index / 8), 8 + (index % 8))),
    }))

    const result = solveTimetable({
      classGroupId: 'class-1',
      cells,
      subjects: [subjectDemand({ classSubjectId: 'ci-cs-6a-fr', displayLabel: 'Français', periodsPerWeek: 4, teacherIds: ['ci-t3'] })],
      occupiedIntervals: [],
      options: solverOptions({
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: true,
      }),
    })

    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements).toHaveLength(4)
  })

  test('enforces same-subject day gap across calendar weeks', () => {
    const cells = [
      {
        date: '2026-01-05',
        weekKey: '2026-01-05',
        weeklyIndex: 0,
        periodDefinitionId: 'period-w1',
        startsAt: new Date(Date.UTC(2026, 0, 5, 8)),
        endsAt: new Date(Date.UTC(2026, 0, 5, 9)),
      },
      {
        date: '2026-01-12',
        weekKey: '2026-01-12',
        weeklyIndex: 0,
        periodDefinitionId: 'period-w2',
        startsAt: new Date(Date.UTC(2026, 0, 12, 8)),
        endsAt: new Date(Date.UTC(2026, 0, 12, 9)),
      },
    ]

    const result = solveTimetable({
      classGroupId: 'class-1',
      cells,
      subjects: [subjectDemand({ classSubjectId: 'subject-fr', displayLabel: 'Français', periodsPerWeek: 1, teacherIds: ['teacher-1'] })],
      occupiedIntervals: [],
      options: {
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: false,
        excludeBreakSlots: true,
        minDayGapSameSubject: 8,
        preferredPeriodDefinitionIds: [],
        allowUnassignedTeacherPlacements: false,
        useHomeroomTeacherFallback: false,
        defaultMinPeriodSpan: 1,
        defaultMaxPeriodSpan: 1,
      },
    })

    expect(result.placements).toHaveLength(1)
    expect(result.placements[0]?.cell.date).toBe('2026-01-05')
    expect(result.unmetWorkloads).toEqual([{
      classSubjectId: 'subject-fr',
      weekKey: '2026-01-12',
      required: 1,
      placed: 0,
    }])
  })

  test('allows two same-subject lessons on one day when day gap is zero', () => {
    const cells = [
      {
        date: '2026-01-05',
        weekKey: '2026-01-05',
        weeklyIndex: 0,
        periodDefinitionId: 'period-am',
        startsAt: new Date(Date.UTC(2026, 0, 5, 8)),
        endsAt: new Date(Date.UTC(2026, 0, 5, 9)),
      },
      {
        date: '2026-01-05',
        weekKey: '2026-01-05',
        weeklyIndex: 1,
        periodDefinitionId: 'period-pm',
        startsAt: new Date(Date.UTC(2026, 0, 5, 13)),
        endsAt: new Date(Date.UTC(2026, 0, 5, 14)),
      },
    ]

    const result = solveTimetable({
      classGroupId: 'class-1',
      cells,
      subjects: [subjectDemand({ classSubjectId: 'subject-fr', displayLabel: 'Français', periodsPerWeek: 2, teacherIds: ['teacher-1'] })],
      occupiedIntervals: [],
      options: {
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: true,
        excludeBreakSlots: true,
        minDayGapSameSubject: 0,
        preferredPeriodDefinitionIds: [],
        allowUnassignedTeacherPlacements: false,
        useHomeroomTeacherFallback: false,
        defaultMinPeriodSpan: 1,
        defaultMaxPeriodSpan: 1,
      },
    })

    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements).toHaveLength(2)
    expect(new Set(result.placements.map(placement => placement.cell.date))).toEqual(new Set(['2026-01-05']))
  })

  test('blocks a second same-subject lesson on the same day when day gap is one', () => {
    const cells = [
      {
        date: '2026-01-05',
        weekKey: '2026-01-05',
        weeklyIndex: 0,
        periodDefinitionId: 'period-am',
        startsAt: new Date(Date.UTC(2026, 0, 5, 8)),
        endsAt: new Date(Date.UTC(2026, 0, 5, 9)),
      },
      {
        date: '2026-01-05',
        weekKey: '2026-01-05',
        weeklyIndex: 1,
        periodDefinitionId: 'period-pm',
        startsAt: new Date(Date.UTC(2026, 0, 5, 13)),
        endsAt: new Date(Date.UTC(2026, 0, 5, 14)),
      },
      {
        date: '2026-01-06',
        weekKey: '2026-01-05',
        weeklyIndex: 2,
        periodDefinitionId: 'period-tue',
        startsAt: new Date(Date.UTC(2026, 0, 6, 8)),
        endsAt: new Date(Date.UTC(2026, 0, 6, 9)),
      },
    ]

    const result = solveTimetable({
      classGroupId: 'class-1',
      cells,
      subjects: [subjectDemand({ classSubjectId: 'subject-fr', displayLabel: 'Français', periodsPerWeek: 2, teacherIds: ['teacher-1'] })],
      occupiedIntervals: [],
      options: {
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: true,
        excludeBreakSlots: true,
        minDayGapSameSubject: 1,
        preferredPeriodDefinitionIds: [],
        allowUnassignedTeacherPlacements: false,
        useHomeroomTeacherFallback: false,
        defaultMinPeriodSpan: 1,
        defaultMaxPeriodSpan: 1,
      },
    })

    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements.map(placement => placement.cell.date)).toEqual(['2026-01-05', '2026-01-06'])
  })

  test('resolves a logical weekly template grid without calendar closures', async () => {
    const classGroup = new ClassGroup({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 1',
    })
    const repositories = {
      periodDefinitions: {
        list: async () => [period(DayOfWeek.Monday), period(DayOfWeek.Tuesday), period(DayOfWeek.Wednesday, '-disabled')],
      },
    } as unknown as SchoolRepositories

    const cells = await resolveWeeklyTemplateSpace(repositories, 'year-1')

    expect(cells).toHaveLength(2)
    expect(cells.every(cell => cell.weekKey === WEEKLY_TEMPLATE_WEEK_KEY)).toBe(true)
    expect(cells.map(cell => cell.date)).toEqual(['2026-01-05', '2026-01-06'])
    expect(classGroup.id).toBe('class-1')
  })

  test('places double-period blocks when maxPeriodSpan is 2', () => {
    const mondayCells = Array.from({ length: 2 }, (_, index) => ({
      date: '2026-09-07',
      weekKey: '2026-09-07',
      weeklyIndex: index,
      periodDefinitionId: `monday-p${index}`,
      startsAt: new Date(Date.UTC(2026, 8, 7, 8 + index)),
      endsAt: new Date(Date.UTC(2026, 8, 7, 9 + index)),
    }))
    const tuesdayCells = Array.from({ length: 2 }, (_, index) => ({
      date: '2026-09-08',
      weekKey: '2026-09-07',
      weeklyIndex: index + 2,
      periodDefinitionId: `tuesday-p${index}`,
      startsAt: new Date(Date.UTC(2026, 8, 8, 8 + index)),
      endsAt: new Date(Date.UTC(2026, 8, 8, 9 + index)),
    }))
    const result = solveTimetable({
      classGroupId: 'class-1',
      cells: [...mondayCells, ...tuesdayCells],
      subjects: [subjectDemand({
        classSubjectId: 'subject-math',
        displayLabel: 'Math',
        periodsPerWeek: 4,
        minPeriodSpan: 1,
        maxPeriodSpan: 2,
        teacherIds: ['teacher-1'],
      })],
      occupiedIntervals: [],
      options: solverOptions({
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: true,
      }),
    })

    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements).toHaveLength(2)
    expect(result.placements.map(placement => placement.span)).toEqual([2, 2])
    expect(result.placements.flatMap(placement => placement.cells.map(cell => cell.date))).toEqual([
      '2026-09-07',
      '2026-09-07',
      '2026-09-08',
      '2026-09-08',
    ])
  })

  test('prefers non-overlapping double blocks when a preferred middle double would block completion', () => {
    const mondayCells = Array.from({ length: 4 }, (_, index) => ({
      date: '2026-09-07',
      weekKey: '2026-09-07',
      weeklyIndex: index,
      periodDefinitionId: index === 1 ? 'preferred-period' : `monday-p${index}`,
      startsAt: new Date(Date.UTC(2026, 8, 7, 8 + index)),
      endsAt: new Date(Date.UTC(2026, 8, 7, 9 + index)),
    }))
    const result = solveTimetable({
      classGroupId: 'class-1',
      cells: mondayCells,
      subjects: [subjectDemand({
        classSubjectId: 'subject-math',
        displayLabel: 'Math',
        periodsPerWeek: 4,
        minPeriodSpan: 2,
        maxPeriodSpan: 2,
        teacherIds: ['teacher-1'],
      })],
      occupiedIntervals: [],
      options: solverOptions({
        generationMode: TimetableGenerationMode.Free,
        enforceWorkloadFulfillment: true,
        minDayGapSameSubject: 0,
        preferredPeriodDefinitionIds: ['preferred-period'],
      }),
    })

    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements).toHaveLength(2)
    expect(result.placements.map(placement => placement.span)).toEqual([2, 2])
    expect(result.placements.map(placement => placement.cell.periodDefinitionId)).toEqual([
      'monday-p0',
      'monday-p2',
    ])
  })

  test('spreads a weekly template across calendar weeks and drops closure days', () => {
    const templateCell = {
      date: '2026-01-05',
      weekKey: WEEKLY_TEMPLATE_WEEK_KEY,
      weeklyIndex: 0,
      periodDefinitionId: 'period-Monday',
      startsAt: new Date(Date.UTC(2026, 0, 5, 8)),
      endsAt: new Date(Date.UTC(2026, 0, 5, 9)),
    }
    const templatePlacements = [singlePlacement({
      classSubjectId: 'subject-1',
      displayLabel: 'Math',
      teacherIds: ['teacher-1'],
    }, templateCell)]
    const spread = spreadWeeklyTemplate({
      classGroupId: 'class-1',
      templatePlacements,
      periodById: new Map([['period-Monday', period(DayOfWeek.Monday)]]),
      startDate: new Date('2026-09-07T00:00:00.000Z'),
      endDate: new Date('2026-09-18T00:00:00.000Z'),
      nonSchoolDates: new Set(['2026-09-14']),
      occupiedIntervals: [],
      subjects: [subjectDemand({ classSubjectId: 'subject-1', displayLabel: 'Math', periodsPerWeek: 1, teacherIds: ['teacher-1'] })],
      options: solverOptions({
        generationMode: TimetableGenerationMode.Weekly,
      }),
    })

    expect(spread.placements.map(placement => placement.cell.date)).toEqual(['2026-09-07'])
    expect(spread.unmetWorkloads).toEqual([{
      classSubjectId: 'subject-1',
      weekKey: '2026-09-14',
      required: 1,
      placed: 0,
    }])
  })

  test('does not report unmet workload for weeks with no teaching days', () => {
    const templateCell = {
      date: '2026-01-05',
      weekKey: WEEKLY_TEMPLATE_WEEK_KEY,
      weeklyIndex: 0,
      periodDefinitionId: 'period-Monday',
      startsAt: new Date(Date.UTC(2026, 0, 5, 8)),
      endsAt: new Date(Date.UTC(2026, 0, 5, 9)),
    }
    const spread = spreadWeeklyTemplate({
      classGroupId: 'class-1',
      templatePlacements: [singlePlacement({
        classSubjectId: 'subject-1',
        displayLabel: 'Math',
        teacherIds: ['teacher-1'],
      }, templateCell)],
      periodById: new Map([['period-Monday', period(DayOfWeek.Monday)]]),
      startDate: new Date('2025-10-20T00:00:00.000Z'),
      endDate: new Date('2025-10-24T00:00:00.000Z'),
      nonSchoolDates: new Set(['2025-10-20', '2025-10-21', '2025-10-22', '2025-10-23', '2025-10-24']),
      occupiedIntervals: [],
      subjects: [subjectDemand({ classSubjectId: 'subject-1', displayLabel: 'Math', periodsPerWeek: 4, teacherIds: ['teacher-1'] })],
      options: solverOptions({
        generationMode: TimetableGenerationMode.Weekly,
        enforceWorkloadFulfillment: true,
      }),
    })

    expect(spread.placements).toEqual([])
    expect(spread.unmetWorkloads).toEqual([])
  })
})

function createWorkflowContext(
  unavailabilities: TeacherUnavailability[] = [],
  config: { unassignedFirstSubject?: boolean, homeroomTeacherLinked?: boolean, omitPeriodsPerWeek?: boolean } = {},
  calendarEvents: CalendarEvent[] = [],
  academicYearRange?: { startDate: Date, endDate: Date },
) {
  const school = new School({
    id: 'school-1',
    name: 'School',
    timeZone: 'UTC',
    timetableMinDayGapSameSubject: 1,
  } satisfies SchoolInput)
  const academicYear = new AcademicYear({
    id: 'year-1',
    schoolId: school.id,
    name: '2026',
    startDate: academicYearRange?.startDate ?? weekStart,
    endDate: academicYearRange?.endDate ?? weekEnd,
    isActive: true,
  })
  const grade = new GradeLevel({ id: 'grade-1', schoolId: school.id, name: 'Grade 1', order: 1 })
  const groups = [
    new ClassGroup({
      id: 'class-1',
      schoolId: school.id,
      academicYearId: academicYear.id,
      gradeLevelId: grade.id,
      name: 'A',
      homeroomStaffId: config.homeroomTeacherLinked ? 'staff-homeroom' : undefined,
    }),
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
    ...(config.omitPeriodsPerWeek
      ? { coefficient: 2 }
      : { periodsPerWeek: 2 }),
  }))
  const assignments = classSubjects
    .filter((_, index) => !(config.unassignedFirstSubject && index === 0))
    .map((classSubject, index) => new TeacherAssignment({
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
    gradeLevelSubjects: { findByIds: async () => [] },
    teacherAssignments: { list: async () => assignments },
    teacherUnavailabilities: { list: async () => unavailabilities },
    staffMembers: {
      findById: async (id: string) => id === 'staff-homeroom'
        ? new StaffMember({ id, schoolId: school.id, firstName: 'Home', lastName: 'Room', subjectId: 'account-homeroom' })
        : undefined,
    },
    teachers: {
      findOne: async (filter: { subjectId?: string }) => filter.subjectId === 'account-homeroom'
        ? new Teacher({ id: 'teacher-homeroom', schoolId: school.id, firstName: 'Home', lastName: 'Room', subjectId: 'account-homeroom' })
        : undefined,
    },
    periodDefinitions: { list: async () => periods },
    calendarEvents: { list: async () => calendarEvents },
    lessonSessions: {
      findById: async (id: string) => sessions.get(id),
      list: async (filter: {
        classGroupId?: string
        classSubjectId?: { $in?: string[] }
        startsAt?: { $lt?: Date, $gte?: Date, $lte?: Date }
        endsAt?: { $gt?: Date }
      } = {}) => [...sessions.values()].filter(session =>
        (!filter.classGroupId || session.classGroupId === filter.classGroupId)
        && (!filter.classSubjectId?.$in || filter.classSubjectId.$in.includes(session.classSubjectId))
        && (!filter.startsAt?.$lt || session.startsAt < filter.startsAt.$lt)
        && (!filter.startsAt?.$gte || session.startsAt >= filter.startsAt.$gte)
        && (!filter.startsAt?.$lte || session.startsAt <= filter.startsAt.$lte)
        && (!filter.endsAt?.$gt || session.endsAt > filter.endsAt.$gt)),
      save: async (session: LessonSession) => { sessions.set(session.id, session) },
      delete: async (id: string) => { sessions.delete(id) },
      batchSave: async (entities: LessonSession[]) => {
        for (const session of entities) {
          sessions.set(session.id, session)
        }
        return entities.map(session => session.id)
      },
      batchDelete: async (ids: string[]) => {
        for (const id of ids) {
          sessions.delete(id)
        }
      },
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
  test('fails strictly when a class subject has no teacher', async () => {
    const { service } = createWorkflowContext([], { unassignedFirstSubject: true })
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })).rejects.toMatchObject({ code: 'TIMETABLE_TEACHER_ASSIGNMENT_REQUIRED' })
  })

  test('allows unassigned placements without teacher occupancy when configured', async () => {
    const { service } = createWorkflowContext([], { unassignedFirstSubject: true })
    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { allowUnassignedTeacherPlacements: true },
    })
    expect(result.placements.every(placement => placement.teacherIds.length === 0)).toBe(true)
    expect(result.sessions.every(session => session.timetableTeacherIds.length === 0)).toBe(true)
  })

  test('uses and persists the linked homeroom teacher fallback', async () => {
    const { service } = createWorkflowContext([], { unassignedFirstSubject: true, homeroomTeacherLinked: true })
    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { useHomeroomTeacherFallback: true },
    })
    expect(result.placements.every(placement => placement.teacherIds.includes('teacher-homeroom'))).toBe(true)
    expect(result.sessions.every(session => session.timetableTeacherIds.includes('teacher-homeroom'))).toBe(true)
  })

  test('generates sequential school drafts without double-booking a shared teacher', async () => {
    const { service } = createWorkflowContext()
    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.classGroups).toHaveLength(2)
    expect(result.skippedClassGroupIds).toEqual([])
    const startsAt = result.classGroups.flatMap(group => group.sessions.map(session => session.startsAt.toISOString()))
    expect(new Set(startsAt).size).toBe(4)
    expect(result.classGroups.flatMap(group => group.sessions).every(session => session.timetableGenerated === TimetableGenerated.Draft)).toBe(true)
  })

  test('skips school-wide and class-scoped non-school days when generating weekly drafts', async () => {
    const calendarEvents = [
      new CalendarEvent({
        id: 'school-holiday',
        schoolId: 'school-1',
        academicYearId: 'year-1',
        title: 'School holiday',
        startDate: new Date('2026-09-08T12:00:00.000Z'),
        endDate: new Date('2026-09-08T12:00:00.000Z'),
        kind: CalendarEventKind.Holiday,
        isNonSchoolDay: true,
        scopeKind: CalendarEventScopeKind.School,
      }),
      new CalendarEvent({
        id: 'class-closure',
        schoolId: 'school-1',
        academicYearId: 'year-1',
        title: 'Class closure',
        startDate: new Date('2026-09-09T12:00:00.000Z'),
        endDate: new Date('2026-09-09T12:00:00.000Z'),
        kind: CalendarEventKind.Holiday,
        isNonSchoolDay: true,
        scopeKind: CalendarEventScopeKind.ClassGroup,
        scopeId: 'class-1',
      }),
    ]
    const { service } = createWorkflowContext([], {}, calendarEvents)

    const classOne = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: false },
    })

    const classOneDates = classOne.sessions.map(session => session.startsAt.toISOString().slice(0, 10))
    expect(classOneDates.length).toBeGreaterThan(0)
    expect(classOneDates).not.toContain('2026-09-08')
    expect(classOneDates).not.toContain('2026-09-09')
  })

  test('does not place lessons in a recurring teacher-unavailable slot', async () => {
    const { service } = createWorkflowContext([new TeacherUnavailability({
      id: 'monday-contract-hours',
      teacherId: 'teacher-shared',
      academicYearId: 'year-1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '08:30',
      endTime: '09:30',
      effectiveFrom: weekStart,
      effectiveUntil: weekEnd,
    })])
    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: false },
    })

    expect(result.sessions.every(session => session.startsAt.toISOString() !== '2026-09-07T08:00:00.000Z')).toBe(true)
  })

  test('publishes and atomically republishes while preserving completed and standalone sessions', async () => {
    const { service, sessions } = createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: false },
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
      options: { enforceWorkloadFulfillment: false },
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

  test('regenerates class timetables by discarding existing drafts and published sessions in range', async () => {
    const { service, sessions } = createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    await service.timetableGenerationWorkflow.publishClassGroupTimetable({
      classGroupId: 'class-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    const publishedIds = generated.sessions.map(session => session.id)

    const regenerated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(regenerated.sessions).toHaveLength(2)
    expect(publishedIds.every(sessionId => !sessions.has(sessionId))).toBe(true)
    expect(regenerated.sessions.every(session => session.timetableGenerated === TimetableGenerated.Draft)).toBe(true)
  })

  test('regenerates class drafts by discarding existing drafts in range', async () => {
    const { service, sessions } = createWorkflowContext()
    const first = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    expect(first.sessions).toHaveLength(2)

    const second = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(second.sessions).toHaveLength(2)
    expect(first.sessions.every(session => !sessions.has(session.id))).toBe(true)
    expect(second.sessions.every(session => session.timetableGenerated === TimetableGenerated.Draft)).toBe(true)
  })

  test('derives periodsPerWeek from coefficient when class subject workload is unset', async () => {
    const { service } = createWorkflowContext([], { omitPeriodsPerWeek: true })
    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.sessions).toHaveLength(3)
  })

  test('blocks single-class generation when a shared teacher is occupied in another class', async () => {
    const { service, sessions } = createWorkflowContext()
    const otherClassLesson = new LessonSession({
      id: 'other-class-lesson',
      schoolId: 'school-1',
      classGroupId: 'class-2',
      classSubjectId: 'class-subject-2',
      startsAt: new Date('2026-09-07T08:00:00.000Z'),
      endsAt: new Date('2026-09-07T09:00:00.000Z'),
      displayLabel: 'Existing lesson',
    })
    sessions.set(otherClassLesson.id, otherClassLesson)

    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: false },
    })

    expect(result.sessions.every(session => session.startsAt.toISOString() !== '2026-09-07T08:00:00.000Z')).toBe(true)
    expect(result.unmetWorkloads.length).toBeGreaterThan(0)
  })

  test('persists resolved teacher snapshots when publishing drafts without stored teacher ids', async () => {
    const { service, sessions } = createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    for (const session of generated.sessions) {
      sessions.set(session.id, session.copyWith({ timetableTeacherIds: [] }))
    }

    await service.timetableGenerationWorkflow.publishClassGroupTimetable({
      classGroupId: 'class-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    for (const session of generated.sessions) {
      expect(sessions.get(session.id)?.timetableTeacherIds).toEqual(['teacher-shared'])
      expect(sessions.get(session.id)?.timetableGenerated).toBe(TimetableGenerated.Published)
    }
  })

  test('regenerates published class timetables during school generation', async () => {
    const { service } = createWorkflowContext()
    await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    await service.timetableGenerationWorkflow.publishClassGroupTimetable({
      classGroupId: 'class-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.skippedClassGroupIds).toEqual([])
    expect(result.classGroups).toHaveLength(2)
    expect(result.classGroups.every(classGroup => classGroup.sessions.every(session => session.timetableGenerated === TimetableGenerated.Draft))).toBe(true)
  })

  test('regenerates school drafts for classes without published timetables', async () => {
    const { service } = createWorkflowContext()
    await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.skippedClassGroupIds).toEqual([])
    expect(result.classGroups).toHaveLength(2)
  })

  test('regenerates all class groups during school generation even when timetables were published', async () => {
    const { service } = createWorkflowContext()
    await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    for (const classGroupId of ['class-1', 'class-2']) {
      await service.timetableGenerationWorkflow.publishClassGroupTimetable({
        classGroupId,
        startDate: weekStart,
        endDate: weekEnd,
      })
    }

    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.skippedClassGroupIds).toEqual([])
    expect(result.classGroups).toHaveLength(2)
    expect(result.classGroups.every(classGroup => classGroup.sessions.every(session => session.timetableGenerated === TimetableGenerated.Draft))).toBe(true)
  })
})
