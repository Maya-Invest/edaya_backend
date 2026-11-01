import type { AcademicYear, CalendarEvent, ClassGroup, PeriodDefinition } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type {
  OccupiedInterval,
  ResolvedTimetableCell,
  ResolveTimetableSpaceInput,
  SolveTimetableInput,
  SolveTimetableResult,
  SpreadWeeklyTemplateInput,
  TimetablePlacement,
  TimetableSubjectDemand,
  UnmetTimetableWorkload,
} from './types'
import {
  BusinessRuleViolationError,
  calendarEventBlocksTimetable,
  CalendarEventScopeKind,
  civilDateKey,
  DayOfWeek,
  normalizeDate,
} from '@edaya/core'
import { TimetableOccupancyIndex } from './occupancy-index'
import { WEEKLY_TEMPLATE_WEEK_KEY } from './types'

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

export function endExclusive(date: Date): Date {
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

export function countSessionPeriodSlots(
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
    const day = grouped.get(cell.date) ?? []
    day.push(cell)
    grouped.set(cell.date, day)
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
  occupied: TimetableOccupancyIndex,
): boolean {
  return block.every(cell => occupied.isAvailable(cell, classGroupId, teacherIds))
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

function searchOrder(value: string, attempt: number): number {
  let hash = attempt
  for (const char of value)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return hash >>> 0
}

class CandidateBlockCache {
  private readonly blocksBySpan = new Map<string, ResolvedTimetableCell[][]>()

  constructor(private readonly weekCells: readonly ResolvedTimetableCell[], private readonly preferredIds: Set<string>, private readonly searchAttempt = 0) {}

  get(subject: TimetableSubjectDemand): ResolvedTimetableCell[][] {
    const key = `${subject.minPeriodSpan}:${subject.maxPeriodSpan}`
    let blocks = this.blocksBySpan.get(key)
    if (!blocks) {
      blocks = sortCandidateBlocks(buildCandidateBlocks(this.weekCells, subject.minPeriodSpan, subject.maxPeriodSpan), this.preferredIds)
      if (this.searchAttempt > 0) {
        blocks.sort((left, right) => Number(this.preferredIds.has(right[0]!.periodDefinitionId)) - Number(this.preferredIds.has(left[0]!.periodDefinitionId))
          || searchOrder(`${left[0]!.date}:${left[0]!.periodDefinitionId}`, this.searchAttempt) - searchOrder(`${right[0]!.date}:${right[0]!.periodDefinitionId}`, this.searchAttempt))
      }
      this.blocksBySpan.set(key, blocks)
    }
    return blocks
  }
}

interface PlacementSearchContext {
  candidates: CandidateBlockCache
  subject: TimetableSubjectDemand
  classGroupId: string
  occupied: TimetableOccupancyIndex
  preferredIds: Set<string>
  placements: readonly TimetablePlacement[]
  minDayGapSameSubject: number
  existingSubjectDates?: readonly { classSubjectId: string, date: string }[]
}

function candidateBlocks(context: PlacementSearchContext, blockSize?: number): ResolvedTimetableCell[][] {
  return context.candidates.get(context.subject)
    .filter(block => blockSize === undefined || block.length === blockSize)
    .filter(block => blockIsAvailable(block, context.classGroupId, context.subject.teacherIds, context.occupied))
    .filter(block => !violatesSameSubjectDayGap(context.placements, context.subject.classSubjectId, block[0]!.date, context.minDayGapSameSubject))
    .filter(block => !context.existingSubjectDates?.some(existing => existing.classSubjectId === context.subject.classSubjectId
      && calendarDaysBetween(existing.date, block[0]!.date) < context.minDayGapSameSubject))
}

const PLACEMENT_SCORE_SLOT_WEIGHT = 1_000_000
const PLACEMENT_SCORE_SPAN_WEIGHT = 1_000

function preferredPeriodBonus(
  block: readonly ResolvedTimetableCell[],
  preferredIds: Set<string>,
): number {
  return preferredIds.has(block[0]!.periodDefinitionId) ? 1 : 0
}

function estimateGreedyPlaceableSlots(
  context: PlacementSearchContext,
  remaining: number,
): number {
  const occupied = context.occupied.fork()
  const placements = context.placements.filter(placement => placement.classSubjectId === context.subject.classSubjectId)
  let slotsPlaced = 0
  let slotsRemaining = remaining

  while (slotsRemaining > 0) {
    const maxBlockSize = Math.min(context.subject.maxPeriodSpan, slotsRemaining)
    let placedBlock = false
    for (let blockSize = maxBlockSize; blockSize >= context.subject.minPeriodSpan; blockSize--) {
      const block = candidateBlocks({ ...context, occupied, placements }, blockSize)[0]
      if (!block) {
        continue
      }
      const placement = makePlacement({
        classSubjectId: context.subject.classSubjectId,
        displayLabel: context.subject.displayLabel,
        teacherIds: context.subject.teacherIds,
      }, block)
      placements.push(placement)
      occupied.add(placementOccupiedIntervals(context.classGroupId, placement))
      slotsPlaced += placementSlotCount(placement)
      slotsRemaining -= placementSlotCount(placement)
      placedBlock = true
      break
    }
    if (!placedBlock) {
      break
    }
  }
  return slotsPlaced
}

function scorePlacementCandidate(
  block: readonly ResolvedTimetableCell[],
  remaining: number,
  context: PlacementSearchContext,
): number {
  const placement = makePlacement({
    classSubjectId: context.subject.classSubjectId,
    displayLabel: context.subject.displayLabel,
    teacherIds: context.subject.teacherIds,
  }, block)
  const futureSlots = estimateGreedyPlaceableSlots({
    ...context,
    occupied: context.occupied.fork(placementOccupiedIntervals(context.classGroupId, placement)),
    placements: [...context.placements, placement],
  }, remaining - block.length)
  const totalPlaceable = block.length + futureSlots
  return totalPlaceable * PLACEMENT_SCORE_SLOT_WEIGHT
    + block.length * PLACEMENT_SCORE_SPAN_WEIGHT
    + preferredPeriodBonus(block, context.preferredIds)
}

function choosePlacementBlock(
  context: PlacementSearchContext,
  remaining: number,
): readonly ResolvedTimetableCell[] | undefined {
  const maxBlockSize = Math.min(context.subject.maxPeriodSpan, remaining)
  let bestBlock: readonly ResolvedTimetableCell[] | undefined
  let bestScore = -1
  let bestBlockSize = -1
  let bestCandidateIndex = Number.POSITIVE_INFINITY

  for (let blockSize = maxBlockSize; blockSize >= context.subject.minPeriodSpan; blockSize--) {
    const candidates = candidateBlocks(context, blockSize)
    for (let candidateIndex = 0; candidateIndex < candidates.length; candidateIndex++) {
      const block = candidates[candidateIndex]!
      const score = scorePlacementCandidate(block, remaining, context)
      const isBetter = score > bestScore
        || (score === bestScore && blockSize > bestBlockSize)
        || (score === bestScore && blockSize === bestBlockSize && candidateIndex < bestCandidateIndex)
      if (!isBetter) {
        continue
      }
      bestScore = score
      bestBlock = block
      bestBlockSize = blockSize
      bestCandidateIndex = candidateIndex
    }
  }
  return bestBlock
}

export function weekKey(date: Date): string {
  const monday = normalizeDate(date)
  const day = monday.getUTCDay()
  monday.setUTCDate(monday.getUTCDate() - (day === 0 ? 6 : day - 1))
  return dateKey(monday)
}

export function occurrenceOverlaps(startsAt: Date, endsAt: Date, otherStartsAt: Date, otherEndsAt: Date): boolean {
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

export function validateRange(classGroup: ClassGroup, academicYear: AcademicYear, input: ResolveTimetableSpaceInput): void {
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
  repositories: Pick<SchoolRepositories, 'classGroups' | 'academicYears' | 'periodDefinitions' | 'calendarEvents'>,
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
  return buildTimetableSpace(classGroup, periods, events, input, options)
}

export function buildTimetableSpace(
  classGroup: ClassGroup,
  periods: readonly PeriodDefinition[],
  events: readonly CalendarEvent[],
  input: ResolveTimetableSpaceInput,
  options: { excludeBreakSlots?: boolean } = {},
): ResolvedTimetableCell[] {
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

export function referenceDateForDayOfWeek(day: DayOfWeek): Date {
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

export function weekKeysInRange(startDate: Date, endDate: Date): string[] {
  const keys = new Set<string>()
  let current = normalizeDate(startDate)
  const last = normalizeDate(endDate)
  while (current <= last) {
    keys.add(weekKey(current))
    current = nextDate(current)
  }
  return [...keys].sort()
}

export async function collectNonSchoolDates(
  repositories: SchoolRepositories,
  classGroup: ClassGroup,
  academicYearId: string,
  _startDate: Date,
  _endDate: Date,
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
  return buildWeeklyTemplateSpace(periods, options)
}

export function buildWeeklyTemplateSpace(
  periods: readonly PeriodDefinition[],
  options: { excludeBreakSlots?: boolean } = {},
): ResolvedTimetableCell[] {
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

export function placementOccupiedIntervals(
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
  const occupied = new TimetableOccupancyIndex(input.occupiedIntervals)
  const placements: TimetablePlacement[] = []
  const placedBySubjectWeek: Record<string, Record<string, number>> = structuredClone(input.existingWorkloadByClassSubjectAndWeek ?? {})
  const weeks = weekKeysInRange(input.startDate, input.endDate)

  for (const templatePlacement of input.templatePlacements) {
    for (const currentWeekKey of weeks) {
      const required = input.subjects.find(subject => subject.classSubjectId === templatePlacement.classSubjectId)?.periodsPerWeek ?? 0
      const placed = placedBySubjectWeek[templatePlacement.classSubjectId]?.[currentWeekKey] ?? 0
      if (placed + placementSlotCount(templatePlacement) > required)
        continue
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
        if (!occupied.isAvailable(cell, input.classGroupId, templatePlacement.teacherIds)) {
          blockAvailable = false
          break
        }
        concreteCells.push(cell)
      }
      if (!blockAvailable || concreteCells.length === 0) {
        continue
      }
      if (violatesSameSubjectDayGap(placements, templatePlacement.classSubjectId, concreteCells[0]!.date, input.options.minDayGapSameSubject))
        continue
      if (input.existingSubjectDates?.some(existing => existing.classSubjectId === templatePlacement.classSubjectId
        && calendarDaysBetween(existing.date, concreteCells[0]!.date) < input.options.minDayGapSameSubject)) {
        continue
      }
      const placement = makePlacement({
        classSubjectId: templatePlacement.classSubjectId,
        displayLabel: templatePlacement.displayLabel,
        teacherIds: templatePlacement.teacherIds,
      }, concreteCells)
      placements.push(placement)
      occupied.add(placementOccupiedIntervals(input.classGroupId, placement))
      const byWeek = placedBySubjectWeek[placement.classSubjectId] ?? {}
      byWeek[currentWeekKey] = (byWeek[currentWeekKey] ?? 0) + placementSlotCount(placement)
      placedBySubjectWeek[placement.classSubjectId] = byWeek
    }
  }

  // Keep available template lessons fixed, then fill only the remaining workload.
  // A blocked recurring slot is not proof that the concrete week is infeasible.
  const templateCells = buildWeeklyTemplateSpace([...input.periodById.values()], input.options)
  const repairCells = weeks.flatMap(currentWeekKey => templateCells.flatMap((cell) => {
    const date = dateInWeek(currentWeekKey, cell.date)
    if (date < rangeStartKey || date > rangeEndKey || input.nonSchoolDates.has(date))
      return []
    return [{ ...cell, date, weekKey: currentWeekKey, ...buildCellTimes(dateFromKey(date), input.periodById.get(cell.periodDefinitionId)!) }]
  }))
  const repair = solveTimetable({
    classGroupId: input.classGroupId,
    cells: repairCells,
    subjects: [...input.subjects],
    occupiedIntervals: [...input.occupiedIntervals, ...placements.flatMap(placement => placementOccupiedIntervals(input.classGroupId, placement))],
    existingWorkloadByClassSubjectAndWeek: placedBySubjectWeek,
    existingSubjectDates: [
      ...(input.existingSubjectDates ?? []),
      ...placements.map(placement => ({ classSubjectId: placement.classSubjectId, date: placement.cell.date })),
    ],
    options: { ...input.options, enforceWorkloadFulfillment: false },
  })
  for (const placement of repair.placements) {
    placements.push(placement)
    const byWeek = placedBySubjectWeek[placement.classSubjectId] ?? {}
    byWeek[placement.cell.weekKey] = (byWeek[placement.cell.weekKey] ?? 0) + placementSlotCount(placement)
    placedBySubjectWeek[placement.classSubjectId] = byWeek
  }

  // If filling holes cannot satisfy a week, allow its newly generated lessons to
  // move. Preserved lessons and other weeks remain fixed; retain the better plan.
  for (const currentWeekKey of weeks) {
    const missing = input.subjects.reduce((sum, subject) => sum + Math.max(0, subject.periodsPerWeek - (placedBySubjectWeek[subject.classSubjectId]?.[currentWeekKey] ?? 0)), 0)
    const weekCells = repairCells.filter(cell => cell.weekKey === currentWeekKey)
    if (missing === 0 || weekCells.length === 0)
      continue
    const otherWeeks = placements.filter(placement => placement.cell.weekKey !== currentWeekKey)
    const replanInput: SolveTimetableInput = {
      classGroupId: input.classGroupId,
      cells: weekCells,
      subjects: [...input.subjects],
      occupiedIntervals: [...input.occupiedIntervals, ...otherWeeks.flatMap(placement => placementOccupiedIntervals(input.classGroupId, placement))],
      existingWorkloadByClassSubjectAndWeek: input.existingWorkloadByClassSubjectAndWeek,
      existingSubjectDates: [
        ...(input.existingSubjectDates ?? []),
        ...otherWeeks.map(placement => ({ classSubjectId: placement.classSubjectId, date: placement.cell.date })),
      ],
      options: { ...input.options, enforceWorkloadFulfillment: false },
    }
    const replanned = solveTimetable(replanInput)
    if (replanned.unmetWorkloads.reduce((sum, unmet) => sum + unmet.required - unmet.placed, 0) >= missing)
      continue
    for (let index = placements.length - 1; index >= 0; index--) {
      if (placements[index]!.cell.weekKey === currentWeekKey)
        placements.splice(index, 1)
    }
    placements.push(...replanned.placements)
    for (const subject of input.subjects) {
      const byWeek = placedBySubjectWeek[subject.classSubjectId] ?? {}
      byWeek[currentWeekKey] = (input.existingWorkloadByClassSubjectAndWeek?.[subject.classSubjectId]?.[currentWeekKey] ?? 0)
        + replanned.placements.filter(placement => placement.classSubjectId === subject.classSubjectId).reduce((sum, placement) => sum + placement.span, 0)
      placedBySubjectWeek[subject.classSubjectId] = byWeek
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
      { classGroupId: input.classGroupId, ...first },
    )
  }

  return { placements, unmetWorkloads }
}

export function solveTimetable(input: SolveTimetableInput): SolveTimetableResult {
  const occupied = new TimetableOccupancyIndex(input.occupiedIntervals)
  const placements: TimetablePlacement[] = []
  const unmetWorkloads: UnmetTimetableWorkload[] = []
  const preferredIds = new Set(input.options.preferredPeriodDefinitionIds)
  const cellsByWeek = new Map<string, ResolvedTimetableCell[]>()
  for (const cell of input.cells) {
    const week = cellsByWeek.get(cell.weekKey) ?? []
    week.push(cell)
    cellsByWeek.set(cell.weekKey, week)
  }

  for (const currentWeekKey of [...cellsByWeek.keys()].sort()) {
    const weekCells = cellsByWeek.get(currentWeekKey)!
    const candidates = new CandidateBlockCache(weekCells, preferredIds, input.searchAttempt)
    const existingDatesBySubject = new Map(input.subjects.map(subject => [subject.classSubjectId, input.existingSubjectDates?.filter(existing => existing.classSubjectId === subject.classSubjectId
      && weekCells.some(cell => calendarDaysBetween(existing.date, cell.date) < input.options.minDayGapSameSubject))]))
    const contextFor = (subject: TimetableSubjectDemand): PlacementSearchContext => ({
      candidates,
      subject,
      classGroupId: subject.classGroupId ?? input.classGroupId,
      occupied,
      preferredIds,
      placements,
      minDayGapSameSubject: input.options.minDayGapSameSubject,
      existingSubjectDates: existingDatesBySubject.get(subject.classSubjectId),
    })
    const availableCounts = new Map(input.subjects.map(subject => [subject.classSubjectId, candidateBlocks(contextFor(subject)).length]))
    const subjects = [...input.subjects].sort((left, right) =>
      availableCounts.get(left.classSubjectId)! - availableCounts.get(right.classSubjectId)!
      || right.periodsPerWeek - left.periodsPerWeek
      || left.classSubjectId.localeCompare(right.classSubjectId))

    while (subjects.length > 0) {
      if (input.subjects.some(subject => subject.classGroupId !== undefined)) {
        const capacity = new Map(subjects.map((subject) => {
          const cells = new Set(candidateBlocks(contextFor(subject)).flatMap(block => block.map(cell => cell.startsAt.getTime())))
          const remaining = Math.max(1, subject.periodsPerWeek - (input.existingWorkloadByClassSubjectAndWeek?.[subject.classSubjectId]?.[currentWeekKey] ?? 0))
          return [subject.classSubjectId, cells.size / remaining]
        }))
        subjects.sort((left, right) => capacity.get(left.classSubjectId)! - capacity.get(right.classSubjectId)!
          || right.periodsPerWeek - left.periodsPerWeek || left.classSubjectId.localeCompare(right.classSubjectId))
      }
      const subject = subjects.shift()!
      const existingCount = input.existingWorkloadByClassSubjectAndWeek?.[subject.classSubjectId]?.[currentWeekKey] ?? 0
      const slotsToPlace = Math.max(0, subject.periodsPerWeek - existingCount)
      let slotsPlaced = 0
      const placementContext = contextFor(subject)
      while (slotsPlaced < slotsToPlace) {
        const remaining = slotsToPlace - slotsPlaced
        const block = choosePlacementBlock(placementContext, remaining)
        if (!block) {
          break
        }
        const placement = makePlacement({
          classSubjectId: subject.classSubjectId,
          displayLabel: subject.displayLabel,
          teacherIds: subject.teacherIds,
        }, block)
        placements.push(placement)
        const nextOccupied = placementOccupiedIntervals(subject.classGroupId ?? input.classGroupId, placement)
        occupied.add(nextOccupied)
        placementContext.occupied = occupied
        placementContext.placements = placements
        slotsPlaced += placementSlotCount(placement)
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
      { classGroupId: input.classGroupId, ...first },
    )
  }
  return { placements, unmetWorkloads }
}
