import type { OccupiedInterval, ResolvedTimetableCell, SolveTimetableInput, SpreadWeeklyTemplateInput, TimetablePlacement } from '../../src/capabilities/timetable'
import { DayOfWeek, PeriodDefinition, TimetableGenerationMode } from '@edaya/core'
import { WEEKLY_TEMPLATE_WEEK_KEY } from '../../src/capabilities/timetable'

export function timetableEquivalenceCase(seed: number, mode: TimetableGenerationMode) {
  const weekdays = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday]
  const periods = weekdays.flatMap(dayOfWeek => Array.from({ length: 4 }, (_, index) => new PeriodDefinition({ id: `${dayOfWeek}-${index}`, schoolId: 'school', academicYearId: 'year', label: `${index}`, dayOfWeek, order: index + 1, startTime: `${String(8 + index).padStart(2, '0')}:00`, endTime: `${String(9 + index).padStart(2, '0')}:00`, isTeachingSlot: true })))
  const cells: ResolvedTimetableCell[] = []
  const reference = mode === TimetableGenerationMode.Weekly ? Date.UTC(2026, 0, 5) : Date.UTC(2026, 8, 7)
  const weeks = mode === TimetableGenerationMode.Weekly ? 1 : 3
  for (let week = 0; week < weeks; week++) {
    for (let day = 0; day < 5; day++) {
      if (mode === TimetableGenerationMode.Free && seed % 2 === 0 && week === 1 && day === 2)
        continue
      for (let slot = 0; slot < 4; slot++) {
        const startsAt = new Date(reference + (week * 7 + day) * 86_400_000 + (8 + slot) * 3_600_000)
        cells.push({ date: startsAt.toISOString().slice(0, 10), weekKey: mode === TimetableGenerationMode.Weekly ? WEEKLY_TEMPLATE_WEEK_KEY : new Date(reference + week * 7 * 86_400_000).toISOString().slice(0, 10), weeklyIndex: day * 4 + slot, periodDefinitionId: `${weekdays[day]}-${slot}`, startsAt, endsAt: new Date(startsAt.getTime() + 3_600_000) })
      }
    }
  }
  const occupiedIntervals: OccupiedInterval[] = cells.filter((_, index) => (index * 7 + seed) % 13 === 0).map((cell, index) => ({ layer: index % 2 ? 'class_group' : 'teacher', layerKey: index % 2 ? 'class' : 'teacher-0', startsAt: cell.startsAt, endsAt: cell.endsAt }))
  occupiedIntervals.push({ layer: 'teacher', layerKey: 'teacher-1', startsAt: new Date(reference - 3_600_000), endsAt: new Date(reference + 9 * 3_600_000) })
  const input: SolveTimetableInput = {
    classGroupId: 'class',
    cells,
    occupiedIntervals,
    subjects: Array.from({ length: 4 }, (_, index) => ({ classSubjectId: `subject-${index}`, displayLabel: `Subject ${index}`, periodsPerWeek: 2 + (index + seed) % 3, teacherIds: [`teacher-${index % 2}`], minPeriodSpan: index === seed % 4 ? 2 : 1, maxPeriodSpan: index % 2 ? 1 : 2 })).map(subject => ({ ...subject, maxPeriodSpan: Math.max(subject.minPeriodSpan, subject.maxPeriodSpan) })),
    options: { generationMode: mode, enforceWorkloadFulfillment: false, excludeBreakSlots: true, minDayGapSameSubject: seed % 3, preferredPeriodDefinitionIds: [periods[seed % periods.length]!.id], allowUnassignedTeacherPlacements: false, useHomeroomTeacherFallback: false, defaultMinPeriodSpan: 1, defaultMaxPeriodSpan: 1 },
    existingWorkloadByClassSubjectAndWeek: mode === TimetableGenerationMode.Free ? { 'subject-0': { '2026-09-07': seed % 2 } } : {},
  }
  const spread = (placements: TimetablePlacement[]): SpreadWeeklyTemplateInput => ({ classGroupId: 'class', templatePlacements: placements, periodById: new Map(periods.map(period => [period.id, period])), startDate: new Date('2026-09-08T00:00:00Z'), endDate: new Date('2026-09-24T00:00:00Z'), nonSchoolDates: new Set(['2026-09-16']), occupiedIntervals: [{ layer: 'teacher', layerKey: 'teacher-0', startsAt: new Date('2026-09-13T23:00:00Z'), endsAt: new Date('2026-09-14T09:00:00Z') }], subjects: input.subjects, options: input.options })
  return { input, spread }
}
