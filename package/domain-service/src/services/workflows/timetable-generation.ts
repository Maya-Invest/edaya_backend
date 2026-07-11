import type {
  AcademicYear,
  Assessment,
  ClassGroup,
  ClassSubject,
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
  CalendarEventScopeKind,
  DayOfWeek,
  LessonSession,
  normalizeDate,
  OccurrenceStatus,
  TeacherAssignmentKind,
  TeacherAssignmentStatus,
  TimetableGenerated,
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
  enforceWorkloadFulfillment: boolean
  excludeBreakSlots: boolean
  minPeriodGapSameSubject: number
  preferredPeriodDefinitionIds: string[]
  allowUnassignedTeacherPlacements: boolean
  useHomeroomTeacherFallback: boolean
}

export interface TimetablePlacementParameters {
  periodsPerWeekByClassSubjectId?: Record<string, number>
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

export interface GenerateClassGroupTimetableResult extends SolveTimetableResult {
  classGroupId: string
  sessions: LessonSessionEntity[]
}

export interface GenerateSchoolTimetableResult {
  academicYearId: string
  classGroups: GenerateClassGroupTimetableResult[]
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
  return date.toISOString().slice(0, 10)
}

function nextDate(date: Date): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return normalizeDate(next)
}

function endExclusive(date: Date): Date {
  return nextDate(normalizeDate(date))
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
    if (!event.isNonSchoolDay || !calendarEventAppliesToClass(event, classGroup)) {
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

function candidateCells(
  cells: readonly ResolvedTimetableCell[],
  subject: TimetableSubjectDemand,
  classGroupId: string,
  occupied: readonly OccupiedInterval[],
  preferredIds: Set<string>,
): ResolvedTimetableCell[] {
  return cells
    .filter(cell => cellIsAvailable(cell, classGroupId, subject.teacherIds, occupied))
    .sort((left, right) =>
      Number(preferredIds.has(right.periodDefinitionId)) - Number(preferredIds.has(left.periodDefinitionId))
      || left.startsAt.getTime() - right.startsAt.getTime()
      || left.periodDefinitionId.localeCompare(right.periodDefinitionId))
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
      const leftCount = candidateCells(weekCells, left, input.classGroupId, occupied, preferredIds).length
      const rightCount = candidateCells(weekCells, right, input.classGroupId, occupied, preferredIds).length
      return leftCount - rightCount
        || right.periodsPerWeek - left.periodsPerWeek
        || left.classSubjectId.localeCompare(right.classSubjectId)
    })

    for (const subject of subjects) {
      const existingCount = input.existingWorkloadByClassSubjectAndWeek?.[subject.classSubjectId]?.[currentWeekKey] ?? 0
      const periodsToPlace = Math.max(0, subject.periodsPerWeek - existingCount)
      const subjectPlacements: TimetablePlacement[] = []
      for (const cell of candidateCells(weekCells, subject, input.classGroupId, occupied, preferredIds)) {
        if (subjectPlacements.length >= periodsToPlace) {
          break
        }
        if (!cellIsAvailable(cell, input.classGroupId, subject.teacherIds, occupied)) {
          continue
        }
        if (subjectPlacements.some(placement =>
          Math.abs(placement.cell.weeklyIndex - cell.weeklyIndex) < input.options.minPeriodGapSameSubject)) {
          continue
        }
        const placement = { classSubjectId: subject.classSubjectId, displayLabel: subject.displayLabel, teacherIds: subject.teacherIds, cell }
        subjectPlacements.push(placement)
        placements.push(placement)
        occupied.push({
          layer: 'class_group',
          layerKey: input.classGroupId,
          startsAt: cell.startsAt,
          endsAt: cell.endsAt,
        })
        for (const teacherId of subject.teacherIds) {
          occupied.push({ layer: 'teacher', layerKey: teacherId, startsAt: cell.startsAt, endsAt: cell.endsAt })
        }
      }
      if (existingCount + subjectPlacements.length < subject.periodsPerWeek) {
        unmetWorkloads.push({
          classSubjectId: subject.classSubjectId,
          weekKey: currentWeekKey,
          required: subject.periodsPerWeek,
          placed: existingCount + subjectPlacements.length,
        })
      }
    }
  }

  if (input.options.enforceWorkloadFulfillment && unmetWorkloads.length > 0) {
    const first = unmetWorkloads[0]!
    throw new BusinessRuleViolationError(
      'TIMETABLE_WORKLOAD_UNSATISFIED',
      `Could not place ${first.required} periods for class subject ${first.classSubjectId} in week ${first.weekKey}`,
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
): Promise<OccupiedInterval[]> {
  const [lessons, activities, assignments, assessments] = await Promise.all([
    repositories.lessonSessions.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
    repositories.activitySessions.list({ classGroupId }),
    repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
    repositories.assessments.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
  ])
  const relevantTeacherIds = new Set(demands.flatMap(demand => demand.teacherIds))
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
      const results: GenerateClassGroupTimetableResult[] = []
      for (const group of groups) {
        const classInput = { ...input, classGroupId: group.id }
        const context = await this.requireGenerationContext(classInput)
        results.push(await this.generateClassGroupInternal(classInput, context, true))
      }
      return { academicYearId: input.academicYearId, classGroups: results }
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
      const generated = await this.generatedSessionsInRange(input.classGroupId, input.startDate, input.endDate)
      for (const session of generated) {
        const preserve = session.status === OccurrenceStatus.Completed
          || (session.status === OccurrenceStatus.Pending && session.isException)
        if (!preserve) {
          await this.baseService.repositories.lessonSessions.delete(session.id)
        }
      }
      const generation = await this.generateClassGroupInternal(input, context, false)
      const publication = await this.publishInternal(input, context.classGroup)
      return { generation, publication }
    })
  }

  private async generateClassGroupInternal(
    input: GenerateClassGroupTimetableInput,
    context: { classGroup: ClassGroup, academicYear: AcademicYear, school: School },
    rejectExistingDrafts: boolean,
  ): Promise<GenerateClassGroupTimetableResult> {
    if (rejectExistingDrafts) {
      const existing = await this.generatedSessionsInRange(input.classGroupId, input.startDate, input.endDate)
      if (existing.some(session => session.timetableGenerated === TimetableGenerated.Draft && !session.isException)) {
        throw new BusinessRuleViolationError('TIMETABLE_DRAFT_ALREADY_EXISTS', 'Generated drafts already exist in this range; use republish to replace them')
      }
      if (existing.some(session => session.timetableGenerated === TimetableGenerated.Published && !session.isException)) {
        throw new BusinessRuleViolationError('TIMETABLE_PUBLISHED_ALREADY_EXISTS', 'Published timetable sessions already exist in this range; use republish to replace them')
      }
    }
    const options: TimetableGenerationDefaults = {
      enforceWorkloadFulfillment: input.options?.enforceWorkloadFulfillment ?? context.school.timetableEnforceWorkloadFulfillment,
      excludeBreakSlots: input.options?.excludeBreakSlots ?? context.school.timetableExcludeBreakSlots,
      minPeriodGapSameSubject: input.options?.minPeriodGapSameSubject ?? context.school.timetableMinPeriodGapSameSubject,
      preferredPeriodDefinitionIds: input.options?.preferredPeriodDefinitionIds ?? context.school.timetablePreferredPeriodDefinitionIds,
      allowUnassignedTeacherPlacements: input.options?.allowUnassignedTeacherPlacements ?? context.school.timetableAllowUnassignedTeacherPlacements,
      useHomeroomTeacherFallback: input.options?.useHomeroomTeacherFallback ?? context.school.timetableUseHomeroomTeacherFallback,
    }
    const cells = await resolveTimetableSpace(this.baseService.repositories, input, { excludeBreakSlots: options.excludeBreakSlots })
    const rangeStart = normalizeDate(input.startDate)
    const rangeEnd = endExclusive(input.endDate)
    const [classSubjects, assignments] = await Promise.all([
      this.baseService.repositories.classSubjects.list({ classGroupId: input.classGroupId }),
      this.baseService.repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
    ])
    const offered = classSubjects.filter(subject => subject.isOffered)
    const subjectEntities = await this.baseService.repositories.subjects.findByIds([...new Set(offered.map(subject => subject.subjectId))])
    const labelBySubjectId = new Map(subjectEntities.map(subject => [subject.id, subject.name]))
    const homeroomTeacherId = options.useHomeroomTeacherFallback
      ? await this.resolveHomeroomTeacherId(context.classGroup)
      : undefined
    const demands = offered.map(subject => this.buildDemand(
      subject,
      assignments,
      input,
      options,
      homeroomTeacherId,
      labelBySubjectId.get(subject.subjectId) ?? subject.subjectId,
      rangeStart,
      rangeEnd,
    ))
    const occupiedIntervals = await buildOccupiedIntervals(this.baseService.repositories, input.classGroupId, rangeStart, rangeEnd, demands)
    const existingWorkloadByClassSubjectAndWeek = await this.buildExistingWorkload(input.classGroupId, rangeStart, rangeEnd)
    const solved = solveTimetable({
      classGroupId: input.classGroupId,
      cells,
      subjects: demands,
      occupiedIntervals,
      existingWorkloadByClassSubjectAndWeek,
      options,
    })
    const sessions: LessonSessionEntity[] = []
    for (const placement of solved.placements) {
      const session = new LessonSession({
        id: randomUUID(),
        schoolId: context.classGroup.schoolId,
        classGroupId: context.classGroup.id,
        classSubjectId: placement.classSubjectId,
        timetableGenerated: TimetableGenerated.Draft,
        timetableTeacherIds: placement.teacherIds,
        status: OccurrenceStatus.Pending,
        isException: false,
        startsAt: placement.cell.startsAt,
        endsAt: placement.cell.endsAt,
        displayLabel: placement.displayLabel,
      })
      await this.baseService.repositories.lessonSessions.save(session)
      sessions.push(session)
    }
    return { classGroupId: input.classGroupId, sessions, ...solved }
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
    const periodsPerWeek = input.placementParameters?.periodsPerWeekByClassSubjectId?.[subject.id] ?? subject.periodsPerWeek
    if (!periodsPerWeek || !Number.isInteger(periodsPerWeek) || periodsPerWeek <= 0) {
      throw new BusinessRuleViolationError('TIMETABLE_WORKLOAD_REQUIRED', `Class subject ${subject.id} has no valid periodsPerWeek`)
    }
    return { classSubjectId: subject.id, displayLabel, periodsPerWeek, teacherIds }
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

  private async buildExistingWorkload(classGroupId: string, startsAt: Date, endsAt: Date): Promise<Record<string, Record<string, number>>> {
    const sessions = await this.baseService.repositories.lessonSessions.list({
      classGroupId,
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    })
    const workload: Record<string, Record<string, number>> = {}
    for (const session of sessions) {
      if (session.status === OccurrenceStatus.Cancelled) {
        continue
      }
      const sessionWeek = weekKey(session.startsAt)
      const byWeek = workload[session.classSubjectId] ?? {}
      byWeek[sessionWeek] = (byWeek[sessionWeek] ?? 0) + 1
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
