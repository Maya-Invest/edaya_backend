import type { SchoolRepositories } from '@edaya/service'
import type { ResolvedTimetableCell, TimetableGenerationDefaults, TimetablePlacement, TimetableSubjectDemand } from '../../../src/services/workflows/timetable-generation'
import { AcademicYear, CalendarEvent, CalendarEventKind, CalendarEventScopeKind, ClassGroup, DayOfWeek, PeriodDefinition, TimetableGenerationMode, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { resolveTimetableSpace, resolveWeeklyTemplateSpace, solveTimetable, spreadWeeklyTemplate, WEEKLY_TEMPLATE_WEEK_KEY } from '../../../src/services/workflows/timetable-generation'

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
  return new PeriodDefinition(withShortName({
    id: `period-${dayOfWeek}${suffix}`,
    schoolId: 'school-1',
    academicYearId: 'year-1',
    name: `Period ${dayOfWeek}`,
    dayOfWeek,
    order: suffix ? 2 : 1,
    startTime: suffix ? '09:00' : '08:00',
    endTime: suffix ? '10:00' : '09:00',
    isBreak: suffix === '-break',
    isTeachingSlot: suffix !== '-disabled',
  }))
}

describe('timetable resolver and solver', () => {
  test('resolves ordered teaching cells and excludes closures, breaks, and disabled slots', async () => {
    const classGroup = new ClassGroup(withShortName({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 1',
    }))
    const repositories = {
      classGroups: { findById: async () => classGroup },
      academicYears: {
        findById: async () => new AcademicYear(withShortName({
          id: 'year-1',
          schoolId: 'school-1',
          name: '2026',
          startDate: weekStart,
          endDate: weekEnd,
          status: 'published',
        })),
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
    const classGroup = new ClassGroup(withShortName({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 1',
    }))
    const repositories = {
      classGroups: { findById: async () => classGroup },
      academicYears: {
        findById: async () => new AcademicYear(withShortName({
          id: 'year-1',
          schoolId: 'school-1',
          name: '2026',
          startDate: weekStart,
          endDate: weekEnd,
          status: 'published',
        })),
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
    const classGroup = new ClassGroup(withShortName({
      id: 'class-2',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 2',
    }))
    const repositories = {
      classGroups: { findById: async () => classGroup },
      academicYears: {
        findById: async () => new AcademicYear(withShortName({
          id: 'year-1',
          schoolId: 'school-1',
          name: '2026',
          startDate: weekStart,
          endDate: weekEnd,
          status: 'published',
        })),
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
    const classGroup = new ClassGroup(withShortName({
      id: 'class-1',
      schoolId: 'school-1',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Class 1',
    }))
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
