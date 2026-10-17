/* eslint-disable dot-notation -- Document facts use an index signature. */
import type { SchoolInput } from '@edaya/core'
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
  OccurrenceStatus,
  PeriodDefinition,
  Permission,
  School,
  StaffPermissionAssignment,
  Subject,
  SubjectCategory,
  SubjectColor,
  Teacher,
  TeacherAssignment,
  TeacherAssignmentKind,
  TeacherUnavailability,
  TeacherUnavailabilityRecurrence,
  TimetableGenerationMode,
} from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { BaseSchoolService } from '../../../src/services/base-school-service'
import { resolveTimetableSpace, resolveWeeklyTemplateSpace, solveTimetable, spreadWeeklyTemplate, TimetableGenerationServiceWorkflow, WEEKLY_TEMPLATE_WEEK_KEY } from '../../../src/services/workflows/timetable-generation'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

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
          status: 'published',
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
          status: 'published',
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
          status: 'published',
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
      periodDefinitionId: period(DayOfWeek.Monday).id,
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
      periodById: new Map([[period(DayOfWeek.Monday).id, period(DayOfWeek.Monday)]]),
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
      periodDefinitionId: period(DayOfWeek.Monday).id,
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
      periodById: new Map([[period(DayOfWeek.Monday).id, period(DayOfWeek.Monday)]]),
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

async function createWorkflowContext(
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
    ownerSubjectId: createTestStaffActor('school-1', 'staff-1').subjectId,
  } satisfies SchoolInput)
  const academicYear = new AcademicYear({
    id: 'year-1',
    schoolId: school.id,
    name: '2026',
    startDate: academicYearRange?.startDate ?? weekStart,
    endDate: academicYearRange?.endDate ?? weekEnd,
    status: 'published',
  })
  const grade = new GradeLevel({ id: 'grade-1', schoolId: school.id, name: 'Grade 1', label: 'G1', order: 1 })
  const groups = [
    new ClassGroup({
      id: 'class-1',
      schoolId: school.id,
      academicYearId: academicYear.id,
      gradeLevelId: grade.id,
      name: 'A',
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
  const { app: service, schoolRepositories: repositories } = await createTestApp(createTestStaffActor(school.id, 'staff-1'), { owner: true })
  await repositories.schools.save(school)
  await repositories.academicYears.save(academicYear)
  await repositories.gradeLevels.save(grade)
  await repositories.classGroups.batchSave(groups)
  await repositories.subjects.save(subject)
  await repositories.classSubjects.batchSave(classSubjects)
  await repositories.teachers.save(new Teacher({ id: 'teacher-shared', schoolId: school.id, firstName: 'Subject', lastName: 'Teacher' }))
  await repositories.teacherAssignments.batchSave(assignments)
  if (config.homeroomTeacherLinked) {
    await repositories.teachers.save(new Teacher({ id: 'teacher-homeroom', schoolId: school.id, firstName: 'Homeroom', lastName: 'Teacher' }))
    await repositories.teacherAssignments.save(new TeacherAssignment({ id: 'homeroom', teacherId: 'teacher-homeroom', academicYearId: academicYear.id, kind: TeacherAssignmentKind.Homeroom, classGroupId: 'class-1' }))
  }
  await repositories.teacherUnavailabilities.batchSave(unavailabilities)
  await repositories.periodDefinitions.batchSave(periods)
  await repositories.calendarEvents.batchSave(calendarEvents)
  return { service, sessions: repositories.lessonSessions, repositories }
}

describe('timetable generation workflow', () => {
  for (const generationMode of [TimetableGenerationMode.Weekly, TimetableGenerationMode.Free]) {
    test(`${generationMode} generation reads shared class-request data once`, async () => {
      const { service } = await createWorkflowContext([])
      const base = service.timetableGenerationWorkflow.baseService
      const calls = new Map<string, Array<{ kind?: unknown, [key: string]: unknown }>>()
      const repositories = new Proxy(base.repositories, {
        get(target, resource) {
          const store = Reflect.get(target, resource)
          return new Proxy(store, {
            get(storeTarget, property) {
              const method = Reflect.get(storeTarget, property)
              if (property !== 'list')
                return method
              return (...args: unknown[]) => {
                const entries = calls.get(String(resource)) ?? []
                entries.push((args[0] ?? {}) as Record<string, unknown>)
                calls.set(String(resource), entries)
                return Reflect.apply(method, storeTarget, args)
              }
            },
          })
        },
      })
      const workflow = new TimetableGenerationServiceWorkflow(new BaseSchoolService({ ...base, repositories }))
      await workflow.generateClassGroupTimetable({ classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { generationMode } })
      expect(calls.get('periodDefinitions')).toHaveLength(1)
      expect(calls.get('teacherAssignments')?.filter(query => query.kind === TeacherAssignmentKind.Subject && Object.keys(query).length === 2)).toHaveLength(1)
      expect(calls.get('teacherUnavailabilities')).toHaveLength(1)
      // One read for discard, then one school-wide snapshot after the deletes.
      expect(calls.get('lessonSessions')).toHaveLength(2)
      expect(calls.get('activitySessions')?.[0]).toMatchObject({ classGroupId: 'class-1', startsAt: { $lt: new Date('2026-09-12T00:00:00Z') }, endsAt: { $gt: weekStart } })
    })
  }

  test('a failed later class rolls back its replacement while earlier and unselected classes retain their sessions', async () => {
    const { service, repositories } = await createWorkflowContext([])
    await repositories.classGroups.save(new ClassGroup({ id: 'class-3', schoolId: 'school-1', academicYearId: 'year-1', gradeLevelId: 'grade-1', name: 'C' }))
    const retained = ['class-2', 'class-3'].map(classGroupId => new LessonSession({ id: `old-${classGroupId}`, schoolId: 'school-1', classGroupId, classSubjectId: 'class-subject-2', displayLabel: 'Old generated', startsAt: new Date('2026-09-11T10:00:00Z'), endsAt: new Date('2026-09-11T11:00:00Z'), timetableGenerated: true }))
    await repositories.lessonSessions.batchSave(retained)
    const first = await service.timetableGenerationWorkflow.generateClassGroupTimetable({ classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd })
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable({ classGroupId: 'class-2', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { enforceWorkloadFulfillment: true }, placementParameters: { periodsPerWeekByClassSubjectId: { 'class-subject-2': 100 } } })).rejects.toMatchObject({ code: 'TIMETABLE_WORKLOAD_UNSATISFIED' })
    expect(await repositories.lessonSessions.findByIds([...first.sessions.map(row => row.id), ...retained.map(row => row.id)])).toHaveLength(first.sessions.length + retained.length)
    expect(await repositories.lessonSessions.list({ classGroupId: 'class-2' })).toHaveLength(1)
    expect(await repositories.lessonSessions.list({ classGroupId: 'class-3' })).toHaveLength(1)
  })

  test('fails strictly when a class subject has no teacher', async () => {
    const { service } = await createWorkflowContext([], { unassignedFirstSubject: true })
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })).rejects.toMatchObject({ code: 'TIMETABLE_TEACHER_ASSIGNMENT_REQUIRED' })
  })

  test('allows unassigned placements without teacher occupancy when configured', async () => {
    const { service } = await createWorkflowContext([], { unassignedFirstSubject: true })
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
    const { service } = await createWorkflowContext([], { unassignedFirstSubject: true, homeroomTeacherLinked: true })
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

  test('homeroom fallback loses authority after assignment expiry or profile deactivation', async () => {
    const { service, repositories } = await createWorkflowContext([], { unassignedFirstSubject: true, homeroomTeacherLinked: true })
    const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { useHomeroomTeacherFallback: true } }
    const assignment = (await repositories.teacherAssignments.findById('homeroom'))!
    await repositories.teacherAssignments.save(new TeacherAssignment({ ...assignment.data, endsAt: new Date('2026-09-06') }))
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable(input)).rejects.toMatchObject({ code: 'TIMETABLE_TEACHER_ASSIGNMENT_REQUIRED' })
    await repositories.teacherAssignments.save(assignment)
    const teacher = (await repositories.teachers.findById('teacher-homeroom'))!
    await repositories.teachers.save(new Teacher({ ...teacher.data, isActive: false }))
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable(input)).rejects.toMatchObject({ code: 'TIMETABLE_TEACHER_ASSIGNMENT_REQUIRED' })
    expect(await repositories.lessonSessions.count()).toBe(0)
  })

  test('scoped creation cannot borrow another action to generate unrelated classes', async () => {
    const { service, repositories } = await createWorkflowContext()
    const school = (await repositories.schools.findById('school-1'))!
    await repositories.schools.save(new School({ ...school.data, ownerSubjectId: undefined }))
    for (const [id, permission, classGroupId] of [['create', Permission.TIMETABLE_MANAGE, 'class-1'], ['other-read', Permission.TIMETABLE_READ, 'class-2']] as const)
      await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id, staffId: 'staff-1', schoolId: 'school-1', academicYearId: 'year-1', permission, scopes: [{ kind: 'class_group', classGroupId }] }))
    const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd }
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
    expect(generated.sessions.length).toBeGreaterThan(0)
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable({ ...input, classGroupId: 'class-2' })).rejects.toThrow()
    expect((await repositories.lessonSessions.list()).every(session => session.classGroupId === 'class-1' && session.timetableGenerated === true)).toBe(true)
    await repositories.staffPermissionAssignments.delete('create')
    await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable(input)).rejects.toThrow()
    expect(await repositories.lessonSessions.count()).toBe(generated.sessions.length)
  })

  test('both generation modes reject an existing class in another school without replacing its timetable', async () => {
    const { service, repositories } = await createWorkflowContext()
    await repositories.schools.save(new School({ id: 'foreign-school', name: 'Other school', timeZone: 'UTC' }))
    await repositories.academicYears.save(new AcademicYear({ id: 'foreign-year', schoolId: 'foreign-school', name: '2026', startDate: weekStart, endDate: weekEnd, status: 'published' }))
    await repositories.gradeLevels.save(new GradeLevel({ id: 'foreign-grade', schoolId: 'foreign-school', name: 'Grade 1', label: 'G1', order: 1 }))
    await repositories.classGroups.save(new ClassGroup({ id: 'foreign-class', schoolId: 'foreign-school', academicYearId: 'foreign-year', gradeLevelId: 'foreign-grade', name: 'Other class' }))
    await repositories.subjects.save(new Subject({ id: 'foreign-subject', schoolId: 'foreign-school', name: 'Mathematics', category: SubjectCategory.Scientific, color: SubjectColor.Mint }))
    await repositories.classSubjects.save(new ClassSubject({ id: 'foreign-class-subject', classGroupId: 'foreign-class', subjectId: 'foreign-subject', periodsPerWeek: 1 }))
    const existing = new LessonSession({ id: 'foreign-generated', schoolId: 'foreign-school', classGroupId: 'foreign-class', classSubjectId: 'foreign-class-subject', displayLabel: 'Existing generated', startsAt: new Date('2026-09-07T08:00:00Z'), endsAt: new Date('2026-09-07T09:00:00Z'), timetableGenerated: true })
    await repositories.lessonSessions.save(existing)
    for (const generationMode of [TimetableGenerationMode.Weekly, TimetableGenerationMode.Free]) {
      await expect(service.timetableGenerationWorkflow.generateClassGroupTimetable({ classGroupId: 'foreign-class', academicYearId: 'foreign-year', startDate: weekStart, endDate: weekEnd, options: { generationMode } })).rejects.toThrow()
      expect((await repositories.lessonSessions.findById(existing.id))?.data).toEqual(existing.data)
    }
    expect(await repositories.lessonSessions.count()).toBe(1)
  })

  test('generates sequential school sessions without double-booking a shared teacher', async () => {
    const { service } = await createWorkflowContext()
    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.classGroups).toHaveLength(2)
    expect(result.skippedClassGroupIds).toEqual([])
    const startsAt = result.classGroups.flatMap(group => group.sessions.map(session => session.startsAt.toISOString()))
    expect(new Set(startsAt).size).toBe(4)
    expect(result.classGroups.flatMap(group => group.sessions).every(session => session.timetableGenerated === true)).toBe(true)
  })

  test('skips school-wide and class-scoped non-school days when generating weekly sessions', async () => {
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
    const { service } = await createWorkflowContext([], {}, calendarEvents)

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
    const { service } = await createWorkflowContext([new TeacherUnavailability({
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

  test('regenerates atomically while preserving completed and standalone sessions', async () => {
    const { service, sessions } = await createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: false },
    })
    expect(generated.sessions.every(session => session.timetableGenerated)).toBe(true)

    const completed = (await sessions.findById(generated.sessions[0]!.id))!.copyWith({ status: OccurrenceStatus.Completed })
    await sessions.save(completed)
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
    await sessions.save(standalone)

    const republished = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: false },
    })
    expect(await sessions.findById(completed.id)).toBeDefined()
    expect(await sessions.findById(standalone.id)).toBeDefined()
    expect(await sessions.findById(replacedSessionId)).toBeUndefined()
    expect(republished.sessions).toHaveLength(0)
  })

  test('regenerates class timetables by discarding existing sessions and generated sessions in range', async () => {
    const { service, sessions } = await createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
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
    expect(await sessions.findByIds(publishedIds)).toEqual([])
    expect(regenerated.sessions.every(session => session.timetableGenerated === true)).toBe(true)
  })

  test('regenerates class sessions by discarding existing sessions in range', async () => {
    const { service, sessions } = await createWorkflowContext()
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
    expect(await sessions.findByIds(first.sessions.map(session => session.id))).toEqual([])
    expect(second.sessions.every(session => session.timetableGenerated === true)).toBe(true)
  })

  test('derives periodsPerWeek from coefficient when class subject workload is unset', async () => {
    const { service } = await createWorkflowContext([], { omitPeriodsPerWeek: true })
    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    expect(result.sessions).toHaveLength(3)
  })

  test('repairs single-class generation around a shared teacher occupied in another class', async () => {
    const { service, sessions } = await createWorkflowContext()
    const otherClassLesson = new LessonSession({
      id: 'other-class-lesson',
      schoolId: 'school-1',
      classGroupId: 'class-2',
      classSubjectId: 'class-subject-2',
      startsAt: new Date('2026-09-07T08:00:00.000Z'),
      endsAt: new Date('2026-09-07T09:00:00.000Z'),
      displayLabel: 'Existing lesson',
    })
    await sessions.save(otherClassLesson)

    const result = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
      options: { enforceWorkloadFulfillment: true },
    })

    expect(result.sessions.every(session => session.startsAt.toISOString() !== '2026-09-07T08:00:00.000Z')).toBe(true)
    expect(result.unmetWorkloads).toEqual([])
    expect(result.sessions).toHaveLength(2)
  })

  test('persists resolved teacher snapshots when generating current sessions', async () => {
    const { service, sessions } = await createWorkflowContext()
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable({
      classGroupId: 'class-1',
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })

    for (const session of generated.sessions) {
      expect((await sessions.findById(session.id))?.timetableTeacherIds).toEqual(['teacher-shared'])
      expect((await sessions.findById(session.id))?.timetableGenerated).toBe(true)
    }
  })

  test('replaces untouched generated class timetables during school generation', async () => {
    const { service } = await createWorkflowContext()
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
    expect(result.classGroups.every(classGroup => classGroup.sessions.every(session => session.timetableGenerated === true))).toBe(true)
  })

  test('regenerates school sessions for classes without existing timetables', async () => {
    const { service } = await createWorkflowContext()
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

  test('regenerates all class groups during school generation even when timetables already exist', async () => {
    const { service } = await createWorkflowContext()
    await service.timetableGenerationWorkflow.generateSchoolTimetable({
      academicYearId: 'year-1',
      startDate: weekStart,
      endDate: weekEnd,
    })
    const result = await service.timetableGenerationWorkflow.generateSchoolTimetable({ academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd })
    expect(result.skippedClassGroupIds).toEqual([])
    expect(result.classGroups).toHaveLength(2)
    expect(result.classGroups.every(classGroup => classGroup.sessions.every(session => session.timetableGenerated === true))).toBe(true)
  })
})

describe('current timetables preserve recorded work', () => {
  for (const generationMode of [TimetableGenerationMode.Weekly, TimetableGenerationMode.Free]) {
    test(`${generationMode} preserves validated pending lessons and counts their workload`, async () => {
      const { service, sessions, repositories } = await createWorkflowContext()
      const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { generationMode } }
      const first = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
      const preserved = first.sessions[0]!
      await repositories.teacherCorrections.saveState({ schoolId: 'school-1', workflow: 'logbook', targetId: preserved.id, version: 1, locked: true, payload: {}, history: [] })
      const regenerated = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
      expect((await sessions.findById(preserved.id))?.data).toEqual(preserved.data)
      expect(await sessions.findById(first.sessions[1]!.id)).toBeUndefined()
      expect(regenerated.sessions).toHaveLength(1)
      expect(regenerated.unmetWorkloads).toEqual([])
      expect(await sessions.count({ classGroupId: 'class-1' })).toBe(2)
      expect((await repositories.teacherCorrections.state('school-1', 'logbook', preserved.id))?.locked).toBe(true)
    })

    test(`${generationMode} does not recreate a cancelled slot or overwrite a manual exception`, async () => {
      const { service, sessions } = await createWorkflowContext()
      const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { generationMode, enforceWorkloadFulfillment: false } }
      const first = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
      const cancelled = first.sessions[0]!.copyWith({ status: OccurrenceStatus.Cancelled, isException: true })
      const edited = first.sessions[1]!.copyWith({ isException: true })
      await sessions.batchSave([cancelled, edited])
      const regenerated = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
      expect((await sessions.findById(cancelled.id))?.data).toEqual(cancelled.data)
      expect((await sessions.findById(edited.id))?.data).toEqual(edited.data)
      expect(regenerated.sessions.every(row => row.endsAt <= cancelled.startsAt || row.startsAt >= cancelled.endsAt)).toBe(true)
    })

    test(`${generationMode} school replacement is atomic and limited to selected classes`, async () => {
      const { service, sessions, repositories } = await createWorkflowContext()
      const input = { academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { generationMode } }
      await service.timetableGenerationWorkflow.generateSchoolTimetable(input)
      const before = await sessions.list()
      const subject = (await repositories.classSubjects.findById('class-subject-2'))!
      await repositories.classSubjects.save(new ClassSubject({ ...subject.data, periodsPerWeek: 99 }))
      await expect(service.timetableGenerationWorkflow.generateSchoolTimetable(input)).rejects.toMatchObject({ code: 'TIMETABLE_WORKLOAD_UNSATISFIED' })
      expect((await sessions.list()).map(row => row.id).sort()).toEqual(before.map(row => row.id).sort())
      const selected = await service.timetableGenerationWorkflow.generateSchoolTimetable({ ...input, classGroupIds: ['class-1'] })
      expect(selected.classGroups.map(row => row.classGroupId)).toEqual(['class-1'])
      expect((await sessions.list({ classGroupId: 'class-2' })).map(row => row.id).sort()).toEqual(before.filter(row => row.classGroupId === 'class-2').map(row => row.id).sort())
      await expect(service.timetableGenerationWorkflow.generateSchoolTimetable({ ...input, classGroupIds: ['unknown'] })).rejects.toMatchObject({ code: 'TIMETABLE_SCOPE_NOT_FOUND' })
    })
  }

  test('checks the final placements and rolls back a conflicting solver result', async () => {
    const { service, sessions } = await createWorkflowContext()
    const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd, options: { generationMode: TimetableGenerationMode.Free } }
    const first = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
    class ConflictingSolver extends TimetableGenerationServiceWorkflow {
      protected override solve(input: Parameters<TimetableGenerationServiceWorkflow['solve']>[0]) {
        const result = super.solve(input)
        return { ...result, placements: [...result.placements, result.placements[0]!] }
      }
    }
    const workflow = new ConflictingSolver(service.timetableGenerationWorkflow.baseService)
    await expect(workflow.generateClassGroupTimetable(input)).rejects.toMatchObject({ code: 'SCHEDULE_CONFLICT' })
    expect((await sessions.list()).map(row => row.id).sort()).toEqual(first.sessions.map(row => row.id).sort())
  })

  test('generation uses the academic lock shared with attendance and logbook validation', async () => {
    const { service } = await createWorkflowContext()
    const base = service.timetableGenerationWorkflow.baseService
    const keys: string[] = []
    const workflow = new TimetableGenerationServiceWorkflow(new BaseSchoolService({ ...base, atomicExecution: {
      execute: (operation, options) => {
        keys.push(...options?.lockKeys ?? [])
        return base.atomicExecution.execute(operation, options)
      },
    } }))
    await workflow.generateClassGroupTimetable({ classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd })
    expect(keys).toContain('academic-state:school-1')
  })
})

describe('generated timetable printing', () => {
  test('class and teacher documents work immediately, exclude cancellations, and stay in the selected year', async () => {
    const { assembleTeacherTimetable } = await import('../../../src/capabilities/documents/assembly/teacher-timetable')
    const { assembleClassOperational } = await import('../../../src/capabilities/documents/assembly/class-operational')
    const { service, sessions, repositories } = await createWorkflowContext()
    const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd }
    const first = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
    const school = (await repositories.schools.findById('school-1'))!
    const base = service.timetableGenerationWorkflow.baseService
    const teacherInput = { templateKey: 'teacher-timetable.v1' as const, sourceId: 'teacher-shared', academicYearId: 'year-1', locale: 'en' as const }
    const classInput = { templateKey: 'class-timetable.v1' as const, sourceId: 'class-1', academicYearId: 'year-1', locale: 'en' as const }
    const firstTeacher = await assembleTeacherTimetable(base, teacherInput, school, 'en', 'UTC', 'Timetable', {})
    const firstClass = await assembleClassOperational(base, classInput, school, 'en', 'UTC', 'Timetable', {})
    expect(firstTeacher.snapshot.facts?.['rows']).toHaveLength(2)
    expect(firstClass.snapshot.facts?.['rows']).toHaveLength(2)
    await sessions.save(first.sessions[0]!.copyWith({ status: OccurrenceStatus.Cancelled }))
    const year = (await repositories.academicYears.findById('year-1'))!
    await repositories.academicYears.save(new AcademicYear({ ...year.data, id: 'other-year' }))
    const group = (await repositories.classGroups.findById('class-1'))!
    await repositories.classGroups.save(new ClassGroup({ ...group.data, id: 'other-class', academicYearId: 'other-year' }))
    await sessions.save(first.sessions[1]!.copyWith({ id: 'other-year-session', classGroupId: 'other-class' }))
    const teacher = await assembleTeacherTimetable(base, teacherInput, school, 'en', 'UTC', 'Timetable', {})
    const classDoc = await assembleClassOperational(base, classInput, school, 'en', 'UTC', 'Timetable', {})
    expect(teacher.snapshot.facts?.['rows']).toHaveLength(1)
    expect(classDoc.snapshot.facts?.['rows']).toHaveLength(1)
    expect(teacher.sourceVersion).not.toContain('other-year-session')
    expect(teacher.sourceVersion).not.toBe(firstTeacher.sourceVersion)
    await expect(assembleClassOperational(base, { ...classInput, academicYearId: 'other-year' }, school, 'en', 'UTC', 'Timetable', {})).rejects.toMatchObject({ code: 'DOCUMENT_SOURCE_MISSING' })
    await sessions.save(first.sessions[1]!.copyWith({ status: OccurrenceStatus.Cancelled }))
    await expect(assembleTeacherTimetable(base, teacherInput, school, 'en', 'UTC', 'Timetable', {})).rejects.toMatchObject({ code: 'DOCUMENT_TIMETABLE_EMPTY' })
    // Previously assembled/issued snapshots remain untouched.
    expect(firstTeacher.snapshot.facts?.['rows']).toHaveLength(2)
  })
})

describe('manual timetable decisions', () => {
  test('direct manual edits and previously marked exceptions survive subsequent generation', async () => {
    const { service, sessions } = await createWorkflowContext()
    const input = { classGroupId: 'class-1', academicYearId: 'year-1', startDate: weekStart, endDate: weekEnd }
    const generated = await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
    const edited = generated.sessions[0]!.copyWith({ displayLabel: 'Manual label' })
    await service.baseService.entities.lessonSessions.save(edited)
    expect((await sessions.findById(edited.id))?.isException).toBe(true)
    await service.baseService.entities.lessonSessions.save(edited.copyWith({ isException: false }))
    await service.timetableGenerationWorkflow.generateClassGroupTimetable(input)
    expect((await sessions.findById(edited.id))?.displayLabel).toBe('Manual label')
    expect((await sessions.findById(edited.id))?.isException).toBe(true)
    expect(await sessions.findById(generated.sessions[1]!.id)).toBeUndefined()
  })
})
