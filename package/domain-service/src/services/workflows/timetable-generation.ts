import { Permission } from '@edaya/core';
import type { AcademicYear, Assessment, ClassGroup, ClassSubject, GradeLevelSubject, LessonSession as LessonSessionEntity, School, TeacherAssignment, TeacherUnavailability } from '@edaya/core';
import type { OccupiedInterval, ResolveTimetableSpaceInput, SolveTimetableResult, TimetableGenerationDefaults, TimetablePlacement, TimetableSubjectDemand } from '../../capabilities/timetable';
import type { SchoolRepositories } from '../../ports/school-repositories';
import { randomUUID } from 'node:crypto';

import { AssessmentKind, BusinessRuleViolationError, LessonSession, normalizeDate, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus, TeacherUnavailabilityRecurrence, TimetableGenerated, TimetableGenerationMode } from '@edaya/core';
import { collectNonSchoolDates, countSessionPeriodSlots, endExclusive, occurrenceOverlaps, placementOccupiedIntervals, referenceDateForDayOfWeek, resolveTimetableSpace, resolveWeeklyTemplateSpace, solveTimetable, spreadWeeklyTemplate, validateRange, weekKey } from '../../capabilities/timetable';
import { BaseServiceWorkflow } from './base-service-workflow';
import { assertNoSessionConflict } from './schedule-conflicts';
import { expandTeacherUnavailability } from './teacher-unavailability';

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
    const sessions = placements.map((placement) => {
      const firstCell = placement.cells[0]!
      const lastCell = placement.cells[placement.cells.length - 1]!
      return new LessonSession({
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
    })
    if (sessions.length > 0) {
      await this.baseService.repositories.lessonSessions.batchSave(sessions)
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
      options,
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
    const published = publishable.map(({ draft, teacherIds }) => draft.copyWith({
      timetableGenerated: TimetableGenerated.Published,
      timetableTeacherIds: teacherIds,
    }))
    if (published.length > 0) {
      await this.baseService.repositories.lessonSessions.batchSave(published)
    }
    return {
      classGroupId: classGroup.id,
      publishedSessionIds: published.map(session => session.id),
      skippedSessionIds,
    }
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
    const idsToDelete = sessions
      .filter(session => !this.shouldPreserveGeneratedSession(session))
      .map(session => session.id)
    if (idsToDelete.length > 0) {
      await this.baseService.repositories.lessonSessions.batchDelete(idsToDelete)
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
    
    await this.baseService.access.assertResources(Permission.TIMETABLE_CREATE, 'classGroups', [classGroup.id], 'write')
  }

  private async authorizePublish(classGroup: ClassGroup): Promise<void> {
    this.checkActorSchool(classGroup.schoolId)
    
    await this.baseService.access.assertResources(Permission.TIMETABLE_PUBLISH, 'classGroups', [classGroup.id], 'write')
  }
}
