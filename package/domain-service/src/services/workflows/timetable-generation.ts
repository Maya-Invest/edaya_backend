import type {
  AcademicYear,
  Assessment,
  ClassGroup,
  ClassSubject,
  GradeLevelSubject,
  LessonSession as LessonSessionEntity,
  PeriodDefinition,
  School,
  TeacherAssignment,
} from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { randomUUID } from 'node:crypto'
import { operationModule, SchedulingOperations } from '@edaya/authorization'
import {
  AssessmentKind,
  BusinessRuleViolationError,
  calendarEventBlocksTimetable,
  CalendarEventScopeKind,
  civilDateKey,
  DayOfWeek,
  LessonSession,
  normalizeDate,
  OccurrenceStatus,
  TeacherAssignmentKind,
  TeacherAssignmentStatus,
  TeacherUnavailability,
  TeacherUnavailabilityRecurrence,
  TimetableGenerated,
  TimetableGenerationMode,
} from '@edaya/core'
import { BaseServiceWorkflow } from './base-service-workflow'
import { assertNoSessionConflict } from './schedule-conflicts'
import { expandTeacherUnavailability } from './teacher-unavailability'

export interface ResolveTimetableSpaceInput {
  classGroupId: string
  academicYearId: string
  startDate: Date
  endDate: Date
}

export interface ResolvedTimetableCell {
  date: string
  weekKey: string
  weeklyIndex: number
  periodDefinitionId: string
  startsAt: Date
  endsAt: Date
}

export interface TimetableGenerationDefaults {
  generationMode: TimetableGenerationMode
  enforceWorkloadFulfillment: boolean
  excludeBreakSlots: boolean
  minDayGapSameSubject: number
  preferredPeriodDefinitionIds: string[]
  allowUnassignedTeacherPlacements: boolean
  useHomeroomTeacherFallback: boolean
  defaultMinPeriodSpan: number
  defaultMaxPeriodSpan: number
}

export interface TimetablePlacementParameters {
  periodsPerWeekByClassSubjectId?: Record<string, number>
  minPeriodSpanByClassSubjectId?: Record<string, number>
  maxPeriodSpanByClassSubjectId?: Record<string, number>
}

export interface GenerateClassGroupTimetableInput extends ResolveTimetableSpaceInput {
  placementParameters?: TimetablePlacementParameters
  options?: Partial<TimetableGenerationDefaults>
}

export interface GenerateSchoolTimetableInput {
  academicYearId: string
  startDate: Date
  endDate: Date
  placementParameters?: TimetablePlacementParameters
  options?: Partial<TimetableGenerationDefaults>
}

export interface PublishClassGroupTimetableInput {
  classGroupId: string
  startDate: Date
  endDate: Date
  sessionConflictPolicy?: 'fail' | 'skip'
}

export interface RepublishClassGroupTimetableInput extends GenerateClassGroupTimetableInput {
  sessionConflictPolicy?: 'fail' | 'skip'
}

export interface TimetableSubjectDemand {
  classSubjectId: string
  displayLabel: string
  periodsPerWeek: number
  minPeriodSpan: number
  maxPeriodSpan: number
  teacherIds: string[]
}

export interface OccupiedInterval {
  layer: 'teacher' | 'class_group'
  layerKey: string
  startsAt: Date
  endsAt: Date
  sourceSessionId?: string
}

export interface OccupiedCell {
  date: string
  periodDefinitionId: string
  layer: 'teacher' | 'class_group'
  layerKey: string
  sourceSessionId?: string
}

export interface TimetablePlacement {
  classSubjectId: string
  displayLabel: string
  teacherIds: string[]
  cell: ResolvedTimetableCell
  span: number
  cells: readonly ResolvedTimetableCell[]
}

export interface UnmetTimetableWorkload {
  classSubjectId: string
  weekKey: string
  required: number
  placed: number
}

export interface SolveTimetableInput {
  classGroupId: string
  cells: ResolvedTimetableCell[]
  subjects: TimetableSubjectDemand[]
  occupiedIntervals: OccupiedInterval[]
  existingWorkloadByClassSubjectAndWeek?: Record<string, Record<string, number>>
  options: TimetableGenerationDefaults
}

export interface SolveTimetableResult {
  placements: TimetablePlacement[]
  unmetWorkloads: UnmetTimetableWorkload[]
}

export interface SpreadWeeklyTemplateInput {
  classGroupId: string
  templatePlacements: readonly TimetablePlacement[]
  periodById: ReadonlyMap<string, PeriodDefinition>
  startDate: Date
  endDate: Date
  nonSchoolDates: ReadonlySet<string>
  occupiedIntervals: readonly OccupiedInterval[]
  subjects: readonly TimetableSubjectDemand[]
  options: TimetableGenerationDefaults
}

export const WEEKLY_TEMPLATE_WEEK_KEY = '__template__'
const TEMPLATE_REFERENCE_MONDAY = normalizeDate(new Date('2026-01-05T00:00:00.000Z'))

const DAY_OFFSET_BY_DAY_OF_WEEK: Record<DayOfWeek, number> = {
  [DayOfWeek.Monday]: 0,
  [DayOfWeek.Tuesday]: 1,
  [DayOfWeek.Wednesday]: 2,
  [DayOfWeek.Thursday]: 3,
  [DayOfWeek.Friday]: 4,
  [DayOfWeek.Saturday]: 5,
  [DayOfWeek.Sunday]: 6,
}

export interface GenerateClassGroupTimetableResult extends SolveTimetableResult {
  classGroupId: string
  sessions: LessonSessionEntity[]
}

export interface GenerateSchoolTimetableResult {
  academicYearId: string
  classGroups: GenerateClassGroupTimetableResult[]
  skippedClassGroupIds: string[]
}

export interface PublishClassGroupTimetableResult {
  classGroupId: string
  publishedSessionIds: string[]
  skippedSessionIds: string[]
}

export interface RepublishClassGroupTimetableResult {
  generation: GenerateClassGroupTimetableResult
  publication: PublishClassGroupTimetableResult
}

const DAY_BY_UTC_INDEX: Record<number, DayOfWeek> = {
  0: DayOfWeek.Sunday,
  1: DayOfWeek.Monday,
  2: DayOfWeek.Tuesday,
  3: DayOfWeek.Wednesday,
  4: DayOfWeek.Thursday,
  5: DayOfWeek.Friday,
  6: DayOfWeek.Saturday,
}

function dateKey(date: Date): string {
  return civilDateKey(date)
}

function nextDate(date: Date): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return normalizeDate(next)
}

function endExclusive(date: Date): Date {
  return nextDate(normalizeDate(date))
}

function calendarDaysBetween(leftDateKey: string, rightDateKey: string): number {
  const parse = (dateKey: string) => {
    const [year, month, day] = dateKey.split('-').map(Number)
    return Date.UTC(year!, month! - 1, day!)
  }
  return Math.round(Math.abs(parse(rightDateKey) - parse(leftDateKey)) / (24 * 60 * 60 * 1000))
}

function violatesSameSubjectDayGap(
  placements: readonly TimetablePlacement[],
  classSubjectId: string,
  date: string,
  minDayGapSameSubject: number,
): boolean {
  return placements.some(placement =>
    placement.classSubjectId === classSubjectId
    && calendarDaysBetween(placement.cell.date, date) < minDayGapSameSubject)
}

function makePlacement(
  base: Pick<TimetablePlacement, 'classSubjectId' | 'displayLabel' | 'teacherIds'>,
  cells: readonly ResolvedTimetableCell[],
): TimetablePlacement {
  const firstCell = cells[0]
  if (!firstCell) {
    throw new BusinessRuleViolationError('TIMETABLE_PLACEMENT_INVALID', 'A timetable placement requires at least one cell')
  }
  return {
    ...base,
    cell: firstCell,
    span: cells.length,
    cells,
  }
}

function placementSlotCount(placement: TimetablePlacement): number {
  return placement.span
}

const UTC_DAY_TO_DAY_OF_WEEK: Record<number, DayOfWeek> = {
  0: DayOfWeek.Sunday,
  1: DayOfWeek.Monday,
  2: DayOfWeek.Tuesday,
  3: DayOfWeek.Wednesday,
  4: DayOfWeek.Thursday,
  5: DayOfWeek.Friday,
  6: DayOfWeek.Saturday,
}

function dayOfWeekFromUtcDate(date: Date): DayOfWeek {
  return UTC_DAY_TO_DAY_OF_WEEK[normalizeDate(date).getUTCDay()]!
}

function countSessionPeriodSlots(
  session: { startsAt: Date, endsAt: Date },
  periods: readonly PeriodDefinition[],
  excludeBreakSlots: boolean,
): number {
  const sessionDay = dayOfWeekFromUtcDate(session.startsAt)
  const sessionDate = normalizeDate(session.startsAt)
  const dayPeriods = periods
    .filter(period => period.dayOfWeek === sessionDay
      && period.isTeachingSlot
      && (!(excludeBreakSlots) || !period.isBreak))
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
  const overlapping = dayPeriods.filter((period) => {
    const times = buildCellTimes(sessionDate, period)
    return occurrenceOverlaps(session.startsAt, session.endsAt, times.startsAt, times.endsAt)
  })
  return overlapping.length > 0 ? overlapping.length : 1
}

function groupCellsByDate(cells: readonly ResolvedTimetableCell[]): Map<string, ResolvedTimetableCell[]> {
  const grouped = new Map<string, ResolvedTimetableCell[]>()
  for (const cell of cells) {
    grouped.set(cell.date, [...(grouped.get(cell.date) ?? []), cell])
  }
  for (const [date, dayCells] of grouped) {
    grouped.set(date, dayCells.sort((left, right) =>
      left.weeklyIndex - right.weeklyIndex
      || left.startsAt.getTime() - right.startsAt.getTime()
      || left.periodDefinitionId.localeCompare(right.periodDefinitionId)))
  }
  return grouped
}

function isConsecutiveCellRun(cells: readonly ResolvedTimetableCell[]): boolean {
  for (let index = 1; index < cells.length; index++) {
    if (cells[index]!.weeklyIndex !== cells[index - 1]!.weeklyIndex + 1) {
      return false
    }
  }
  return true
}

function buildCandidateBlocks(
  weekCells: readonly ResolvedTimetableCell[],
  minSpan: number,
  maxSpan: number,
): ResolvedTimetableCell[][] {
  const blocks: ResolvedTimetableCell[][] = []
  for (const dayCells of groupCellsByDate(weekCells).values()) {
    for (let start = 0; start < dayCells.length; start++) {
      for (let span = minSpan; span <= maxSpan && start + span <= dayCells.length; span++) {
        const candidate = dayCells.slice(start, start + span)
        if (isConsecutiveCellRun(candidate)) {
          blocks.push(candidate)
        }
      }
    }
  }
  return blocks
}

function blockIsAvailable(
  block: readonly ResolvedTimetableCell[],
  classGroupId: string,
  teacherIds: readonly string[],
  occupied: readonly OccupiedInterval[],
): boolean {
  return block.every(cell => cellIsAvailable(cell, classGroupId, teacherIds, occupied))
}

function sortCandidateBlocks(
  blocks: readonly ResolvedTimetableCell[][],
  preferredIds: Set<string>,
): ResolvedTimetableCell[][] {
  return [...blocks].sort((left, right) =>
    Number(preferredIds.has(right[0]!.periodDefinitionId)) - Number(preferredIds.has(left[0]!.periodDefinitionId))
    || left[0]!.startsAt.getTime() - right[0]!.startsAt.getTime()
    || right.length - left.length
    || left[0]!.periodDefinitionId.localeCompare(right[0]!.periodDefinitionId))
}

function candidateBlocks(
  weekCells: readonly ResolvedTimetableCell[],
  subject: TimetableSubjectDemand,
  classGroupId: string,
  occupied: readonly OccupiedInterval[],
  preferredIds: Set<string>,
  placements: readonly TimetablePlacement[],
  minDayGapSameSubject: number,
  blockSize?: number,
): ResolvedTimetableCell[][] {
  const minSpan = subject.minPeriodSpan
  const maxSpan = subject.maxPeriodSpan
  return sortCandidateBlocks(
    buildCandidateBlocks(weekCells, minSpan, maxSpan)
      .filter(block => blockSize === undefined || block.length === blockSize)
      .filter(block => blockIsAvailable(block, classGroupId, subject.teacherIds, occupied))
      .filter(block => !violatesSameSubjectDayGap(placements, subject.classSubjectId, block[0]!.date, minDayGapSameSubject)),
    preferredIds,
  )
}

function weekKey(date: Date): string {
  const monday = normalizeDate(date)
  const day = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1))
  return dateKey(monday)
}

function occurrenceOverlaps(startsAt: Date, endsAt: Date, otherStartsAt: Date, otherEndsAt: Date): boolean {
  return startsAt < otherEndsAt && otherStartsAt < endsAt
}

function buildCellTimes(date: Date, period: PeriodDefinition): { startsAt: Date, endsAt: Date } {
  const [startHour = 0, startMinute = 0] = period.startTime.split(':').map(Number)
  const [endHour = 0, endMinute = 0] = period.endTime.split(':').map(Number)
  return {
    startsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), startHour, startMinute)),
    endsAt: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), endHour, endMinute)),
  }
}

function calendarEventAppliesToClass(
  event: { scopeKind: CalendarEventScopeKind, scopeId?: string },
  classGroup: ClassGroup,
): boolean {
  return event.scopeKind === CalendarEventScopeKind.School
    || (event.scopeKind === CalendarEventScopeKind.GradeLevel && event.scopeId === classGroup.gradeLevelId)
    || (event.scopeKind === CalendarEventScopeKind.ClassGroup && event.scopeId === classGroup.id)
}

function validateRange(classGroup: ClassGroup, academicYear: AcademicYear, input: ResolveTimetableSpaceInput): void {
  const startDate = normalizeDate(input.startDate)
  const endDate = normalizeDate(input.endDate)
  if (startDate > endDate) {
    throw new BusinessRuleViolationError('INVALID_TIMETABLE_RANGE', 'startDate must not be after endDate')
  }
  if (classGroup.academicYearId !== academicYear.id) {
    throw new BusinessRuleViolationError('CLASS_GROUP_ACADEMIC_YEAR_MISMATCH', 'Class group does not belong to the selected academic year')
  }
  if (startDate < normalizeDate(academicYear.startDate) || endDate > normalizeDate(academicYear.endDate)) {
    throw new BusinessRuleViolationError('TIMETABLE_RANGE_OUTSIDE_ACADEMIC_YEAR', 'Timetable range must be inside the academic year')
  }
}

export async function resolveTimetableSpace(
  repositories: SchoolRepositories,
  input: ResolveTimetableSpaceInput,
  options: { excludeBreakSlots?: boolean } = {},
): Promise<ResolvedTimetableCell[]> {
  const [classGroup, academicYear] = await Promise.all([
    repositories.classGroups.findById(input.classGroupId),
    repositories.academicYears.findById(input.academicYearId),
  ])
  if (!classGroup || !academicYear || classGroup.schoolId !== academicYear.schoolId) {
    throw new BusinessRuleViolationError('TIMETABLE_SCOPE_NOT_FOUND', 'Class group or academic year was not found')
  }
  validateRange(classGroup, academicYear, input)

  const [periods, events] = await Promise.all([
    repositories.periodDefinitions.list({ academicYearId: input.academicYearId }),
    repositories.calendarEvents.list({ academicYearId: input.academicYearId }),
  ])
  const nonSchoolDates = new Set<string>()
  for (const event of events) {
    if (!calendarEventBlocksTimetable(event) || !calendarEventAppliesToClass(event, classGroup)) {
      continue
    }
    let current = normalizeDate(event.startDate)
    const last = normalizeDate(event.endDate)
    while (current <= last) {
      nonSchoolDates.add(dateKey(current))
      current = nextDate(current)
    }
  }

  const cells: ResolvedTimetableCell[] = []
  let current = normalizeDate(input.startDate)
  const last = normalizeDate(input.endDate)
  while (current <= last) {
    const currentDateKey = dateKey(current)
    if (!nonSchoolDates.has(currentDateKey)) {
      const day = DAY_BY_UTC_INDEX[current.getUTCDay()]
      const dayPeriods = periods
        .filter(period => period.dayOfWeek === day
          && period.isTeachingSlot
          && (!(options.excludeBreakSlots ?? true) || !period.isBreak))
        .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      for (const period of dayPeriods) {
        const times = buildCellTimes(current, period)
        cells.push({
          date: currentDateKey,
          weekKey: weekKey(current),
          weeklyIndex: 0,
          periodDefinitionId: period.id,
          ...times,
        })
      }
    }
    current = nextDate(current)
  }

  const nextIndexByWeek = new Map<string, number>()
  for (const cell of cells) {
    cell.weeklyIndex = nextIndexByWeek.get(cell.weekKey) ?? 0
    nextIndexByWeek.set(cell.weekKey, cell.weeklyIndex + 1)
  }
  return cells
}

function signedCalendarDaysBetween(leftDateKey: string, rightDateKey: string): number {
  const parse = (value: string) => {
    const [year, month, day] = value.split('-').map(Number)
    return Date.UTC(year!, month! - 1, day!)
  }
  return Math.round((parse(rightDateKey) - parse(leftDateKey)) / (24 * 60 * 60 * 1000))
}

function dateFromKey(dateKeyValue: string): Date {
  const [year, month, day] = dateKeyValue.split('-').map(Number)
  return normalizeDate(new Date(Date.UTC(year!, month! - 1, day!)))
}

function referenceDateForDayOfWeek(day: DayOfWeek): Date {
  const offset = DAY_OFFSET_BY_DAY_OF_WEEK[day]
  const date = new Date(TEMPLATE_REFERENCE_MONDAY)
  date.setUTCDate(date.getUTCDate() + offset)
  return normalizeDate(date)
}

function dateInWeek(weekMondayKey: string, templateDateKey: string): string {
  const offset = signedCalendarDaysBetween(dateKey(TEMPLATE_REFERENCE_MONDAY), templateDateKey)
  const date = dateFromKey(weekMondayKey)
  date.setUTCDate(date.getUTCDate() + offset)
  return dateKey(date)
}

function weekKeysInRange(startDate: Date, endDate: Date): string[] {
  const keys = new Set<string>()
  let current = normalizeDate(startDate)
  const last = normalizeDate(endDate)
  while (current <= last) {
    keys.add(weekKey(current))
    current = nextDate(current)
  }
  return [...keys].sort()
}

async function collectNonSchoolDates(
  repositories: SchoolRepositories,
  classGroup: ClassGroup,
  academicYearId: string,
  startDate: Date,
  endDate: Date,
): Promise<Set<string>> {
  const events = await repositories.calendarEvents.list({ academicYearId })
  const nonSchoolDates = new Set<string>()
  for (const event of events) {
    if (!calendarEventBlocksTimetable(event) || !calendarEventAppliesToClass(event, classGroup)) {
      continue
    }
    let current = normalizeDate(event.startDate)
    const last = normalizeDate(event.endDate)
    while (current <= last) {
      nonSchoolDates.add(dateKey(current))
      current = nextDate(current)
    }
  }
  return nonSchoolDates
}

function formatTimetableWorkloadViolation(first: UnmetTimetableWorkload): string {
  const weekLabel = first.weekKey === WEEKLY_TEMPLATE_WEEK_KEY ? 'the template week' : `week ${first.weekKey}`
  return `Could not place ${first.placed}/${first.required} periods for class subject ${first.classSubjectId} in ${weekLabel}`
}

export async function resolveWeeklyTemplateSpace(
  repositories: SchoolRepositories,
  academicYearId: string,
  options: { excludeBreakSlots?: boolean } = {},
): Promise<ResolvedTimetableCell[]> {
  const periods = await repositories.periodDefinitions.list({ academicYearId })
  const teachingPeriods = periods
    .filter(period => period.isTeachingSlot
      && (!(options.excludeBreakSlots ?? true) || !period.isBreak))
    .sort((left, right) =>
      DAY_OFFSET_BY_DAY_OF_WEEK[left.dayOfWeek] - DAY_OFFSET_BY_DAY_OF_WEEK[right.dayOfWeek]
      || left.order - right.order
      || left.id.localeCompare(right.id))
  const cells: ResolvedTimetableCell[] = []
  let weeklyIndex = 0
  for (const period of teachingPeriods) {
    const date = referenceDateForDayOfWeek(period.dayOfWeek)
    const times = buildCellTimes(date, period)
    cells.push({
      date: dateKey(date),
      weekKey: WEEKLY_TEMPLATE_WEEK_KEY,
      weeklyIndex: weeklyIndex++,
      periodDefinitionId: period.id,
      ...times,
    })
  }
  return cells
}

function placementOccupiedIntervals(
  classGroupId: string,
  placement: TimetablePlacement,
): OccupiedInterval[] {
  const intervals: OccupiedInterval[] = []
  for (const cell of placement.cells) {
    intervals.push({
      layer: 'class_group',
      layerKey: classGroupId,
      startsAt: cell.startsAt,
      endsAt: cell.endsAt,
    })
    for (const teacherId of placement.teacherIds) {
      intervals.push({
        layer: 'teacher',
        layerKey: teacherId,
        startsAt: cell.startsAt,
        endsAt: cell.endsAt,
      })
    }
  }
  return intervals
}

function teachingDateKeysInWeek(
  weekMondayKey: string,
  rangeStartKey: string,
  rangeEndKey: string,
  nonSchoolDates: ReadonlySet<string>,
): string[] {
  const monday = dateFromKey(weekMondayKey)
  const dates: string[] = []
  for (let offset = 0; offset < 5; offset++) {
    const date = new Date(monday)
    date.setUTCDate(date.getUTCDate() + offset)
    const key = dateKey(date)
    if (key >= rangeStartKey && key <= rangeEndKey && !nonSchoolDates.has(key)) {
      dates.push(key)
    }
  }
  return dates
}

export function spreadWeeklyTemplate(input: SpreadWeeklyTemplateInput): SolveTimetableResult {
  const rangeStartKey = dateKey(normalizeDate(input.startDate))
  const rangeEndKey = dateKey(normalizeDate(input.endDate))
  const occupied = [...input.occupiedIntervals]
  const placements: TimetablePlacement[] = []
  const placedBySubjectWeek: Record<string, Record<string, number>> = {}
  const weeks = weekKeysInRange(input.startDate, input.endDate)

  for (const templatePlacement of input.templatePlacements) {
    for (const currentWeekKey of weeks) {
      const concreteCells: ResolvedTimetableCell[] = []
      let blockAvailable = true
      for (const templateCell of templatePlacement.cells) {
        const period = input.periodById.get(templateCell.periodDefinitionId)
        if (!period) {
          blockAvailable = false
          break
        }
        const concreteDate = dateInWeek(currentWeekKey, templateCell.date)
        if (concreteDate < rangeStartKey || concreteDate > rangeEndKey) {
          blockAvailable = false
          break
        }
        if (input.nonSchoolDates.has(concreteDate)) {
          blockAvailable = false
          break
        }
        const times = buildCellTimes(dateFromKey(concreteDate), period)
        const cell: ResolvedTimetableCell = {
          date: concreteDate,
          weekKey: currentWeekKey,
          weeklyIndex: templateCell.weeklyIndex,
          periodDefinitionId: templateCell.periodDefinitionId,
          ...times,
        }
        if (!cellIsAvailable(cell, input.classGroupId, templatePlacement.teacherIds, occupied)) {
          blockAvailable = false
          break
        }
        concreteCells.push(cell)
      }
      if (!blockAvailable || concreteCells.length === 0) {
        continue
      }
      const placement = makePlacement({
        classSubjectId: templatePlacement.classSubjectId,
        displayLabel: templatePlacement.displayLabel,
        teacherIds: templatePlacement.teacherIds,
      }, concreteCells)
      placements.push(placement)
      occupied.push(...placementOccupiedIntervals(input.classGroupId, placement))
      const byWeek = placedBySubjectWeek[placement.classSubjectId] ?? {}
      byWeek[currentWeekKey] = (byWeek[currentWeekKey] ?? 0) + placementSlotCount(placement)
      placedBySubjectWeek[placement.classSubjectId] = byWeek
    }
  }

  const unmetWorkloads: UnmetTimetableWorkload[] = []
  for (const subject of input.subjects) {
    for (const currentWeekKey of weeks) {
      const teachingDays = teachingDateKeysInWeek(currentWeekKey, rangeStartKey, rangeEndKey, input.nonSchoolDates)
      if (teachingDays.length === 0) {
        continue
      }
      const placed = placedBySubjectWeek[subject.classSubjectId]?.[currentWeekKey] ?? 0
      if (placed < subject.periodsPerWeek) {
        unmetWorkloads.push({
          classSubjectId: subject.classSubjectId,
          weekKey: currentWeekKey,
          required: subject.periodsPerWeek,
          placed,
        })
      }
    }
  }

  if (input.options.enforceWorkloadFulfillment && unmetWorkloads.length > 0) {
    const first = unmetWorkloads[0]!
    throw new BusinessRuleViolationError(
      'TIMETABLE_WORKLOAD_UNSATISFIED',
      formatTimetableWorkloadViolation(first),
    )
  }

  return { placements, unmetWorkloads }
}

function cellIsAvailable(
  cell: ResolvedTimetableCell,
  classGroupId: string,
  teacherIds: readonly string[],
  occupied: readonly OccupiedInterval[],
): boolean {
  return !occupied.some(interval =>
    ((interval.layer === 'class_group' && interval.layerKey === classGroupId)
      || (interval.layer === 'teacher' && teacherIds.includes(interval.layerKey)))
    && occurrenceOverlaps(cell.startsAt, cell.endsAt, interval.startsAt, interval.endsAt))
}


export function solveTimetable(input: SolveTimetableInput): SolveTimetableResult {
  const occupied = [...input.occupiedIntervals]
  const placements: TimetablePlacement[] = []
  const unmetWorkloads: UnmetTimetableWorkload[] = []
  const preferredIds = new Set(input.options.preferredPeriodDefinitionIds)
  const cellsByWeek = new Map<string, ResolvedTimetableCell[]>()
  for (const cell of input.cells) {
    cellsByWeek.set(cell.weekKey, [...(cellsByWeek.get(cell.weekKey) ?? []), cell])
  }

  for (const currentWeekKey of [...cellsByWeek.keys()].sort()) {
    const weekCells = cellsByWeek.get(currentWeekKey)!
    const subjects = [...input.subjects].sort((left, right) => {
      const leftCount = candidateBlocks(
        weekCells,
        left,
        input.classGroupId,
        occupied,
        preferredIds,
        placements,
        input.options.minDayGapSameSubject,
      ).length
      const rightCount = candidateBlocks(
        weekCells,
        right,
        input.classGroupId,
        occupied,
        preferredIds,
        placements,
        input.options.minDayGapSameSubject,
      ).length
      return leftCount - rightCount
        || right.periodsPerWeek - left.periodsPerWeek
        || left.classSubjectId.localeCompare(right.classSubjectId)
    })

    for (const subject of subjects) {
      const existingCount = input.existingWorkloadByClassSubjectAndWeek?.[subject.classSubjectId]?.[currentWeekKey] ?? 0
      const slotsToPlace = Math.max(0, subject.periodsPerWeek - existingCount)
      let slotsPlaced = 0
      while (slotsPlaced < slotsToPlace) {
        const remaining = slotsToPlace - slotsPlaced
        const maxBlockSize = Math.min(subject.maxPeriodSpan, remaining)
        let placedBlock = false
        for (let blockSize = maxBlockSize; blockSize >= subject.minPeriodSpan; blockSize--) {
          const block = candidateBlocks(
            weekCells,
            subject,
            input.classGroupId,
            occupied,
            preferredIds,
            placements,
            input.options.minDayGapSameSubject,
            blockSize,
          )[0]
          if (!block) {
            continue
          }
          const placement = makePlacement({
            classSubjectId: subject.classSubjectId,
            displayLabel: subject.displayLabel,
            teacherIds: subject.teacherIds,
          }, block)
          placements.push(placement)
          occupied.push(...placementOccupiedIntervals(input.classGroupId, placement))
          slotsPlaced += placementSlotCount(placement)
          placedBlock = true
          break
        }
        if (!placedBlock) {
          break
        }
      }
      if (existingCount + slotsPlaced < subject.periodsPerWeek) {
        unmetWorkloads.push({
          classSubjectId: subject.classSubjectId,
          weekKey: currentWeekKey,
          required: subject.periodsPerWeek,
          placed: existingCount + slotsPlaced,
        })
      }
    }
  }

  if (input.options.enforceWorkloadFulfillment && unmetWorkloads.length > 0) {
    const first = unmetWorkloads[0]!
    throw new BusinessRuleViolationError(
      'TIMETABLE_WORKLOAD_UNSATISFIED',
      formatTimetableWorkloadViolation(first),
    )
  }
  return { placements, unmetWorkloads }
}

function assignmentApplies(assignment: TeacherAssignment, startsAt: Date, endsAt: Date): boolean {
  return assignment.kind === TeacherAssignmentKind.Subject
    && assignment.status === TeacherAssignmentStatus.Active
    && Boolean(assignment.classSubjectId)
    && (!assignment.startsAt || assignment.startsAt < endsAt)
    && (!assignment.endsAt || startsAt < assignment.endsAt)
}

function resolveClassSubjectPeriodsPerWeek(
  subject: ClassSubject,
  override: number | undefined,
  gradeLevelSubject?: GradeLevelSubject,
): number | undefined {
  if (override !== undefined && Number.isInteger(override) && override > 0) {
    return override
  }
  if (subject.periodsPerWeek && subject.periodsPerWeek > 0) {
    return subject.periodsPerWeek
  }
  if (gradeLevelSubject?.periodsPerWeek && gradeLevelSubject.periodsPerWeek > 0) {
    return gradeLevelSubject.periodsPerWeek
  }
  if (subject.coefficient && subject.coefficient > 0) {
    return Math.max(2, Math.round(subject.coefficient) + 1)
  }
  return undefined
}

function resolvePositiveSpan(value: number | undefined): number | undefined {
  if (value !== undefined && Number.isInteger(value) && value > 0) {
    return value
  }
  return undefined
}

function resolveClassSubjectPeriodSpan(
  subject: ClassSubject,
  placementParameters: TimetablePlacementParameters | undefined,
  gradeLevelSubject: GradeLevelSubject | undefined,
  defaults: Pick<TimetableGenerationDefaults, 'defaultMinPeriodSpan' | 'defaultMaxPeriodSpan'>,
): { minPeriodSpan: number, maxPeriodSpan: number } {
  const minPeriodSpan = resolvePositiveSpan(placementParameters?.minPeriodSpanByClassSubjectId?.[subject.id])
    ?? resolvePositiveSpan(subject.minPeriodSpan)
    ?? resolvePositiveSpan(gradeLevelSubject?.minPeriodSpan)
    ?? defaults.defaultMinPeriodSpan
  const maxPeriodSpan = Math.max(
    minPeriodSpan,
    resolvePositiveSpan(placementParameters?.maxPeriodSpanByClassSubjectId?.[subject.id])
      ?? resolvePositiveSpan(subject.maxPeriodSpan)
      ?? resolvePositiveSpan(gradeLevelSubject?.maxPeriodSpan)
      ?? defaults.defaultMaxPeriodSpan,
  )
  return { minPeriodSpan, maxPeriodSpan }
}

function teacherIdsForClassSubjectAt(
  classSubjectId: string,
  assignments: readonly TeacherAssignment[],
  occurrenceStartsAt: Date,
  occurrenceEndsAt: Date,
): string[] {
  return [...new Set(assignments
    .filter(assignment => assignment.classSubjectId === classSubjectId && assignmentApplies(assignment, occurrenceStartsAt, occurrenceEndsAt))
    .map(assignment => assignment.teacherId))]
}

function resolveLessonTeacherIds(
  lesson: LessonSessionEntity,
  assignments: readonly TeacherAssignment[],
): string[] {
  if (lesson.timetableTeacherIds.length > 0) {
    return lesson.timetableTeacherIds
  }
  return teacherIdsForClassSubjectAt(lesson.classSubjectId, assignments, lesson.startsAt, lesson.endsAt)
}

function assessmentIsTimed(assessment: Assessment): assessment is Assessment & { startsAt: Date, endsAt: Date } {
  return assessment.kind !== AssessmentKind.Homework && Boolean(assessment.startsAt && assessment.endsAt)
}

async function buildOccupiedIntervals(
  repositories: SchoolRepositories,
  classGroupId: string,
  startsAt: Date,
  endsAt: Date,
  demands: TimetableSubjectDemand[],
  scope: 'spread' | 'unavailability-only' = 'spread',
): Promise<OccupiedInterval[]> {
  const relevantTeacherIds = new Set(demands.flatMap(demand => demand.teacherIds))
  const unavailabilities = relevantTeacherIds.size > 0
    ? await repositories.teacherUnavailabilities.list({ teacherId: { $in: [...relevantTeacherIds] }, isActive: true })
    : []
  const occupied: OccupiedInterval[] = []
  for (const rule of unavailabilities) {
    for (const interval of expandTeacherUnavailability(rule, startsAt, endsAt)) {
      occupied.push({
        layer: 'teacher',
        layerKey: interval.teacherId,
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        sourceSessionId: `teacher-unavailability:${interval.sourceId}`,
      })
    }
  }
  if (scope === 'unavailability-only') {
    return occupied
  }

  const [lessons, activities, assignments, assessments] = await Promise.all([
    repositories.lessonSessions.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
    repositories.activitySessions.list({ classGroupId }),
    repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
    repositories.assessments.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
  ])
  for (const lesson of lessons) {
    for (const teacherId of resolveLessonTeacherIds(lesson, assignments)) {
      relevantTeacherIds.add(teacherId)
    }
  }
  for (const assessment of assessments.filter(assessmentIsTimed)) {
    for (const teacherId of teacherIdsForClassSubjectAt(assessment.classSubjectId, assignments, assessment.startsAt, assessment.endsAt)) {
      relevantTeacherIds.add(teacherId)
    }
  }
  for (const lesson of lessons) {
    if (lesson.status === OccurrenceStatus.Cancelled) {
      continue
    }
    if (lesson.classGroupId === classGroupId) {
      occupied.push({ layer: 'class_group', layerKey: classGroupId, startsAt: lesson.startsAt, endsAt: lesson.endsAt, sourceSessionId: lesson.id })
    }
    for (const teacherId of resolveLessonTeacherIds(lesson, assignments)) {
      occupied.push({ layer: 'teacher', layerKey: teacherId, startsAt: lesson.startsAt, endsAt: lesson.endsAt, sourceSessionId: lesson.id })
    }
  }
  for (const activity of activities) {
    if (activity.status !== OccurrenceStatus.Cancelled
      && occurrenceOverlaps(startsAt, endsAt, activity.startsAt, activity.endsAt)) {
      occupied.push({ layer: 'class_group', layerKey: classGroupId, startsAt: activity.startsAt, endsAt: activity.endsAt, sourceSessionId: activity.id })
    }
  }
  for (const assessment of assessments.filter(assessmentIsTimed)) {
    if (!occurrenceOverlaps(startsAt, endsAt, assessment.startsAt, assessment.endsAt)) {
      continue
    }
    if (assessment.classGroupId === classGroupId) {
      occupied.push({ layer: 'class_group', layerKey: classGroupId, startsAt: assessment.startsAt, endsAt: assessment.endsAt, sourceSessionId: assessment.id })
    }
    for (const teacherId of teacherIdsForClassSubjectAt(assessment.classSubjectId, assignments, assessment.startsAt, assessment.endsAt)) {
      occupied.push({ layer: 'teacher', layerKey: teacherId, startsAt: assessment.startsAt, endsAt: assessment.endsAt, sourceSessionId: assessment.id })
    }
  }
  return occupied
}

function clockTimeOnDate(date: Date, time: string): Date {
  const [hour = 0, minute = 0] = time.split(':').map(Number)
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute))
}

function expandWeeklyUnavailabilityForTemplate(
  rule: TeacherUnavailability,
  generationStart: Date,
  generationEnd: Date,
): OccupiedInterval[] {
  if (!rule.isActive
    || rule.recurrence !== TeacherUnavailabilityRecurrence.Weekly
    || !rule.dayOfWeek
    || !rule.startTime
    || !rule.endTime
    || !rule.effectiveFrom
    || !rule.effectiveUntil) {
    return []
  }
  const generationRangeStart = normalizeDate(generationStart)
  const generationRangeEnd = normalizeDate(generationEnd)
  const ruleStart = normalizeDate(rule.effectiveFrom)
  const ruleEnd = normalizeDate(rule.effectiveUntil)
  if (ruleEnd < generationRangeStart || ruleStart > generationRangeEnd) {
    return []
  }
  const templateDate = referenceDateForDayOfWeek(rule.dayOfWeek)
  return [{
    layer: 'teacher',
    layerKey: rule.teacherId,
    startsAt: clockTimeOnDate(templateDate, rule.startTime),
    endsAt: clockTimeOnDate(templateDate, rule.endTime),
    sourceSessionId: `teacher-unavailability:${rule.id}`,
  }]
}

async function buildTemplateOccupiedIntervals(
  repositories: SchoolRepositories,
  demands: TimetableSubjectDemand[],
  generationStart: Date,
  generationEnd: Date,
): Promise<OccupiedInterval[]> {
  const relevantTeacherIds = new Set(demands.flatMap(demand => demand.teacherIds))
  if (relevantTeacherIds.size === 0) {
    return []
  }
  const unavailabilities = await repositories.teacherUnavailabilities.list({
    teacherId: { $in: [...relevantTeacherIds] },
    isActive: true,
  })
  return unavailabilities.flatMap(rule =>
    expandWeeklyUnavailabilityForTemplate(rule, generationStart, generationEnd))
}

export class TimetableGenerationServiceWorkflow extends BaseServiceWorkflow {
  async generateClassGroupTimetable(input: GenerateClassGroupTimetableInput): Promise<GenerateClassGroupTimetableResult> {
    const context = await this.requireGenerationContext(input)
    await this.authorizeCreate(context.classGroup)
    return this.baseService.atomicExecution.execute(() => this.generateClassGroupInternal(input, context, true))
  }

  async generateSchoolTimetable(input: GenerateSchoolTimetableInput): Promise<GenerateSchoolTimetableResult> {
    const academicYear = await this.baseService.repositories.academicYears.findById(input.academicYearId)
    if (!academicYear || academicYear.schoolId !== this.baseService.actor.schoolId) {
      throw new BusinessRuleViolationError('ACADEMIC_YEAR_NOT_FOUND', 'Academic year was not found')
    }
    const groups = await this.baseService.repositories.classGroups.list({ academicYearId: input.academicYearId })
    const gradeLevels = await this.baseService.repositories.gradeLevels.findByIds([...new Set(groups.map(group => group.gradeLevelId))])
    const orderByGrade = new Map(gradeLevels.map(grade => [grade.id, grade.order]))
    groups.sort((left, right) =>
      (orderByGrade.get(left.gradeLevelId) ?? Number.MAX_SAFE_INTEGER) - (orderByGrade.get(right.gradeLevelId) ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id))
    for (const group of groups) {
      await this.authorizeCreate(group)
    }
    return this.baseService.atomicExecution.execute(async () => {
      const school = await this.baseService.repositories.schools.findById(academicYear.schoolId)
      const generationMode = input.options?.generationMode ?? school?.timetableGenerationMode ?? TimetableGenerationMode.Weekly
      if (generationMode === TimetableGenerationMode.Weekly) {
        return this.generateSchoolWeeklyInternal(input, groups)
      }
      const results: GenerateClassGroupTimetableResult[] = []
      for (const group of groups) {
        const classInput = { ...input, classGroupId: group.id }
        const context = await this.requireGenerationContext(classInput)
        results.push(await this.generateClassGroupInternal(classInput, context, true))
      }
      return { academicYearId: input.academicYearId, classGroups: results, skippedClassGroupIds: [] }
    })
  }

  async publishClassGroupTimetable(input: PublishClassGroupTimetableInput): Promise<PublishClassGroupTimetableResult> {
    const classGroup = await this.requireClassGroup(input.classGroupId)
    await this.authorizePublish(classGroup)
    return this.baseService.atomicExecution.execute(() => this.publishInternal(input, classGroup))
  }

  async republishClassGroupTimetable(input: RepublishClassGroupTimetableInput): Promise<RepublishClassGroupTimetableResult> {
    const context = await this.requireGenerationContext(input)
    await this.authorizeCreate(context.classGroup)
    await this.authorizePublish(context.classGroup)
    return this.baseService.atomicExecution.execute(async () => {
      await this.discardRegeneratableSessionsInRange(input.classGroupId, input.startDate, input.endDate)
      const generation = await this.generateClassGroupInternal(input, context, false)
      const publication = await this.publishInternal(input, context.classGroup)
      return { generation, publication }
    })
  }

  private resolveGenerationOptions(
    input: GenerateClassGroupTimetableInput,
    school: School,
  ): TimetableGenerationDefaults {
    return {
      generationMode: input.options?.generationMode ?? school.timetableGenerationMode,
      enforceWorkloadFulfillment: input.options?.enforceWorkloadFulfillment ?? school.timetableEnforceWorkloadFulfillment,
      excludeBreakSlots: input.options?.excludeBreakSlots ?? school.timetableExcludeBreakSlots,
      minDayGapSameSubject: input.options?.minDayGapSameSubject ?? school.timetableMinDayGapSameSubject,
      preferredPeriodDefinitionIds: input.options?.preferredPeriodDefinitionIds ?? school.timetablePreferredPeriodDefinitionIds,
      allowUnassignedTeacherPlacements: input.options?.allowUnassignedTeacherPlacements ?? school.timetableAllowUnassignedTeacherPlacements,
      useHomeroomTeacherFallback: input.options?.useHomeroomTeacherFallback ?? school.timetableUseHomeroomTeacherFallback,
      defaultMinPeriodSpan: school.timetableMinPeriodSpan,
      defaultMaxPeriodSpan: school.timetableMaxPeriodSpan,
    }
  }

  private async buildClassDemands(
    input: GenerateClassGroupTimetableInput,
    context: { classGroup: ClassGroup },
    options: TimetableGenerationDefaults,
    rangeStart: Date,
    rangeEnd: Date,
  ): Promise<TimetableSubjectDemand[]> {
    const [classSubjects, assignments] = await Promise.all([
      this.baseService.repositories.classSubjects.list({ classGroupId: input.classGroupId }),
      this.baseService.repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
    ])
    const offered = classSubjects.filter(subject => subject.isOffered)
    const gradeLevelSubjectIds = [...new Set(offered
      .map(subject => subject.gradeLevelSubjectId)
      .filter((gradeLevelSubjectId): gradeLevelSubjectId is string => Boolean(gradeLevelSubjectId)))]
    const gradeLevelSubjects = gradeLevelSubjectIds.length > 0
      ? await this.baseService.repositories.gradeLevelSubjects.findByIds(gradeLevelSubjectIds)
      : []
    const gradeLevelSubjectById = new Map(gradeLevelSubjects.map(gradeLevelSubject => [gradeLevelSubject.id, gradeLevelSubject]))
    const subjectEntities = await this.baseService.repositories.subjects.findByIds([...new Set(offered.map(subject => subject.subjectId))])
    const labelBySubjectId = new Map(subjectEntities.map(subject => [subject.id, subject.name]))
    const homeroomTeacherId = options.useHomeroomTeacherFallback
      ? await this.resolveHomeroomTeacherId(context.classGroup)
      : undefined
    return offered.map(subject => this.buildDemand(
      subject,
      assignments,
      input,
      options,
      homeroomTeacherId,
      labelBySubjectId.get(subject.subjectId) ?? subject.subjectId,
      rangeStart,
      rangeEnd,
      subject.gradeLevelSubjectId ? gradeLevelSubjectById.get(subject.gradeLevelSubjectId) : undefined,
    ))
  }

  private async persistPlacementSessions(
    placements: readonly TimetablePlacement[],
    context: { classGroup: ClassGroup },
  ): Promise<LessonSessionEntity[]> {
    const sessions: LessonSessionEntity[] = []
    for (const placement of placements) {
      const firstCell = placement.cells[0]!
      const lastCell = placement.cells[placement.cells.length - 1]!
      const session = new LessonSession({
        id: randomUUID(),
        schoolId: context.classGroup.schoolId,
        classGroupId: context.classGroup.id,
        classSubjectId: placement.classSubjectId,
        timetableGenerated: TimetableGenerated.Draft,
        timetableTeacherIds: placement.teacherIds,
        status: OccurrenceStatus.Pending,
        isException: false,
        startsAt: firstCell.startsAt,
        endsAt: lastCell.endsAt,
        displayLabel: placement.displayLabel,
      })
      await this.baseService.repositories.lessonSessions.save(session)
      sessions.push(session)
    }
    return sessions
  }

  private async generateClassGroupInternal(
    input: GenerateClassGroupTimetableInput,
    context: { classGroup: ClassGroup, academicYear: AcademicYear, school: School },
    rejectExistingDrafts: boolean,
  ): Promise<GenerateClassGroupTimetableResult> {
    if (rejectExistingDrafts) {
      await this.discardRegeneratableSessionsInRange(input.classGroupId, input.startDate, input.endDate)
    }
    const options = this.resolveGenerationOptions(input, context.school)
    if (options.generationMode === TimetableGenerationMode.Weekly) {
      return this.generateClassGroupWeeklyInternal(input, context, options)
    }
    const rangeStart = normalizeDate(input.startDate)
    const rangeEnd = endExclusive(input.endDate)
    const cells = await resolveTimetableSpace(this.baseService.repositories, input, { excludeBreakSlots: options.excludeBreakSlots })
    const demands = await this.buildClassDemands(input, context, options, rangeStart, rangeEnd)
    const occupiedIntervals = await buildOccupiedIntervals(this.baseService.repositories, input.classGroupId, rangeStart, rangeEnd, demands)
    const existingWorkloadByClassSubjectAndWeek = await this.buildExistingWorkload(
      input.classGroupId,
      input.academicYearId,
      rangeStart,
      rangeEnd,
      options.excludeBreakSlots,
    )
    const solved = solveTimetable({
      classGroupId: input.classGroupId,
      cells,
      subjects: demands,
      occupiedIntervals,
      existingWorkloadByClassSubjectAndWeek,
      options,
    })
    const sessions = await this.persistPlacementSessions(solved.placements, context)
    return { classGroupId: input.classGroupId, sessions, ...solved }
  }

  private async generateClassGroupWeeklyInternal(
    input: GenerateClassGroupTimetableInput,
    context: { classGroup: ClassGroup, academicYear: AcademicYear, school: School },
    options: TimetableGenerationDefaults,
  ): Promise<GenerateClassGroupTimetableResult> {
    const rangeStart = normalizeDate(input.startDate)
    const rangeEnd = endExclusive(input.endDate)
    const demands = await this.buildClassDemands(input, context, options, rangeStart, rangeEnd)
    const [templateCells, periods] = await Promise.all([
      resolveWeeklyTemplateSpace(this.baseService.repositories, input.academicYearId, { excludeBreakSlots: options.excludeBreakSlots }),
      this.baseService.repositories.periodDefinitions.list({ academicYearId: input.academicYearId }),
    ])
    const periodById = new Map(periods.map(period => [period.id, period]))
    const templateUnavailability = await buildTemplateOccupiedIntervals(
      this.baseService.repositories,
      demands,
      input.startDate,
      input.endDate,
    )
    const templateSolved = solveTimetable({
      classGroupId: input.classGroupId,
      cells: templateCells,
      subjects: demands,
      occupiedIntervals: templateUnavailability,
      options: { ...options, enforceWorkloadFulfillment: false },
    })
    const nonSchoolDates = await collectNonSchoolDates(
      this.baseService.repositories,
      context.classGroup,
      input.academicYearId,
      input.startDate,
      input.endDate,
    )
    const spreadOccupied = await buildOccupiedIntervals(
      this.baseService.repositories,
      input.classGroupId,
      rangeStart,
      rangeEnd,
      demands,
    )
    const spread = spreadWeeklyTemplate({
      classGroupId: input.classGroupId,
      templatePlacements: templateSolved.placements,
      periodById,
      startDate: input.startDate,
      endDate: input.endDate,
      nonSchoolDates,
      occupiedIntervals: spreadOccupied,
      subjects: demands,
      options,
    })
    const sessions = await this.persistPlacementSessions(spread.placements, context)
    return { classGroupId: input.classGroupId, sessions, ...spread }
  }

  private async generateSchoolWeeklyInternal(
    input: GenerateSchoolTimetableInput,
    groups: ClassGroup[],
  ): Promise<GenerateSchoolTimetableResult> {
    for (const group of groups) {
      await this.discardRegeneratableSessionsInRange(group.id, input.startDate, input.endDate)
    }
    const rangeStart = normalizeDate(input.startDate)
    const rangeEnd = endExclusive(input.endDate)
    const firstContext = await this.requireGenerationContext({ ...input, classGroupId: groups[0]!.id })
    const sharedOptions = this.resolveGenerationOptions({ ...input, classGroupId: groups[0]!.id }, firstContext.school)
    const [templateCells, periods] = await Promise.all([
      resolveWeeklyTemplateSpace(this.baseService.repositories, input.academicYearId, { excludeBreakSlots: sharedOptions.excludeBreakSlots }),
      this.baseService.repositories.periodDefinitions.list({ academicYearId: input.academicYearId }),
    ])
    const periodById = new Map(periods.map(period => [period.id, period]))
    let sharedTemplateOccupied: OccupiedInterval[] = []
    const prepared = []
    for (const group of groups) {
      const classInput = { ...input, classGroupId: group.id }
      const context = await this.requireGenerationContext(classInput)
      const options = this.resolveGenerationOptions(classInput, context.school)
      const demands = await this.buildClassDemands(classInput, context, options, rangeStart, rangeEnd)
      const templateUnavailability = await buildTemplateOccupiedIntervals(
        this.baseService.repositories,
        demands,
        input.startDate,
        input.endDate,
      )
      const templateSolved = solveTimetable({
        classGroupId: group.id,
        cells: templateCells,
        subjects: demands,
        occupiedIntervals: [...sharedTemplateOccupied, ...templateUnavailability],
        options: { ...options, enforceWorkloadFulfillment: false },
      })
      for (const placement of templateSolved.placements) {
        sharedTemplateOccupied.push(...placementOccupiedIntervals(group.id, placement))
      }
      prepared.push({ classInput, context, options, demands, templateSolved })
    }

    const results: GenerateClassGroupTimetableResult[] = []
    for (const entry of prepared) {
      const nonSchoolDates = await collectNonSchoolDates(
        this.baseService.repositories,
        entry.context.classGroup,
        input.academicYearId,
        input.startDate,
        input.endDate,
      )
      const spreadOccupied = await buildOccupiedIntervals(
        this.baseService.repositories,
        entry.classInput.classGroupId,
        rangeStart,
        rangeEnd,
        entry.demands,
      )
      const spread = spreadWeeklyTemplate({
        classGroupId: entry.classInput.classGroupId,
        templatePlacements: entry.templateSolved.placements,
        periodById,
        startDate: input.startDate,
        endDate: input.endDate,
        nonSchoolDates,
        occupiedIntervals: spreadOccupied,
        subjects: entry.demands,
        options: entry.options,
      })
      const sessions = await this.persistPlacementSessions(spread.placements, entry.context)
      results.push({ classGroupId: entry.classInput.classGroupId, sessions, ...spread })
    }
    return { academicYearId: input.academicYearId, classGroups: results, skippedClassGroupIds: [] }
  }

  private buildDemand(
    subject: ClassSubject,
    assignments: TeacherAssignment[],
    input: GenerateClassGroupTimetableInput,
    options: TimetableGenerationDefaults,
    homeroomTeacherId: string | undefined,
    displayLabel: string,
    startsAt: Date,
    endsAt: Date,
    gradeLevelSubject?: GradeLevelSubject,
  ): TimetableSubjectDemand {
    const teacherIds = [...new Set(assignments
      .filter(assignment => assignment.classSubjectId === subject.id && assignmentApplies(assignment, startsAt, endsAt))
      .map(assignment => assignment.teacherId))]
    if (teacherIds.length === 0 && options.useHomeroomTeacherFallback && homeroomTeacherId) {
      teacherIds.push(homeroomTeacherId)
    }
    if (teacherIds.length === 0 && !options.allowUnassignedTeacherPlacements) {
      throw new BusinessRuleViolationError('TIMETABLE_TEACHER_ASSIGNMENT_REQUIRED', `Class subject ${subject.id} has no active teacher assignment`)
    }
    const periodsPerWeek = resolveClassSubjectPeriodsPerWeek(
      subject,
      input.placementParameters?.periodsPerWeekByClassSubjectId?.[subject.id],
      gradeLevelSubject,
    )
    if (!periodsPerWeek) {
      throw new BusinessRuleViolationError('TIMETABLE_WORKLOAD_REQUIRED', `Class subject ${displayLabel} has no valid periodsPerWeek`)
    }
    const { minPeriodSpan, maxPeriodSpan } = resolveClassSubjectPeriodSpan(
      subject,
      input.placementParameters,
      gradeLevelSubject,
      options,
    )
    return {
      classSubjectId: subject.id,
      displayLabel,
      periodsPerWeek,
      minPeriodSpan,
      maxPeriodSpan,
      teacherIds,
    }
  }

  private async resolveHomeroomTeacherId(classGroup: ClassGroup): Promise<string | undefined> {
    if (!classGroup.homeroomStaffId) {
      return undefined
    }
    const staff = await this.baseService.repositories.staffMembers.findById(classGroup.homeroomStaffId)
    if (!staff?.subjectId) {
      return undefined
    }
    const teacher = await this.baseService.repositories.teachers.findOne({
      schoolId: classGroup.schoolId,
      subjectId: staff.subjectId,
      isActive: true,
    })
    return teacher?.id
  }

  private async publishInternal(
    input: PublishClassGroupTimetableInput,
    classGroup: ClassGroup,
  ): Promise<PublishClassGroupTimetableResult> {
    const drafts = (await this.generatedSessionsInRange(input.classGroupId, input.startDate, input.endDate))
      .filter(session => session.timetableGenerated === TimetableGenerated.Draft)
    const assignments = await this.baseService.repositories.teacherAssignments.list({
      kind: TeacherAssignmentKind.Subject,
      status: TeacherAssignmentStatus.Active,
    })
    const publishable: Array<{ draft: LessonSessionEntity, teacherIds: string[] }> = []
    const skippedSessionIds: string[] = []
    for (const draft of drafts) {
      const teacherIds = draft.timetableTeacherIds.length > 0
        ? draft.timetableTeacherIds
        : [...new Set(assignments
            .filter(assignment => assignment.classSubjectId === draft.classSubjectId && assignmentApplies(assignment, draft.startsAt, draft.endsAt))
            .map(assignment => assignment.teacherId))]
      try {
        await assertNoSessionConflict(this.baseService.repositories, {
          classGroupId: classGroup.id,
          teacherIds,
          startsAt: draft.startsAt,
          endsAt: draft.endsAt,
          excludeSessionId: draft.id,
        })
        publishable.push({ draft, teacherIds })
      }
      catch (error) {
        if (input.sessionConflictPolicy === 'skip'
          && error instanceof BusinessRuleViolationError
          && error.code === 'SCHEDULE_CONFLICT') {
          skippedSessionIds.push(draft.id)
          continue
        }
        throw error
      }
    }
    const publishedSessionIds: string[] = []
    for (const { draft, teacherIds } of publishable) {
      const published = draft.copyWith({
        timetableGenerated: TimetableGenerated.Published,
        timetableTeacherIds: teacherIds,
      })
      await this.baseService.repositories.lessonSessions.save(published)
      publishedSessionIds.push(published.id)
    }
    return { classGroupId: classGroup.id, publishedSessionIds, skippedSessionIds }
  }

  private async buildExistingWorkload(
    classGroupId: string,
    academicYearId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBreakSlots: boolean,
  ): Promise<Record<string, Record<string, number>>> {
    const [sessions, periods] = await Promise.all([
      this.baseService.repositories.lessonSessions.list({
        classGroupId,
        startsAt: { $lt: endsAt },
        endsAt: { $gt: startsAt },
      }),
      this.baseService.repositories.periodDefinitions.list({ academicYearId }),
    ])
    const workload: Record<string, Record<string, number>> = {}
    for (const session of sessions) {
      if (session.status === OccurrenceStatus.Cancelled) {
        continue
      }
      const sessionWeek = weekKey(session.startsAt)
      const byWeek = workload[session.classSubjectId] ?? {}
      byWeek[sessionWeek] = (byWeek[sessionWeek] ?? 0) + countSessionPeriodSlots(session, periods, excludeBreakSlots)
      workload[session.classSubjectId] = byWeek
    }
    return workload
  }

  private async requireGenerationContext(input: GenerateClassGroupTimetableInput) {
    const [classGroup, academicYear] = await Promise.all([
      this.baseService.repositories.classGroups.findById(input.classGroupId),
      this.baseService.repositories.academicYears.findById(input.academicYearId),
    ])
    if (!classGroup || !academicYear || classGroup.schoolId !== academicYear.schoolId) {
      throw new BusinessRuleViolationError('TIMETABLE_SCOPE_NOT_FOUND', 'Class group or academic year was not found')
    }
    this.checkActorSchool(classGroup.schoolId)
    validateRange(classGroup, academicYear, input)
    const school = await this.baseService.repositories.schools.findById(classGroup.schoolId)
    if (!school) {
      throw new BusinessRuleViolationError('SCHOOL_NOT_FOUND', 'School was not found')
    }
    return { classGroup, academicYear, school }
  }

  private shouldPreserveGeneratedSession(session: LessonSessionEntity): boolean {
    return session.status === OccurrenceStatus.Completed
      || (session.status === OccurrenceStatus.Pending && session.isException)
  }

  private async discardRegeneratableSessionsInRange(classGroupId: string, startDate: Date, endDate: Date): Promise<void> {
    const sessions = await this.generatedSessionsInRange(classGroupId, startDate, endDate)
    for (const session of sessions) {
      if (this.shouldPreserveGeneratedSession(session)) {
        continue
      }
      await this.baseService.repositories.lessonSessions.delete(session.id)
    }
  }

  private async generatedSessionsInRange(classGroupId: string, startDate: Date, endDate: Date): Promise<LessonSessionEntity[]> {
    const start = normalizeDate(startDate)
    const end = endExclusive(endDate)
    const sessions = await this.baseService.repositories.lessonSessions.list({
      classGroupId,
      startsAt: { $lt: end },
      endsAt: { $gt: start },
    })
    return sessions.filter(session => Boolean(session.timetableGenerated))
  }

  private async authorizeCreate(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    await operationModule(SchedulingOperations.timetableCreate, { classGroupId: classGroup.id })(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])
  }

  private async authorizePublish(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    await operationModule(SchedulingOperations.timetablePublish, { classGroupId: classGroup.id })(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])
  }
}
