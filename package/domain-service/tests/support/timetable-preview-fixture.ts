import type {
  OccupiedInterval,
  ResolvedTimetableCell,
  SolveTimetableResult,
  TimetableGenerationDefaults,
  TimetableSubjectDemand,
} from '../../src/services/workflows/timetable-generation'
import { solveTimetable } from '../../src/services/workflows/timetable-generation'
import { TimetableGenerationMode } from '@edaya/core'

const RANGE_START = new Date('2026-09-07T00:00:00.000Z')
const RANGE_END_EXCLUSIVE = new Date('2026-12-07T00:00:00.000Z')
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const
const PERIODS = [
  { id: 'p1', label: '08:00-09:00', startHour: 8 },
  { id: 'p2', label: '09:00-10:00', startHour: 9 },
  { id: 'p3', label: '10:00-11:00', startHour: 10 },
  { id: 'p4', label: '11:00-12:00', startHour: 11 },
] as const

export const timetablePreviewClosures = [
  { label: 'Thanksgiving', startsOn: '2026-10-12', endsOn: '2026-10-12' },
  { label: 'Autumn vacation', startsOn: '2026-11-02', endsOn: '2026-11-06' },
] as const

interface PreviewClassFixture {
  classGroupId: string
  className: string
  subjects: TimetableSubjectDemand[]
}

export interface TimetablePreviewClassResult {
  classGroupId: string
  className: string
  result: SolveTimetableResult
}

export interface TimetablePreviewResult {
  classes: TimetablePreviewClassResult[]
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

const weekStarts: Date[] = []
for (let current = RANGE_START; current < RANGE_END_EXCLUSIVE; current = addDays(current, 7)) {
  weekStarts.push(current)
}

function cell(weekIndex: number, dayIndex: number, periodIndex: number): ResolvedTimetableCell {
  const weekStart = weekStarts[weekIndex]!
  const date = addDays(weekStart, dayIndex)
  const period = PERIODS[periodIndex]!
  const dateKey = date.toISOString().slice(0, 10)
  return {
    date: dateKey,
    weekKey: weekStart.toISOString().slice(0, 10),
    weeklyIndex: dayIndex * PERIODS.length + periodIndex,
    periodDefinitionId: `${DAYS[dayIndex]!.toLowerCase()}-${period.id}`,
    startsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), period.startHour)),
    endsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), period.startHour + 1)),
  }
}

const allCells = weekStarts.flatMap((_, weekIndex) =>
  DAYS.flatMap((__, dayIndex) => PERIODS.map((___, periodIndex) => cell(weekIndex, dayIndex, periodIndex))),
)
const cells = allCells
  .filter(candidate => !timetablePreviewClosures.some(closure =>
    candidate.date >= closure.startsOn && candidate.date <= closure.endsOn,
  ))

const occupiedIntervals: OccupiedInterval[] = weekStarts.flatMap((weekStart, weekIndex) => {
  const weekKey = weekStart.toISOString().slice(0, 10)
  return [
    {
      layer: 'teacher',
      layerKey: 'teacher-ada',
      startsAt: cell(weekIndex, 0, 0).startsAt,
      endsAt: cell(weekIndex, 0, 0).endsAt,
      sourceSessionId: `ada-existing-lesson:${weekKey}`,
    },
    {
      layer: 'class_group',
      layerKey: 'class-6a',
      startsAt: cell(weekIndex, 2, 3).startsAt,
      endsAt: cell(weekIndex, 2, 3).endsAt,
      sourceSessionId: `school-assembly:${weekKey}`,
    },
  ] satisfies OccupiedInterval[]
})

const classGroups: PreviewClassFixture[] = [
  {
    classGroupId: 'class-6a',
    className: 'Grade 6 A',
    subjects: [
      { classSubjectId: '6a-math', displayLabel: 'Mathematics', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-ada'] },
      { classSubjectId: '6a-english', displayLabel: 'English', periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-grace'] },
      { classSubjectId: '6a-science', displayLabel: 'Science', periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-ada', 'teacher-grace'] },
    ],
  },
  {
    classGroupId: 'class-6b',
    className: 'Grade 6 B',
    subjects: [
      { classSubjectId: '6b-math', displayLabel: 'Mathematics', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-ada'] },
      { classSubjectId: '6b-french', displayLabel: 'French', periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-turing'] },
      { classSubjectId: '6b-history', displayLabel: 'History', periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-nadia'] },
    ],
  },
  {
    classGroupId: 'class-6c',
    className: 'Grade 6 C',
    subjects: [
      { classSubjectId: '6c-math', displayLabel: 'Mathematics', periodsPerWeek: 3, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-euclid'] },
      { classSubjectId: '6c-english', displayLabel: 'English', periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-grace'] },
      { classSubjectId: '6c-science', displayLabel: 'Science', periodsPerWeek: 2, minPeriodSpan: 1, maxPeriodSpan: 1, teacherIds: ['teacher-ada', 'teacher-grace'] },
    ],
  },
]

const options: TimetableGenerationDefaults = {
  generationMode: TimetableGenerationMode.Free,
  enforceWorkloadFulfillment: false,
  excludeBreakSlots: true,
  minDayGapSameSubject: 1,
  preferredPeriodDefinitionIds: DAYS.flatMap(day => [
    `${day.toLowerCase()}-p1`,
    `${day.toLowerCase()}-p2`,
  ]),
  allowUnassignedTeacherPlacements: false,
  useHomeroomTeacherFallback: false,
  defaultMinPeriodSpan: 1,
  defaultMaxPeriodSpan: 1,
}

export const timetablePreviewFixture = {
  cells,
  classGroups,
  occupiedIntervals,
  options,
}

const teacherNames: Record<string, string> = {
  'teacher-ada': 'Ada',
  'teacher-euclid': 'Euclid',
  'teacher-grace': 'Grace',
  'teacher-nadia': 'Nadia',
  'teacher-turing': 'Turing',
}

function blockedLabel(sourceSessionId: string): string {
  if (sourceSessionId.startsWith('ada-existing-lesson:')) {
    return 'Ada busy'
  }
  if (sourceSessionId.startsWith('school-assembly:')) {
    return 'Assembly'
  }
  return 'Blocked'
}

export function generateTimetablePreview(): TimetablePreviewResult {
  const occupied = [...occupiedIntervals]
  const classes = classGroups.map((classGroup) => {
    const result = solveTimetable({
      classGroupId: classGroup.classGroupId,
      cells,
      subjects: classGroup.subjects,
      occupiedIntervals: occupied,
      options,
    })
    for (const placement of result.placements) {
      occupied.push({
        layer: 'class_group',
        layerKey: classGroup.classGroupId,
        startsAt: placement.cell.startsAt,
        endsAt: placement.cell.endsAt,
      })
      for (const teacherId of placement.teacherIds) {
        occupied.push({
          layer: 'teacher',
          layerKey: teacherId,
          startsAt: placement.cell.startsAt,
          endsAt: placement.cell.endsAt,
        })
      }
    }
    return { classGroupId: classGroup.classGroupId, className: classGroup.className, result }
  })
  return { classes }
}

export function timetablePreviewWeekPatterns(preview: TimetablePreviewResult): string[] {
  return weekStarts.map((weekStart) => {
    const weekKey = weekStart.toISOString().slice(0, 10)
    return preview.classes.flatMap(classResult => classResult.result.placements
      .filter(placement => placement.cell.weekKey === weekKey)
      .map(placement => `${classResult.classGroupId}:${placement.cell.weeklyIndex}:${placement.classSubjectId}`))
      .sort()
      .join('|')
  })
}

function blockedCellsForClass(classGroupId: string): Map<string, string> {
  const blockedByCell = new Map<string, string>()
  for (const occupied of occupiedIntervals.filter(interval =>
    interval.layer === 'teacher' || interval.layerKey === classGroupId,
  )) {
    const matchingCell = allCells.find(candidate =>
      candidate.startsAt < occupied.endsAt && occupied.startsAt < candidate.endsAt,
    )
    if (matchingCell && occupied.sourceSessionId) {
      blockedByCell.set(
        `${matchingCell.date}:${matchingCell.periodDefinitionId}`,
        blockedLabel(occupied.sourceSessionId),
      )
    }
  }
  return blockedByCell
}

export function renderTimetablePreview(preview: TimetablePreviewResult): string {
  const lines = [
    '# Generated timetable: 3 classes',
    '',
    'Range: 2026-09-07 to 2026-12-04 (13 weeks, weekly recurrence)',
    '',
    'Calendar closures:',
    ...timetablePreviewClosures.map(closure => `- ${closure.label}: ${closure.startsOn} to ${closure.endsOn}`),
  ]
  for (const [weekIndex, weekStart] of weekStarts.entries()) {
    const weekKey = weekStart.toISOString().slice(0, 10)
    const weekEnd = addDays(weekStart, 4).toISOString().slice(0, 10)
    const weekCells = allCells.filter(candidate => candidate.weekKey === weekKey)
    lines.push('', `## Week ${weekIndex + 1} of ${weekStarts.length}: ${weekKey} to ${weekEnd}`)

    for (const classResult of preview.classes) {
      const placementByCell = new Map(classResult.result.placements
        .filter(placement => placement.cell.weekKey === weekKey)
        .map(placement => [`${placement.cell.date}:${placement.cell.periodDefinitionId}`, placement]))
      const blockedByCell = blockedCellsForClass(classResult.classGroupId)
      lines.push(
        '',
        `### ${classResult.className}`,
        '',
        '| Period | Monday | Tuesday | Wednesday | Thursday | Friday |',
        '| --- | --- | --- | --- | --- | --- |',
      )
      for (const period of PERIODS) {
        const values = DAYS.map((_, dayIndex) => {
          const currentCell = weekCells.find(candidate =>
            candidate.periodDefinitionId === `${DAYS[dayIndex]!.toLowerCase()}-${period.id}`,
          )!
          const closure = timetablePreviewClosures.find(candidate =>
            currentCell.date >= candidate.startsOn && currentCell.date <= candidate.endsOn,
          )
          if (closure) {
            return `[Day off: ${closure.label}]`
          }
          const key = `${currentCell.date}:${currentCell.periodDefinitionId}`
          const placement = placementByCell.get(key)
          const blocked = blockedByCell.get(key)
          if (placement) {
            const teachers = placement.teacherIds.map(id => teacherNames[id] ?? id).join(' + ')
            const occupancyNote = blocked ? `; ${blocked}` : ''
            return `${placement.displayLabel} (${teachers})${occupancyNote}`
          }
          return blocked ? `[Blocked: ${blocked}]` : 'Available'
        })
        lines.push(`| ${period.label} | ${values.join(' | ')} |`)
      }
    }
  }

  const patterns = timetablePreviewWeekPatterns(preview)
  const weeklyPlacementCounts = patterns.map(pattern => pattern ? pattern.split('|').length : 0)
  const placements = preview.classes.flatMap(classResult => classResult.result.placements)
  const unmetWorkloads = preview.classes.flatMap(classResult => classResult.result.unmetWorkloads)
  const closedWeekdays = (allCells.length - cells.length) / PERIODS.length
  lines.push(
    '',
    `Classes: ${preview.classes.length}; closed weekdays: ${closedWeekdays}`,
    `Weekly placements: ${Math.min(...weeklyPlacementCounts)}-${Math.max(...weeklyPlacementCounts)}; total placements: ${placements.length}`,
    `Unique weekly patterns: ${new Set(patterns).size}; unmet workload slices: ${unmetWorkloads.length}`,
  )
  return lines.join('\n')
}
