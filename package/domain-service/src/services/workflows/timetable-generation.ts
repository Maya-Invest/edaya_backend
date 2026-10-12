import type { AcademicYear, Assessment, ClassGroup, ClassSubject, GradeLevelSubject, LessonSession as LessonSessionEntity, PeriodDefinition, School, TeacherAssignment, TeacherUnavailability } from '@edaya/core'
import type { OccupiedInterval, ResolveTimetableSpaceInput, SolveTimetableInput, SolveTimetableResult, SpreadWeeklyTemplateInput, TimetableGenerationDefaults, TimetablePlacement, TimetableSubjectDemand } from '../../capabilities/timetable'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { randomUUID } from 'node:crypto'
import { AccessFacts } from '@edaya/authorization'
import { AssessmentKind, BusinessRuleViolationError, LessonSession, normalizeDate, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus, TeacherUnavailabilityRecurrence, TimetableGenerationMode } from '@edaya/core'
import { academicStateLock } from '../../capabilities/academics/marks-state'
import { buildTimetableSpace, buildWeeklyTemplateSpace, collectNonSchoolDates, countSessionPeriodSlots, endExclusive, occurrenceOverlaps, placementOccupiedIntervals, referenceDateForDayOfWeek, resolveWeeklyTemplateSpace, solveTimetable, spreadWeeklyTemplate, validateRange, weekKey } from '../../capabilities/timetable'

import { TimetableOccupancyIndex } from '../../capabilities/timetable/occupancy-index'
import { regeneratableSessionIds } from '../../capabilities/timetable/regeneration-protection'
import { BaseServiceWorkflow } from './base-service-workflow'
import { expandTeacherUnavailability } from './teacher-unavailability'

export type {
  OccupiedCell,
  OccupiedInterval,
  ResolvedTimetableCell,
  ResolveTimetableSpaceInput,
  SolveTimetableInput,
  SolveTimetableResult,
  SpreadWeeklyTemplateInput,
  TimetableGenerationDefaults,
  TimetablePlacement,
  TimetableSubjectDemand,
  UnmetTimetableWorkload,
} from '../../capabilities/timetable'
export {
  resolveTimetableSpace,
  resolveWeeklyTemplateSpace,
  solveTimetable,
  spreadWeeklyTemplate,
  WEEKLY_TEMPLATE_WEEK_KEY,
} from '../../capabilities/timetable'

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
  classGroupIds?: string[]
  academicYearId: string
  startDate: Date
  endDate: Date
  placementParameters?: TimetablePlacementParameters
  options?: Partial<TimetableGenerationDefaults>
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
  return [...new Set([...lesson.timetableTeacherIds, ...teacherIdsForClassSubjectAt(lesson.classSubjectId, assignments, lesson.startsAt, lesson.endsAt)])]
}

function assessmentIsTimed(assessment: Assessment): assessment is Assessment & { startsAt: Date, endsAt: Date } {
  return assessment.kind !== AssessmentKind.Homework && Boolean(assessment.startsAt && assessment.endsAt)
}

interface GenerationReadData {
  periods: PeriodDefinition[]
  assignments: TeacherAssignment[]
  lessons: LessonSessionEntity[]
}

function assignmentsBySubject(assignments: readonly TeacherAssignment[]): Map<string, TeacherAssignment[]> {
  const bySubject = new Map<string, TeacherAssignment[]>()
  for (const assignment of assignments) {
    if (!assignment.classSubjectId)
      continue
    const entries = bySubject.get(assignment.classSubjectId) ?? []
    entries.push(assignment)
    bySubject.set(assignment.classSubjectId, entries)
  }
  return bySubject
}

async function buildOccupiedIntervals(
  repositories: SchoolRepositories,
  classGroupId: string,
  startsAt: Date,
  endsAt: Date,
  demands: TimetableSubjectDemand[],
  scope: 'spread' | 'unavailability-only' = 'spread',
  data?: GenerationReadData,
  knownUnavailabilities?: TeacherUnavailability[],
): Promise<OccupiedInterval[]> {
  const relevantTeacherIds = new Set(demands.flatMap(demand => demand.teacherIds))
  const unavailabilities = knownUnavailabilities ?? (relevantTeacherIds.size > 0
    ? await repositories.teacherUnavailabilities.list({ teacherId: { $in: [...relevantTeacherIds] }, isActive: true })
    : [])
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
    data?.lessons ?? repositories.lessonSessions.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
    repositories.activitySessions.list({ classGroupId, startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
    data?.assignments ?? repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
    repositories.assessments.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
  ])
  const bySubject = assignmentsBySubject(assignments)
  for (const lesson of lessons) {
    if (lesson.status === OccurrenceStatus.Cancelled) {
      // A cancellation is a deliberate empty class interval, not free space to regenerate.
      if (lesson.classGroupId === classGroupId) {
        occupied.push({ layer: 'class_group', layerKey: classGroupId, startsAt: lesson.startsAt, endsAt: lesson.endsAt, sourceSessionId: lesson.id })
      }
      continue
    }
    if (lesson.classGroupId === classGroupId) {
      occupied.push({ layer: 'class_group', layerKey: classGroupId, startsAt: lesson.startsAt, endsAt: lesson.endsAt, sourceSessionId: lesson.id })
    }
    for (const teacherId of resolveLessonTeacherIds(lesson, bySubject.get(lesson.classSubjectId) ?? [])) {
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
    for (const teacherId of teacherIdsForClassSubjectAt(assessment.classSubjectId, bySubject.get(assessment.classSubjectId) ?? [], assessment.startsAt, assessment.endsAt)) {
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
  knownUnavailabilities?: TeacherUnavailability[],
): Promise<OccupiedInterval[]> {
  const relevantTeacherIds = new Set(demands.flatMap(demand => demand.teacherIds))
  if (relevantTeacherIds.size === 0) {
    return []
  }
  const unavailabilities = knownUnavailabilities ?? await repositories.teacherUnavailabilities.list({
    teacherId: { $in: [...relevantTeacherIds] },
    isActive: true,
  })
  return unavailabilities.flatMap(rule =>
    expandWeeklyUnavailabilityForTemplate(rule, generationStart, generationEnd))
}

function existingSubjectDates(data: GenerationReadData, classGroupId: string) {
  return data.lessons
    .filter(session => session.classGroupId === classGroupId && session.status !== OccurrenceStatus.Cancelled)
    .map(session => ({ classSubjectId: session.classSubjectId, date: normalizeDate(session.startsAt).toISOString().slice(0, 10) }))
}

export class TimetableGenerationServiceWorkflow extends BaseServiceWorkflow {
  async generateClassGroupTimetable(input: GenerateClassGroupTimetableInput): Promise<GenerateClassGroupTimetableResult> {
    return this.baseService.atomicExecution.execute(async () => {
      const context = await this.requireGenerationContext(input)
      await this.authorizeCreate(context.classGroup)
      return this.baseService.atomicExecution.execute(() => this.generateClassGroupInternal(input, context, true))
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  async generateSchoolTimetable(input: GenerateSchoolTimetableInput): Promise<GenerateSchoolTimetableResult> {
    return this.baseService.atomicExecution.execute(async () => {
      const academicYear = await this.baseService.repositories.academicYears.findById(input.academicYearId)
      if (!academicYear || academicYear.schoolId !== this.baseService.actor.schoolId) {
        throw new BusinessRuleViolationError('ACADEMIC_YEAR_NOT_FOUND', 'Academic year was not found')
      }
      const allGroups = await this.baseService.repositories.classGroups.list({ academicYearId: input.academicYearId })
      const selectedIds = input.classGroupIds ? new Set(input.classGroupIds) : undefined
      if (selectedIds && (selectedIds.size === 0 || [...selectedIds].some(id => !allGroups.some(group => group.id === id))))
        throw new BusinessRuleViolationError('TIMETABLE_SCOPE_NOT_FOUND', 'Selected classes must belong to the academic year')
      const groups = selectedIds ? allGroups.filter(group => selectedIds.has(group.id)) : allGroups
      if (groups.length === 0)
        return { academicYearId: input.academicYearId, classGroups: [], skippedClassGroupIds: [] }
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
        for (const group of groups) {
          await this.discardRegeneratableSessionsInRange(group.id, input.startDate, input.endDate)
        }
        const results: GenerateClassGroupTimetableResult[] = []
        for (const group of groups) {
          const classInput = { ...input, classGroupId: group.id }
          const context = await this.requireGenerationContext(classInput)
          results.push(await this.generateClassGroupInternal(classInput, context, false))
        }
        return { academicYearId: input.academicYearId, classGroups: results, skippedClassGroupIds: [] }
      })
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
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
    knownAssignments?: TeacherAssignment[],
  ): Promise<TimetableSubjectDemand[]> {
    const [classSubjects, assignments] = await Promise.all([
      this.baseService.repositories.classSubjects.list({ classGroupId: input.classGroupId }),
      knownAssignments ?? this.baseService.repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
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
    const homeroomTeacherIds = options.useHomeroomTeacherFallback
      ? await this.resolveHomeroomTeacherIds(context.classGroup, rangeStart, rangeEnd)
      : []
    const bySubject = assignmentsBySubject(assignments)
    return offered.map(subject => this.buildDemand(
      subject,
      bySubject.get(subject.id) ?? [],
      input,
      options,
      homeroomTeacherIds,
      labelBySubjectId.get(subject.subjectId) ?? subject.subjectId,
      rangeStart,
      rangeEnd,
      subject.gradeLevelSubjectId ? gradeLevelSubjectById.get(subject.gradeLevelSubjectId) : undefined,
    ))
  }

  private async persistPlacementSessions(
    placements: readonly TimetablePlacement[],
    context: { classGroup: ClassGroup },
    occupiedIntervals: readonly OccupiedInterval[],
  ): Promise<LessonSessionEntity[]> {
    const occupied = new TimetableOccupancyIndex(occupiedIntervals)
    for (const placement of placements) {
      const interval = { ...placement.cells[0]!, endsAt: placement.cells[placement.cells.length - 1]!.endsAt }
      if (!occupied.isAvailable(interval, context.classGroup.id, placement.teacherIds))
        throw new BusinessRuleViolationError('SCHEDULE_CONFLICT', 'Generated session conflicts with the current timetable')
      occupied.add(placementOccupiedIntervals(context.classGroup.id, placement))
    }
    const sessions = placements.map((placement) => {
      const firstCell = placement.cells[0]!
      const lastCell = placement.cells[placement.cells.length - 1]!
      return new LessonSession({
        id: randomUUID(),
        schoolId: context.classGroup.schoolId,
        classGroupId: context.classGroup.id,
        classSubjectId: placement.classSubjectId,
        timetableGenerated: true,
        timetableTeacherIds: placement.teacherIds,
        status: OccurrenceStatus.Pending,
        isException: false,
        startsAt: firstCell.startsAt,
        endsAt: lastCell.endsAt,
        displayLabel: placement.displayLabel,
      })
    })
    if (sessions.length > 0) {
      const scope = await this.baseService.access.timetable.assertGenerate(sessions)
      await this.baseService.repositories.lessonSessions.forAccess(scope).batchSave(sessions)
    }
    return sessions
  }

  private async generateClassGroupInternal(
    input: GenerateClassGroupTimetableInput,
    context: { classGroup: ClassGroup, academicYear: AcademicYear, school: School },
    replaceEligibleSessions: boolean,
  ): Promise<GenerateClassGroupTimetableResult> {
    if (replaceEligibleSessions) {
      await this.discardRegeneratableSessionsInRange(input.classGroupId, input.startDate, input.endDate)
    }
    const options = this.resolveGenerationOptions(input, context.school)
    const rangeStart = normalizeDate(input.startDate)
    const rangeEnd = endExclusive(input.endDate)
    const data = await this.loadGenerationData(input, rangeStart, rangeEnd)
    if (options.generationMode === TimetableGenerationMode.Weekly) {
      return this.generateClassGroupWeeklyInternal(input, context, options, data)
    }
    const events = await this.baseService.repositories.calendarEvents.list({ academicYearId: input.academicYearId })
    const cells = buildTimetableSpace(context.classGroup, data.periods, events, input, { excludeBreakSlots: options.excludeBreakSlots })
    const demands = await this.buildClassDemands(input, context, options, rangeStart, rangeEnd, data.assignments)
    const occupiedIntervals = await buildOccupiedIntervals(this.baseService.repositories, input.classGroupId, rangeStart, rangeEnd, demands, 'spread', data)
    const existingWorkloadByClassSubjectAndWeek = await this.buildExistingWorkload(
      input.classGroupId,
      input.academicYearId,
      rangeStart,
      rangeEnd,
      options.excludeBreakSlots,
      data,
    )
    const solved = this.solve({
      classGroupId: input.classGroupId,
      cells,
      subjects: demands,
      occupiedIntervals,
      existingWorkloadByClassSubjectAndWeek,
      existingSubjectDates: existingSubjectDates(data, input.classGroupId),
      options,
    })
    const sessions = await this.persistPlacementSessions(solved.placements, context, occupiedIntervals)
    return { classGroupId: input.classGroupId, sessions, ...solved }
  }

  private async generateClassGroupWeeklyInternal(
    input: GenerateClassGroupTimetableInput,
    context: { classGroup: ClassGroup, academicYear: AcademicYear, school: School },
    options: TimetableGenerationDefaults,
    data: GenerationReadData,
  ): Promise<GenerateClassGroupTimetableResult> {
    const rangeStart = normalizeDate(input.startDate)
    const rangeEnd = endExclusive(input.endDate)
    const demands = await this.buildClassDemands(input, context, options, rangeStart, rangeEnd, data.assignments)
    const templateCells = buildWeeklyTemplateSpace(data.periods, { excludeBreakSlots: options.excludeBreakSlots })
    const periods = data.periods
    const teacherIds = [...new Set(demands.flatMap(demand => demand.teacherIds))]
    const unavailabilities = teacherIds.length
      ? await this.baseService.repositories.teacherUnavailabilities.list({ teacherId: { $in: teacherIds }, isActive: true })
      : []
    const periodById = new Map(periods.map(period => [period.id, period]))
    const templateUnavailability = await buildTemplateOccupiedIntervals(
      this.baseService.repositories,
      demands,
      input.startDate,
      input.endDate,
      unavailabilities,
    )
    const templateSolved = this.solve({
      classGroupId: input.classGroupId,
      cells: templateCells,
      subjects: demands,
      occupiedIntervals: templateUnavailability,
      // Fulfillment is assessed after spreading, including preserved lesson work.
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
      'spread',
      data,
      unavailabilities,
    )
    const spread = this.spread({
      classGroupId: input.classGroupId,
      existingSubjectDates: existingSubjectDates(data, input.classGroupId),
      existingWorkloadByClassSubjectAndWeek: await this.buildExistingWorkload(input.classGroupId, input.academicYearId, rangeStart, rangeEnd, options.excludeBreakSlots, data),
      templatePlacements: templateSolved.placements,
      periodById,
      startDate: input.startDate,
      endDate: input.endDate,
      nonSchoolDates,
      occupiedIntervals: spreadOccupied,
      subjects: demands,
      options,
    })
    const sessions = await this.persistPlacementSessions(spread.placements, context, spreadOccupied)
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
    const sharedTemplateOccupied: OccupiedInterval[] = []
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
      const templateSolved = this.solve({
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
    const fixedOccupied: OccupiedInterval[] = []
    const generatedOccupied: OccupiedInterval[] = []
    const existingDates: { classSubjectId: string, date: string }[] = []
    const existingWorkload: Record<string, Record<string, number>> = {}
    const closuresByClass = new Map<string, ReadonlySet<string>>()
    for (const entry of prepared) {
      const nonSchoolDates = await collectNonSchoolDates(
        this.baseService.repositories,
        entry.context.classGroup,
        input.academicYearId,
        input.startDate,
        input.endDate,
      )
      closuresByClass.set(entry.classInput.classGroupId, nonSchoolDates)
      const data = await this.loadGenerationData(entry.classInput, rangeStart, rangeEnd)
      const spreadOccupied = await buildOccupiedIntervals(
        this.baseService.repositories,
        entry.classInput.classGroupId,
        rangeStart,
        rangeEnd,
        entry.demands,
        'spread',
        data,
      )
      const dates = existingSubjectDates(data, entry.classInput.classGroupId)
      const workload = await this.buildExistingWorkload(entry.classInput.classGroupId, input.academicYearId, rangeStart, rangeEnd, entry.options.excludeBreakSlots, data)
      existingDates.push(...dates)
      Object.assign(existingWorkload, workload)
      fixedOccupied.push(...spreadOccupied)
      for (const date of nonSchoolDates) {
        fixedOccupied.push({ layer: 'class_group', layerKey: entry.classInput.classGroupId, startsAt: new Date(`${date}T00:00:00Z`), endsAt: endExclusive(new Date(`${date}T00:00:00Z`)) })
      }
      const spread = this.spread({
        classGroupId: entry.classInput.classGroupId,
        existingSubjectDates: dates,
        existingWorkloadByClassSubjectAndWeek: workload,
        templatePlacements: entry.templateSolved.placements,
        periodById,
        startDate: input.startDate,
        endDate: input.endDate,
        nonSchoolDates,
        occupiedIntervals: [...spreadOccupied, ...generatedOccupied],
        subjects: entry.demands,
        options: { ...entry.options, enforceWorkloadFulfillment: false },
      })
      generatedOccupied.push(...spread.placements.flatMap(placement => placementOccupiedIntervals(entry.classInput.classGroupId, placement)))
      results.push({ classGroupId: entry.classInput.classGroupId, sessions: [], ...spread })
    }
    const affectedWeeks = new Set(results.flatMap(result => result.unmetWorkloads.map(unmet => unmet.weekKey)))
    const allCells = affectedWeeks.size > 0 ? buildTimetableSpace(firstContext.classGroup, periods, [], { ...input, classGroupId: firstContext.classGroup.id }, sharedOptions) : []
    const demands = prepared.flatMap(entry => entry.demands.map(demand => ({ ...demand, classGroupId: entry.classInput.classGroupId })))
    for (const currentWeekKey of affectedWeeks) {
      const otherWeeks = results.flatMap(result => result.placements.filter(placement => placement.cell.weekKey !== currentWeekKey)
        .map(placement => ({ classGroupId: result.classGroupId, placement })))
      const weekCells = allCells.filter(cell => cell.weekKey === currentWeekKey)
      const repairInput: SolveTimetableInput = {
        classGroupId: firstContext.classGroup.id,
        cells: weekCells,
        subjects: demands.filter(demand => weekCells.some(cell => !closuresByClass.get(demand.classGroupId)?.has(cell.date))),
        occupiedIntervals: [...fixedOccupied, ...otherWeeks.flatMap(row => placementOccupiedIntervals(row.classGroupId, row.placement))],
        existingWorkloadByClassSubjectAndWeek: existingWorkload,
        existingSubjectDates: [...existingDates, ...otherWeeks.map(row => ({ classSubjectId: row.placement.classSubjectId, date: row.placement.cell.date }))],
        options: { ...sharedOptions, enforceWorkloadFulfillment: false },
      }
      let solved = this.solve(repairInput)
      for (let searchAttempt = 1; searchAttempt <= 16 && solved.unmetWorkloads.length > 0; searchAttempt++) {
        const alternative = this.solve({ ...repairInput, searchAttempt })
        if (alternative.unmetWorkloads.reduce((sum, unmet) => sum + unmet.required - unmet.placed, 0)
          < solved.unmetWorkloads.reduce((sum, unmet) => sum + unmet.required - unmet.placed, 0)) {
          solved = alternative
        }
      }
      const previousMissing = results.flatMap(result => result.unmetWorkloads).filter(unmet => unmet.weekKey === currentWeekKey).reduce((sum, unmet) => sum + unmet.required - unmet.placed, 0)
      if (solved.unmetWorkloads.reduce((sum, unmet) => sum + unmet.required - unmet.placed, 0) >= previousMissing)
        continue
      for (const result of results) {
        const ids = new Set(demands.filter(demand => demand.classGroupId === result.classGroupId).map(demand => demand.classSubjectId))
        result.placements = [...result.placements.filter(placement => placement.cell.weekKey !== currentWeekKey), ...solved.placements.filter(placement => ids.has(placement.classSubjectId))]
        result.unmetWorkloads = [...result.unmetWorkloads.filter(unmet => unmet.weekKey !== currentWeekKey), ...solved.unmetWorkloads.filter(unmet => ids.has(unmet.classSubjectId))]
      }
    }
    const occupied = [...fixedOccupied]
    for (const result of results) {
      const entry = prepared.find(entry => entry.classInput.classGroupId === result.classGroupId)!
      const first = result.unmetWorkloads[0]
      if (entry.options.enforceWorkloadFulfillment && first) {
        throw new BusinessRuleViolationError('TIMETABLE_WORKLOAD_UNSATISFIED', `Could not place ${first.placed}/${first.required} periods for class subject ${first.classSubjectId} in week ${first.weekKey}`, { classGroupId: result.classGroupId, ...first })
      }
      result.sessions = await this.persistPlacementSessions(result.placements, entry.context, occupied)
      occupied.push(...result.placements.flatMap(placement => placementOccupiedIntervals(result.classGroupId, placement)))
    }
    return { academicYearId: input.academicYearId, classGroups: results, skippedClassGroupIds: [] }
  }

  private buildDemand(
    subject: ClassSubject,
    assignments: TeacherAssignment[],
    input: GenerateClassGroupTimetableInput,
    options: TimetableGenerationDefaults,
    homeroomTeacherIds: string[],
    displayLabel: string,
    startsAt: Date,
    endsAt: Date,
    gradeLevelSubject?: GradeLevelSubject,
  ): TimetableSubjectDemand {
    const teacherIds = [...new Set(assignments
      .filter(assignment => assignment.classSubjectId === subject.id && assignmentApplies(assignment, startsAt, endsAt))
      .map(assignment => assignment.teacherId))]
    if (teacherIds.length === 0 && options.useHomeroomTeacherFallback) {
      teacherIds.push(...homeroomTeacherIds)
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

  private async resolveHomeroomTeacherIds(classGroup: ClassGroup, startsAt: Date, endsAt: Date): Promise<string[]> {
    const facts = new AccessFacts(this.baseService.actor, this.baseService.repositories)
    const assignments = await facts.list('teacherAssignments', {
      kind: TeacherAssignmentKind.Homeroom,
      status: TeacherAssignmentStatus.Active,
      classGroupId: classGroup.id,
      academicYearId: classGroup.academicYearId,
    })
    const ids = [...new Set(assignments.filter(assignment =>
      (!assignment.startsAt || assignment.startsAt <= startsAt)
      && (!assignment.endsAt || assignment.endsAt >= endsAt)).map(assignment => assignment.teacherId))]
    return (await facts.repository('teachers').findByIds(ids))
      .filter(teacher => teacher.isActive)
      .map(teacher => teacher.id)
  }

  private async buildExistingWorkload(
    classGroupId: string,
    academicYearId: string,
    startsAt: Date,
    endsAt: Date,
    excludeBreakSlots: boolean,
    data?: GenerationReadData,
  ): Promise<Record<string, Record<string, number>>> {
    const [sessions, periods] = await Promise.all([
      data
        ? data.lessons.filter(session => session.classGroupId === classGroupId)
        : this.baseService.repositories.lessonSessions.list({
            classGroupId,
            startsAt: { $lt: endsAt },
            endsAt: { $gt: startsAt },
          }),
      data?.periods ?? this.baseService.repositories.periodDefinitions.list({ academicYearId }),
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

  private async loadGenerationData(input: GenerateClassGroupTimetableInput, startsAt: Date, endsAt: Date): Promise<GenerationReadData> {
    const [periods, assignments, lessons] = await Promise.all([
      this.baseService.repositories.periodDefinitions.list({ academicYearId: input.academicYearId }),
      this.baseService.repositories.teacherAssignments.list({ kind: TeacherAssignmentKind.Subject, status: TeacherAssignmentStatus.Active }),
      this.baseService.repositories.lessonSessions.list({ startsAt: { $lt: endsAt }, endsAt: { $gt: startsAt } }),
    ])
    return { periods, assignments, lessons }
  }

  protected solve(input: SolveTimetableInput): SolveTimetableResult {
    return solveTimetable(input)
  }

  protected spread(input: SpreadWeeklyTemplateInput): SolveTimetableResult {
    return spreadWeeklyTemplate(input)
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

  private async discardRegeneratableSessionsInRange(classGroupId: string, startDate: Date, endDate: Date): Promise<void> {
    const sessions = await this.generatedSessionsInRange(classGroupId, startDate, endDate)
    const idsToDelete = await regeneratableSessionIds(this.baseService.repositories, this.baseService.actor.schoolId, sessions)
    if (idsToDelete.length > 0) {
      const scope = await this.baseService.access.timetable.assertDiscardGenerated(idsToDelete)
      await this.baseService.repositories.lessonSessions.forAccess(scope).batchDelete(idsToDelete)
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

    await this.baseService.access.timetable.assertCreateClass(classGroup.id)
  }
}
