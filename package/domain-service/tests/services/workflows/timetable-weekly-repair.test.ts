import type { TimetableGenerationDefaults } from '../../../src/capabilities/timetable/types'
import { DayOfWeek, PeriodDefinition, TimetableGenerationMode, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { buildWeeklyTemplateSpace, solveTimetable, spreadWeeklyTemplate } from '../../../src/capabilities/timetable/resolver'

const options: TimetableGenerationDefaults = {
  generationMode: TimetableGenerationMode.Weekly,
  enforceWorkloadFulfillment: true,
  excludeBreakSlots: true,
  minDayGapSameSubject: 1,
  preferredPeriodDefinitionIds: [],
  allowUnassignedTeacherPlacements: false,
  useHomeroomTeacherFallback: false,
  defaultMinPeriodSpan: 1,
  defaultMaxPeriodSpan: 1,
}
const periods = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]
  .flatMap(dayOfWeek => [8, 9].map(hour => new PeriodDefinition(withShortName({
    id: `${dayOfWeek}-${hour}`,
    schoolId: 'school',
    academicYearId: 'year',
    name: 'Lesson',
    dayOfWeek,
    order: hour,
    startTime: `${hour.toString().padStart(2, '0')}:00`,
    endTime: `${(hour + 1).toString().padStart(2, '0')}:00`,
  }))))
const subjects = [{ classSubjectId: 'english', displayLabel: 'English', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher'] }]
const template = solveTimetable({ classGroupId: 'class', cells: buildWeeklyTemplateSpace(periods), subjects, occupiedIntervals: [], options })
const input = {
  classGroupId: 'class',
  templatePlacements: template.placements,
  periodById: new Map(periods.map(p => [p.id, p])),
  startDate: new Date('2026-09-14'),
  endDate: new Date('2026-09-25'),
  nonSchoolDates: new Set<string>(),
  subjects,
  options,
  occupiedIntervals: [{ layer: 'class_group' as const, layerKey: 'class', startsAt: new Date('2026-09-14T08:00Z'), endsAt: new Date('2026-09-14T09:00Z') }],
}

describe('weekly timetable repair', () => {
  test('repairs a blocked template slot without changing the unaffected week or relaxing workload', () => {
    const result = spreadWeeklyTemplate(input)
    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements).toHaveLength(6)
    const firstWeek = result.placements.filter(p => p.cell.weekKey === '2026-09-14')
    expect(new Set(firstWeek.map(p => p.cell.date)).size).toBe(3)
    expect(firstWeek.some(p => p.cell.startsAt.toISOString() === '2026-09-14T09:00:00.000Z')).toBe(true)
    expect(result.placements.filter(p => p.cell.weekKey === '2026-09-21').map(p => p.cell.periodDefinitionId))
      .toEqual(template.placements.map(p => p.cell.periodDefinitionId))
  })

  test('repairs closure and teacher conflicts only in available teaching periods', () => {
    const result = spreadWeeklyTemplate({ ...input, nonSchoolDates: new Set(['2026-09-14']), occupiedIntervals: [
      ...input.occupiedIntervals,
      { layer: 'teacher', layerKey: 'teacher', startsAt: new Date('2026-09-17T08:00Z'), endsAt: new Date('2026-09-17T10:00Z') },
    ] })
    expect(result.unmetWorkloads).toEqual([])
    expect(result.placements.filter(p => p.cell.weekKey === '2026-09-14').map(p => p.cell.date).sort())
      .toEqual(['2026-09-15', '2026-09-16', '2026-09-18'])
  })

  test('respects preserved workload and subject dates while repairing', () => {
    const result = spreadWeeklyTemplate({ ...input, existingWorkloadByClassSubjectAndWeek: { english: { '2026-09-14': 1 } }, existingSubjectDates: [{ classSubjectId: 'english', date: '2026-09-15' }] })
    const firstWeek = result.placements.filter(p => p.cell.weekKey === '2026-09-14')
    expect(firstWeek).toHaveLength(2)
    expect(firstWeek.every(p => p.cell.date !== '2026-09-15')).toBe(true)
    expect(result.unmetWorkloads).toEqual([])
  })

  test('rearranges only the affected week when fixed template slots prevent a complete fit', () => {
    const double = { ...subjects[0]!, periodsPerWeek: 2, maxPeriodSpan: 2 }
    const templateCells = buildWeeklyTemplateSpace(periods)
    const monday = templateCells.find(cell => cell.date === '2026-01-05')!
    const tuesday = templateCells.find(cell => cell.date === '2026-01-06')!
    const make = (cell: typeof monday) => ({ ...double, cell, cells: [cell], span: 1 })
    const result = spreadWeeklyTemplate({ ...input, subjects: [double], templatePlacements: [make(monday), make(tuesday)], nonSchoolDates: new Set(['2026-09-14', '2026-09-16', '2026-09-17', '2026-09-18']) })
    const firstWeek = result.placements.filter(p => p.cell.weekKey === '2026-09-14')
    expect(firstWeek).toHaveLength(1)
    expect(firstWeek[0]?.span).toBe(2)
    expect(firstWeek[0]?.cell.date).toBe('2026-09-15')
    expect(result.placements.filter(p => p.cell.weekKey === '2026-09-21')).toHaveLength(2)
    expect(result.unmetWorkloads).toEqual([])
  })

  test('does not violate subject spacing at the boundary between template weeks', () => {
    const spacedOptions = { ...options, minDayGapSameSubject: 4 }
    const spacedSubjects = [{ ...subjects[0]!, periodsPerWeek: 2 }]
    const spacedTemplate = solveTimetable({ classGroupId: 'class', cells: buildWeeklyTemplateSpace(periods), subjects: spacedSubjects, occupiedIntervals: [], options: spacedOptions })
    const result = spreadWeeklyTemplate({ ...input, occupiedIntervals: [], subjects: spacedSubjects, templatePlacements: spacedTemplate.placements, options: { ...spacedOptions, enforceWorkloadFulfillment: false } })
    const dates = result.placements.map(placement => placement.cell.startsAt.getTime()).sort((left, right) => left - right)
    for (let index = 1; index < dates.length; index++)
      expect((dates[index]! - dates[index - 1]!) / 86_400_000).toBeGreaterThanOrEqual(4)
    expect(result.unmetWorkloads.length).toBeGreaterThan(0)
  })

  test('still rejects impossible workload and supports an explicitly requested partial result', () => {
    const blocked = { ...input, occupiedIntervals: [{ layer: 'class_group' as const, layerKey: 'class', startsAt: new Date('2026-09-14'), endsAt: new Date('2026-09-19') }] }
    expect(() => spreadWeeklyTemplate(blocked)).toThrow('Could not place 0/3')
    const result = spreadWeeklyTemplate({ ...blocked, options: { ...options, enforceWorkloadFulfillment: false } })
    expect(result.unmetWorkloads).toEqual([{ classSubjectId: 'english', weekKey: '2026-09-14', required: 3, placed: 0 }])
  })
})
