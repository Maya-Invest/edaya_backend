import type {
  Assessment,
  AssessmentInput,
  AssessmentResult,
  AssessmentResultInput,
  GradeScale,
  GradeScaleInput,
  ReportCardAggregation,
  ReportCardDefinitionInput,
  ReportCardDefinitionSection,
  ReportCardDefinitionSectionInput,
  StudentClassEnrollment,
} from '../../domain'
import type { BaseSchoolService } from '../base-school-service'
import { permissionAction } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import {
  ASSESSMENT_RESULT_RECORDED_EVENT_KEY,
  REPORT_CARD_PUBLISHED_EVENT_KEY,
  runWorkflowNotifications,
} from '../../capabilities/notifications'
import { Assessment as AssessmentEntity, AssessmentResult as AssessmentResultEntity, AttendanceJustificationStatus, AttendanceStatus, GradeScale as GradeScaleEntity, ReportCardAggregationSource, ReportCardDefinition, ReportCardDefinitionSection as ReportCardDefinitionSectionEntity, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus } from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { normalizeDate, roundTo2 } from '../../domain/shared/utils'
import { AttendanceSummary } from '../../domain/value-objects/attendance-summary'
import { BaseServiceWorkflow } from './base-service-workflow'
import {
  buildGroupResultFromChildren,
  buildSubjectAverageFromAssessments,
  buildSubjectAverageFromPriorReportCards,
  childReportCardDefinitionSections,
  dedupeReportCardDefinitionSections,
  evaluateAggregationPublishReadiness,
  listAssessmentResultsForStudentAndPeriods,
  listPublishedPeriodIds,
  loadPriorReportCardResults,
  rootReportCardDefinitionSections,
} from './report-card-aggregation'

export interface PublishReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
  publishedAt?: Date
  aggregation?: ReportCardAggregation
}

export interface GenerateReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  reportCardDefinitionId?: string
  generatedAt?: Date
  aggregation?: ReportCardAggregation
}

export interface WriteHomeroomReportCommentInput {
  id: string
  teacherComment: string
}

export type CreateGradeScaleInput = GradeScaleInput
export type CreateReportCardDefinitionInput = ReportCardDefinitionInput
export type CreateReportCardDefinitionSectionInput = ReportCardDefinitionSectionInput
export type CreateAssessmentInput = AssessmentInput

export interface CompleteAssessmentInput {
  assessmentId: string
  completedAt?: Date
}

export type RecordAssessmentResultInput = AssessmentResultInput

export interface ListClassSubjectAssessmentResultsForPeriodInput {
  classSubjectId: string
  periodId: string
}

export class AssessmentsServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async createGradeScale(input: CreateGradeScaleInput): Promise<GradeScale> {
    const gradeScale = new GradeScaleEntity(input)
    await this.baseService.entities.gradeScales.save(gradeScale)
    return gradeScale
  }

  async createReportCardDefinition(input: CreateReportCardDefinitionInput): Promise<ReportCardDefinition> {
    const definition = new ReportCardDefinition(input)
    await this.baseService.entities.definitions.save(definition)
    return definition
  }

  async createReportCardDefinitionSection(input: CreateReportCardDefinitionSectionInput): Promise<ReportCardDefinitionSection> {
    const section = new ReportCardDefinitionSectionEntity(input)
    await this.baseService.entities.sections.save(section)
    return section
  }

  async createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
    const assessment = new AssessmentEntity(input)
    await this.baseService.entities.assessments.save(assessment)
    return assessment
  }

  async completeAssessment({ assessmentId, completedAt }: CompleteAssessmentInput): Promise<Assessment> {
    const existing = await this.requireEntity(this.baseService.entities.assessments, assessmentId)
    const assessment = new AssessmentEntity({ ...existing.data, completedAt: completedAt ?? new Date() })
    await this.baseService.entities.assessments.save(assessment)
    return assessment
  }

  async recordAssessmentResult(input: RecordAssessmentResultInput): Promise<AssessmentResult> {
    const result = new AssessmentResultEntity(input)
    await this.baseService.entities.assessmentResults.save(result)
    const student = await this.requireStudent(result.studentId)
    const assessment = await this.requireEntity(this.baseService.entities.assessments, result.assessmentId)
    await runWorkflowNotifications(this.baseService, ASSESSMENT_RESULT_RECORDED_EVENT_KEY, {
      result,
      assessment,
      student,
    })
    return result
  }

  async recordAssessmentResultCompliance(input: RecordAssessmentResultInput): Promise<AssessmentResult> {
    return this.recordAssessmentResult(input)
  }

  async listClassSubjectAssessmentResultsForPeriod({
    classSubjectId,
    periodId,
  }: ListClassSubjectAssessmentResultsForPeriodInput): Promise<AssessmentResult[]> {
    await this.requireEntity(this.baseService.entities.classSubjects, classSubjectId)
    await this.requireEntity(this.baseService.entities.academicPeriods, periodId)
    const assessments = await this.baseService.entities.assessments.list({ classSubjectId, periodId })
    const results: AssessmentResult[] = []
    for (const assessment of assessments) {
      results.push(...await this.baseService.entities.assessmentResults.list({ assessmentId: assessment.id }))
    }
    return results
  }

  async generateReportCardResult(input: GenerateReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    this.checkActorSchool(student.schoolId)
    await permissionAction(Permission.REPORT_CARD_PUBLISH)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    await this.requireReportCardNotPublished(input.studentId, input.periodId)
    const reportCard = await this.buildReportCardResult(input)
    await this.baseService.entities.results.save(reportCard, { moduleChecked: true })
    return reportCard
  }

  async writeHomeroomReportComment(input: WriteHomeroomReportCommentInput): Promise<ReportCardResult> {
    const existing = await this.requireEntity(this.baseService.entities.results, input.id)
    const student = await this.requireStudent(existing.studentId)
    this.checkActorSchool(student.schoolId)
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
    await this.baseService.authorizationPolicy.checkReportCardResultAccess(this.baseService.actor, [existing.id])

    const updated = new ReportCardResult({
      id: existing.id,
      reportCardDefinitionId: existing.reportCardDefinitionId,
      studentId: existing.studentId,
      classGroupId: existing.classGroupId,
      periodId: existing.periodId,
      sectionResults: [...(existing.sectionResults ?? [])],
      attendanceSummary: existing.attendanceSummary,
      assessmentResultCount: existing.assessmentResultCount,
      overallAverage: existing.overallAverage,
      rank: existing.rank,
      classSize: existing.classSize,
      passThreshold: existing.passThreshold,
      teacherComment: input.teacherComment.trim(),
      principalComment: existing.principalComment,
      status: existing.status,
      generatedAt: existing.generatedAt,
      publishedAt: existing.publishedAt,
      aggregation: existing.aggregation,
    })
    await this.baseService.entities.results.save(updated, { moduleChecked: true })
    return updated
  }

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    this.checkActorSchool(student.schoolId)
    await permissionAction(Permission.REPORT_CARD_PUBLISH)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
    await this.baseService.authorizationPolicy.checkReportCardResultAccess(this.baseService.actor, [input.id])
    await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
    return this.baseService.atomicExecution.execute(async () => {
      await this.requireReportCardNotPublished(input.studentId, input.periodId)
      const generated = await this.buildReportCardResult(input)
      await this.requireReportCardPublishReady({
        studentId: input.studentId,
        periodId: input.periodId,
        aggregation: generated.aggregation,
      })
      const published = generated.copyWith({
        status: ReportCardResultStatus.Published,
        publishedAt: input.publishedAt ?? new Date(),
      })
      await this.baseService.entities.results.save(published, { moduleChecked: true })
      await runWorkflowNotifications(this.baseService, REPORT_CARD_PUBLISHED_EVENT_KEY, {
        result: published,
        student,
      })
      return published
    })
  }

  private async requireReportCardResources(
    periodId: string,
    reportCardDefinitionId: string | undefined,
    schoolId: string,
  ): Promise<void> {
    const period = await this.baseService.repositories.academicPeriods.findById(periodId)
    const definition = reportCardDefinitionId
      ? await this.baseService.repositories.definitions.findById(reportCardDefinitionId)
      : undefined
    if (!period || period.schoolId !== schoolId || (reportCardDefinitionId && !definition)) {
      denyResourceAccess()
    }
    if (definition && definition.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireReportCardNotPublished(studentId: string, periodId: string): Promise<void> {
    const reportCard = await this.baseService.repositories.results.findOne({ studentId, periodId })
    if (reportCard?.status === ReportCardResultStatus.Published) {
      throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${studentId} and period ${periodId} is immutable`)
    }
  }

  private async buildReportCardResult({
    id,
    studentId,
    periodId,
    reportCardDefinitionId,
    generatedAt,
    aggregation,
  }: GenerateReportCardResultInput): Promise<ReportCardResult> {
    const period = await this.requirePeriod(periodId)
    const enrollment = await this.requireEnrollmentForPeriod({
      studentId,
      academicYearId: period.academicYearId,
    })
    const classGroup = await this.requireClassGroup(enrollment.classGroupId)
    const definition = reportCardDefinitionId
      ? await this.requireReportCardDefinition(reportCardDefinitionId)
      : await this.requireDefaultReportCardDefinition({
          gradeLevelId: classGroup.gradeLevelId,
          academicYearId: period.academicYearId,
        })
    const existing = await this.baseService.repositories.results.findOne({ studentId, periodId })
    const resolvedAggregation = aggregation ?? existing?.aggregation
    const { sectionResults, overallAverage, assessmentResultCount, attendanceSummary, canPublish } = await this.buildReportCardResults({
      studentId,
      periodId,
      classGroupId: classGroup.id,
      reportCardDefinitionId: definition.id,
      aggregation: resolvedAggregation,
    })
    const periodAssessmentResults = await this.listResultsForStudentAndPeriod(studentId, periodId)
    const resolvedAttendanceSummary = attendanceSummary ?? await this.buildAttendanceSummary({
      studentId,
      startDate: period.startDate,
      endDate: period.endDate,
    })
    return new ReportCardResult({
      id: existing?.id ?? id,
      reportCardDefinitionId: definition.id,
      studentId,
      classGroupId: classGroup.id,
      periodId,
      sectionResults,
      attendanceSummary: resolvedAttendanceSummary,
      assessmentResultCount: assessmentResultCount ?? periodAssessmentResults.length,
      overallAverage: overallAverage === undefined ? undefined : Math.round(overallAverage),
      rank: existing?.rank,
      classSize: existing?.classSize,
      passThreshold: existing?.passThreshold,
      teacherComment: existing?.teacherComment,
      principalComment: existing?.principalComment,
      status: canPublish ? (existing?.status ?? ReportCardResultStatus.Draft) : ReportCardResultStatus.Draft,
      generatedAt: existing?.generatedAt ?? generatedAt,
      publishedAt: existing?.publishedAt,
      aggregation: resolvedAggregation,
    })
  }

  private async buildReportCardResults({
    studentId,
    periodId,
    classGroupId,
    reportCardDefinitionId,
    aggregation,
  }: {
    studentId: string
    periodId: string
    classGroupId: string
    reportCardDefinitionId: string
    aggregation?: ReportCardAggregation
  }): Promise<{
    sectionResults: ReportCardResultSection[]
    overallAverage?: number
    assessmentResultCount?: number
    attendanceSummary?: AttendanceSummary
    canPublish: boolean
  }> {
    const period = await this.requirePeriod(periodId)
    const allSections = dedupeReportCardDefinitionSections(
      await this.baseService.repositories.sections.list({ reportCardDefinitionId }),
    ).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    const classSubjects = (await this.baseService.repositories.classSubjects.list({ classGroupId }))
      .filter(classSubject => classSubject.isOffered !== false)
    const classSubjectBySubject = new Map(classSubjects.map(classSubject => [classSubject.subjectId, classSubject]))

    if (!aggregation) {
      const singlePeriod = await this.buildSinglePeriodReportCardResults({
        studentId,
        periodId,
        classSubjectBySubject,
        allSections,
      })
      return {
        ...singlePeriod,
        canPublish: period.isPublished,
      }
    }

    const readiness = await evaluateAggregationPublishReadiness(this.baseService, studentId, aggregation)
    const publishedSourcePeriodIds = await listPublishedPeriodIds(this.baseService, aggregation.sourcePeriodIds)
    const assessmentsWithResults = await listAssessmentResultsForStudentAndPeriods(
      this.baseService,
      studentId,
      aggregation.sourcePeriodIds,
      { onlyPublishedPeriods: aggregation.source === ReportCardAggregationSource.Assessments },
    )
    const { publishedByPeriodId: priorResultsByPeriodId } = aggregation.source === ReportCardAggregationSource.ReportCards
      ? await loadPriorReportCardResults(this.baseService, {
          studentId,
          sourcePeriodIds: aggregation.sourcePeriodIds,
        })
      : { publishedByPeriodId: new Map() }

    const computeNode = async (
      section: ReportCardDefinitionSection,
      visited = new Set<string>(),
    ): Promise<ReportCardResultSection | null> => {
      if (visited.has(section.id)) {
        throw new BusinessRuleViolationError('REPORT_CARD_SECTION_CYCLE', 'report card definition sections must not contain cycles')
      }
      const nextVisited = new Set(visited).add(section.id)
      const childSections = childReportCardDefinitionSections(allSections, section.id)
      if (section.kind === ReportCardDefinitionSectionKind.Subject) {
        const classSubject = section.subjectId ? classSubjectBySubject.get(section.subjectId) : undefined
        if (!classSubject) {
          return null
        }
        const average = aggregation.source === ReportCardAggregationSource.ReportCards
          ? buildSubjectAverageFromPriorReportCards(section.id, aggregation, priorResultsByPeriodId)
          : buildSubjectAverageFromAssessments(classSubject.id, assessmentsWithResults)
        if (average === undefined) {
          return null
        }
        return new ReportCardResultSection({
          sectionId: section.id,
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: section.name,
          average,
          weight: section.weight,
          parentSectionId: section.parentSectionId,
          classSubjectId: classSubject.id,
          subResults: [],
        })
      }

      const childResults: ReportCardResultSection[] = []
      for (const child of childSections) {
        const childResult = await computeNode(child, nextVisited)
        if (childResult) {
          childResults.push(childResult)
        }
      }
      return buildGroupResultFromChildren(section, childResults)
    }

    const sectionResults: ReportCardResultSection[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0
    for (const root of rootReportCardDefinitionSections(allSections)) {
      const result = await computeNode(root)
      if (result) {
        sectionResults.push(result)
        rootSumWeights += root.weight
        rootSumWeightedPoints += result.average * root.weight
      }
    }

    const sourcePeriods = await Promise.all(
      [...publishedSourcePeriodIds].map(sourcePeriodId => this.requirePeriod(sourcePeriodId)),
    )
    let presentCount = 0
    let absenceCount = 0
    let excusedAbsenceCount = 0
    let lateCount = 0
    for (const sourcePeriod of sourcePeriods) {
      const summary = await this.buildAttendanceSummary({
        studentId,
        startDate: sourcePeriod.startDate,
        endDate: sourcePeriod.endDate,
      })
      presentCount += summary.presentCount
      absenceCount += summary.absenceCount
      excusedAbsenceCount += summary.excusedAbsenceCount
      lateCount += summary.lateCount
    }

    const overallAverage = rootSumWeights > 0 ? roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined
    return {
      sectionResults,
      overallAverage,
      assessmentResultCount: assessmentsWithResults.length,
      attendanceSummary: new AttendanceSummary({
        presentCount,
        absenceCount,
        excusedAbsenceCount,
        lateCount,
      }),
      canPublish: readiness.canPublish,
    }
  }

  private async requireReportCardPublishReady({
    studentId,
    periodId,
    aggregation,
  }: {
    studentId: string
    periodId: string
    aggregation?: ReportCardAggregation
  }): Promise<void> {
    const period = await this.requirePeriod(periodId)
    if (aggregation) {
      const readiness = await evaluateAggregationPublishReadiness(this.baseService, studentId, aggregation)
      if (!readiness.canPublish) {
        throw new BusinessRuleViolationError(
          'AGGREGATED_REPORT_CARD_SOURCES_NOT_READY',
          `Aggregated report card for student ${studentId} and period ${periodId} cannot be published until all source periods are published and source report cards are published`,
        )
      }
      return
    }
    if (!period.isPublished) {
      throw new BusinessRuleViolationError(
        'ACADEMIC_PERIOD_NOT_PUBLISHED',
        `Report card for student ${studentId} and period ${periodId} cannot be published until the academic period is published`,
      )
    }
  }

  private async buildSinglePeriodReportCardResults({
    studentId,
    periodId,
    classSubjectBySubject,
    allSections,
  }: {
    studentId: string
    periodId: string
    classSubjectBySubject: Map<string, { id: string, subjectId: string }>
    allSections: ReportCardDefinitionSection[]
  }): Promise<{ sectionResults: ReportCardResultSection[], overallAverage?: number }> {
    await this.requirePeriod(periodId)
    const periodAssessmentResults = await this.listResultsForStudentAndPeriod(studentId, periodId)
    const assessmentResultsByClassSubject = new Map<string, Array<{ result: AssessmentResult, assessment: Assessment }>>()
    for (const { result, assessment } of periodAssessmentResults) {
      assessmentResultsByClassSubject.set(assessment.classSubjectId, [
        ...(assessmentResultsByClassSubject.get(assessment.classSubjectId) ?? []),
        { result, assessment },
      ])
    }

    const computeNode = async (
      section: ReportCardDefinitionSection,
      visited = new Set<string>(),
    ): Promise<ReportCardResultSection | null> => {
      if (visited.has(section.id)) {
        throw new BusinessRuleViolationError('REPORT_CARD_SECTION_CYCLE', 'report card definition sections must not contain cycles')
      }
      const nextVisited = new Set(visited).add(section.id)
      const childSections = childReportCardDefinitionSections(allSections, section.id)
      if (section.kind === ReportCardDefinitionSectionKind.Subject) {
        const classSubject = section.subjectId ? classSubjectBySubject.get(section.subjectId) : undefined
        if (!classSubject)
          return null
        const average = buildSubjectAverageFromAssessments(
          classSubject.id,
          assessmentResultsByClassSubject.get(classSubject.id) ?? [],
        )
        if (average === undefined) {
          return null
        }
        return new ReportCardResultSection({
          sectionId: section.id,
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: section.name,
          average,
          weight: section.weight,
          parentSectionId: section.parentSectionId,
          classSubjectId: classSubject.id,
          subResults: [],
        })
      }

      const childResults: ReportCardResultSection[] = []
      for (const child of childSections) {
        const childResult = await computeNode(child, nextVisited)
        if (childResult) {
          childResults.push(childResult)
        }
      }
      return buildGroupResultFromChildren(section, childResults)
    }

    const sectionResults: ReportCardResultSection[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0
    for (const root of rootReportCardDefinitionSections(allSections)) {
      const result = await computeNode(root)
      if (result) {
        sectionResults.push(result)
        rootSumWeights += root.weight
        rootSumWeightedPoints += result.average * root.weight
      }
    }
    const overallAverage = rootSumWeights > 0 ? roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined
    return { sectionResults, overallAverage }
  }

  private async requireEnrollmentForPeriod({
    studentId,
    academicYearId,
  }: {
    studentId: string
    academicYearId: string
  }): Promise<StudentClassEnrollment> {
    const enrollments = await this.baseService.repositories.enrollments.list({ studentId })
    for (const enrollment of enrollments) {
      const classGroup = await this.baseService.repositories.classGroups.findById(enrollment.classGroupId)
      if (classGroup?.academicYearId === academicYearId) {
        return enrollment
      }
    }
    throw new BusinessRuleViolationError('STUDENT_NOT_ENROLLED_IN_YEAR', `Student ${studentId} is not enrolled in academic year ${academicYearId}`)
  }

  private async requireReportCardDefinition(reportCardDefinitionId: string) {
    const definition = await this.baseService.repositories.definitions.findById(reportCardDefinitionId)
    if (!definition) {
      throw new BusinessRuleViolationError('UNKNOWN_REPORT_CARD_DEFINITION', `Unknown report card definition: ${reportCardDefinitionId}`)
    }
    return definition
  }

  private async requireDefaultReportCardDefinition({
    gradeLevelId,
    academicYearId,
  }: {
    gradeLevelId: string
    academicYearId: string
  }) {
    const definition = await this.baseService.repositories.definitions.findOne({ gradeLevelId, academicYearId, isDefault: true })
    if (!definition) {
      throw new BusinessRuleViolationError('NO_DEFAULT_REPORT_CARD_DEFINITION', `No default report card definition for grade level ${gradeLevelId}`)
    }
    return definition
  }

  private async buildAttendanceSummary({
    studentId,
    startDate,
    endDate,
  }: {
    studentId: string
    startDate: Date
    endDate: Date
  }): Promise<AttendanceSummary> {
    const records = await this.baseService.repositories.attendance.list({
      studentId,
      date: { $gte: normalizeDate(startDate), $lte: normalizeDate(endDate) },
    })
    let presentCount = 0
    let absenceCount = 0
    let excusedAbsenceCount = 0
    let lateCount = 0
    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.Present:
          presentCount += 1
          break
        case AttendanceStatus.Absent:
          absenceCount += 1
          if (record.justificationStatus === AttendanceJustificationStatus.Excused) {
            excusedAbsenceCount += 1
          }
          break
        case AttendanceStatus.Late:
          lateCount += 1
          break
      }
    }
    return new AttendanceSummary({ presentCount, absenceCount, excusedAbsenceCount, lateCount })
  }

  private async listResultsForStudentAndPeriod(
    studentId: string,
    periodId: string,
  ): Promise<Array<{ result: AssessmentResult, assessment: Assessment }>> {
    const results = await this.baseService.repositories.assessmentResults.list({ studentId })
    const resolved: Array<{ result: AssessmentResult, assessment: Assessment }> = []
    for (const result of results) {
      const assessment = await this.baseService.repositories.assessments.findById(result.assessmentId)
      if (assessment?.periodId === periodId) {
        resolved.push({ result, assessment })
      }
    }
    return resolved
  }

  private async requireEntity<T>(
    managedService: { findById: (id: string) => Promise<T | undefined> },
    id: string,
  ): Promise<T> {
    const entity = await managedService.findById(id)
    if (!entity) {
      denyResourceAccess()
    }
    return entity
  }
}
