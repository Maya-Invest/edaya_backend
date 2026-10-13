import type { AcademicPeriod, Assessment, AssessmentInput, AssessmentResult, AssessmentResultInput, DecideMarksCorrectionInput, GradeScale, GradeScaleInput, GradingPolicy, RejectMarksCorrectionInput, ReportCardAggregation, ReportCardDefinitionInput, ReportCardDefinitionSection, ReportCardDefinitionSectionInput, RequestMarksCorrectionInput, ReviseMarksCorrectionInput, StudentClassEnrollment } from '@edaya/core'
import type { ReportAssessmentContext } from '../../capabilities/academics/report-assessment-context'
import type { BaseSchoolService } from '../base-school-service'
import type { AssessmentsWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import type { ConfigureGradingInput, RetryGradingInput } from './grading-configuration'
import type { MarksReviewInput } from './marks-review'
import type { ReportAggregationContext } from './report-card-aggregation'
import type { HomeroomCommentInput, SectionCommentsInput } from './report-comments'
import { denyResourceAccess } from '@edaya/authorization'
import { Assessment as AssessmentEntity, AssessmentResult as AssessmentResultEntity, AttendanceJustificationStatus, AttendanceStatus, AttendanceSummary, BusinessRuleViolationError, describeGrade, DOCUMENT_FAILURES, GradeScale as GradeScaleEntity, normalizeDate, reportCardAcademicVersion, ReportCardAggregationSource, ReportCardDefinition, ReportCardDefinitionSection as ReportCardDefinitionSectionEntity, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, reportCardSnapshotSchema, roundTo2 } from '@edaya/core'
import { assessmentGradingPolicy, captureGradeEntry } from '../../capabilities/academics/grading'
import { academicStateLock, assertMarksRevision, enrollmentEffectiveAt } from '../../capabilities/academics/marks-state'
import { loadReportAssessmentContext, scopeReportAssessmentContext } from '../../capabilities/academics/report-assessment-context'
import { hydrateReportRevision } from '../../capabilities/academics/report-comment-revisions'
import { preserveReportComments } from '../../capabilities/academics/report-comments'
import { DOCUMENT_RENDER_KIND } from '../../capabilities/documents/durable-document-render'
import { documentNumberLockKey } from '../../capabilities/documents/persist-requested-issuance'
import { REPORT_CARD_PUBLISHED_EVENT_KEY, runWorkflowNotifications } from '../../capabilities/notifications'
import { schoolCommandScope } from '../commands/school-command-scope'

import { validateReportCardResultSave } from '../entities/config/assessments/report-card-result'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'
import { DocumentsServiceWorkflow } from './documents'
import { GradingConfigurationWorkflow } from './grading-configuration'
import { MarksCorrectionsWorkflow } from './marks-corrections'
import { MarksReviewWorkflow } from './marks-review'
import { buildGroupResultFromChildren, buildSubjectAverageFromAssessments, buildSubjectAverageFromPriorReportCards, childReportCardDefinitionSections, dedupeReportCardDefinitionSections, loadReportAggregationContext, rootReportCardDefinitionSections } from './report-card-aggregation'
import { writeReportComments } from './report-comments'

export interface PublishReportCardResultInput {
  reviewedGradingRevision?: number
  reviewedDraftVersion?: number
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

export type WriteHomeroomReportCommentInput = HomeroomCommentInput
export type WriteReportCardSectionCommentsInput = SectionCommentsInput

export type CreateGradeScaleInput = GradeScaleInput
export type CreateReportCardDefinitionInput = ReportCardDefinitionInput
export type CreateReportCardDefinitionSectionInput = ReportCardDefinitionSectionInput
export type CreateAssessmentInput = AssessmentInput

export interface CompleteAssessmentInput {
  assessmentId: string
  completedAt?: Date
}

export type RecordAssessmentResultInput = AssessmentResultInput & { requestId: string, expectedRevision: number, expectedGradingRevision?: number }
export interface RecordAssessmentResultsInput extends MarksReviewInput { expectedGradingRevision?: number, results: Array<Omit<AssessmentResultInput, 'assessmentId' | 'createdBy' | 'createdAt'>> }

export interface ListClassSubjectAssessmentResultsForPeriodInput {
  classSubjectId: string
  periodId: string
}

export class AssessmentsServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: AssessmentsWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('assessments', base.repositories)
  }

  configureGrading(input: ConfigureGradingInput) { return new GradingConfigurationWorkflow(this.baseService).configure(input) }
  retryGrading(input: RetryGradingInput) { return new GradingConfigurationWorkflow(this.baseService).retry(input) }

  async createGradeScale(input: CreateGradeScaleInput): Promise<GradeScale> {
    return this.baseService.atomicExecution.execute(async () => {
      const gradeScale = new GradeScaleEntity(input)
      await this.baseService.entities.gradeScales.save(gradeScale)
      return gradeScale
    })
  }

  async createReportCardDefinition(input: CreateReportCardDefinitionInput): Promise<ReportCardDefinition> {
    return this.baseService.atomicExecution.execute(async () => {
      const definition = new ReportCardDefinition(input)
      await this.baseService.entities.definitions.save(definition)
      return definition
    })
  }

  async createReportCardDefinitionSection(input: CreateReportCardDefinitionSectionInput): Promise<ReportCardDefinitionSection> {
    return this.baseService.atomicExecution.execute(async () => {
      const section = new ReportCardDefinitionSectionEntity(input)
      await this.baseService.entities.sections.save(section)
      return section
    })
  }

  async createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
    return this.baseService.atomicExecution.execute(async () => {
      const assessment = new AssessmentEntity(input)
      await this.baseService.entities.assessments.save(assessment)
      return assessment
    })
  }

  async completeAssessment({ assessmentId, completedAt }: CompleteAssessmentInput): Promise<Assessment> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.assessments, assessmentId)
      const assessment = new AssessmentEntity({ ...existing.data, completedAt: completedAt ?? new Date() })
      await this.baseService.entities.assessments.save(assessment)
      return assessment
    })
  }

  async submitAssessmentMarks(input: MarksReviewInput): Promise<Assessment> {
    return new MarksReviewWorkflow(this.baseService).transition('submit', input)
  }

  async reviseAssessmentMarksCorrection(input: ReviseMarksCorrectionInput) { return new MarksCorrectionsWorkflow(this.baseService).revise(input) }
  async requestAssessmentMarksCorrection(input: RequestMarksCorrectionInput) { return new MarksCorrectionsWorkflow(this.baseService).request(input) }
  async approveAssessmentMarksCorrection(input: DecideMarksCorrectionInput) { return new MarksCorrectionsWorkflow(this.baseService).decide('approve', input) }
  async rejectAssessmentMarksCorrection(input: RejectMarksCorrectionInput) { return new MarksCorrectionsWorkflow(this.baseService).decide('reject', input) }
  async withdrawAssessmentMarksCorrection(input: DecideMarksCorrectionInput) { return new MarksCorrectionsWorkflow(this.baseService).decide('withdraw', input) }

  async recordAssessmentResult(input: RecordAssessmentResultInput): Promise<AssessmentResult> {
    return this.writeAssessmentResult(input, 'marks')
  }

  private async writeAssessmentResult(input: RecordAssessmentResultInput, mode: 'marks' | 'compliance'): Promise<AssessmentResult> {
    return this.baseService.commandExecution.execute({
      scope: await schoolCommandScope(this.baseService.actor, mode === 'marks' ? 'recordAssessmentResult' : 'recordAssessmentResultCompliance', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.baseService.actor.schoolId)],
      authorize: async () => {
        await this.baseService.access.marksReview.edit(input.assessmentId)
      },
      execute: async () => {
        const assessment = await this.requireEntity(this.baseService.entities.assessments, input.assessmentId)
        assertMarksRevision(assessment, input.expectedRevision)
        const existing = await this.baseService.entities.assessmentResults.findById(input.id)
        const policy = await assessmentGradingPolicy(this.repositories, assessment)
        if (input.expectedGradingRevision !== undefined && input.expectedGradingRevision !== (policy?.revision ?? 0))
          throw new BusinessRuleViolationError('GRADING_REVISION_CONFLICT', 'Reload the grading configuration before entering marks')
        const fields = mode === 'marks'
          ? { score: input.score, mentionId: input.mentionId, designation: input.designation ?? (input.score != null || input.mentionId ? 'scored' : undefined), status: existing?.status ?? input.status, notes: existing?.notes ?? input.notes }
          : { score: existing?.score, mentionId: existing?.mentionId, designation: existing?.designation, status: input.status, notes: input.notes }
        const result = captureGradeEntry(new AssessmentResultEntity({ ...input, ...fields, ...(policy && fields.score != null ? { originalEntry: { kind: 'numeric' as const, value: fields.score, maximum: assessment.maxScore } } : {}), revision: existing?.revision ?? 0, createdAt: existing?.createdAt }), assessment, policy, existing)
        await this.baseService.entities.assessmentResults.save(result)
        return result
      },
      persistResult: result => ({ id: result.id }),
      replay: async stored => this.requireEntity(this.baseService.entities.assessmentResults, stored.id),
      audit: result => [{ event: 'recordAssessmentResult', resourceType: 'assessmentResults', resourceId: result.id }],
    })
  }

  async recordAssessmentResults(input: RecordAssessmentResultsInput): Promise<AssessmentResult[]> {
    if (!input.results.length || input.results.length > 500)
      throw new BusinessRuleViolationError('MARK_BATCH_SIZE_INVALID', 'A marks batch must contain 1–500 rows')
    return this.baseService.commandExecution.execute({
      scope: await schoolCommandScope(this.baseService.actor, 'recordAssessmentResults', input.requestId),
      input,
      resultMode: 'ordinary',
      lockKeys: [academicStateLock(this.baseService.actor.schoolId)],
      authorize: async () => { await this.baseService.access.marksReview.edit(input.assessmentId) },
      execute: async () => {
        const assessment = await this.requireEntity(this.baseService.entities.assessments, input.assessmentId)
        assertMarksRevision(assessment, input.expectedRevision)
        const existing = await this.baseService.entities.assessmentResults.findByIds(input.results.map(row => row.id))
        const byId = new Map(existing.map(row => [row.id, row]))
        const policy = await assessmentGradingPolicy(this.repositories, assessment)
        if (input.expectedGradingRevision !== undefined && input.expectedGradingRevision !== (policy?.revision ?? 0))
          throw new BusinessRuleViolationError('GRADING_REVISION_CONFLICT', 'Reload the grading configuration before entering marks')
        const results = input.results.map((row) => {
          const before = byId.get(row.id)
          return captureGradeEntry(new AssessmentResultEntity({ ...row, ...(policy && row.score != null ? { originalEntry: { kind: 'numeric' as const, value: row.score, maximum: assessment.maxScore } } : {}), revision: before?.revision ?? 0, assessmentId: input.assessmentId, designation: row.designation ?? (row.score !== undefined || row.mentionId ? 'scored' : undefined), status: before?.status ?? row.status, notes: before?.notes ?? row.notes, createdAt: before?.createdAt }), assessment, policy, before)
        })
        await this.baseService.entities.assessmentResults.batchSave(results)
        return results
      },
      persistResult: results => ({ ids: results.map(result => result.id) }),
      replay: async (stored) => {
        const results = await this.baseService.entities.assessmentResults.findByIds(stored.ids)
        if (results.length !== stored.ids.length)
          denyResourceAccess()
        const byId = new Map(results.map(result => [result.id, result]))
        return stored.ids.map(id => byId.get(id)!)
      },
      audit: results => results.map(result => ({ event: 'recordAssessmentResults', resourceType: 'assessmentResults', resourceId: result.id })),
    })
  }

  async recordAssessmentResultCompliance(input: RecordAssessmentResultInput): Promise<AssessmentResult> {
    return this.writeAssessmentResult(input, 'compliance')
  }

  async listClassSubjectAssessmentResultsForPeriod({
    classSubjectId,
    periodId,
  }: ListClassSubjectAssessmentResultsForPeriodInput): Promise<AssessmentResult[]> {
    await this.requireEntity(this.baseService.entities.classSubjects, classSubjectId)
    await this.requireEntity(this.baseService.entities.academicPeriods, periodId)
    const assessments = await this.baseService.entities.assessments.list({ classSubjectId, periodId })
    const results: AssessmentResult[] = []
    for (let start = 0; start < assessments.length; start += 500) {
      results.push(...await this.baseService.entities.assessmentResults.list({ assessmentId: { $in: assessments.slice(start, start + 500).map(assessment => assessment.id) } }))
    }
    return results
  }

  async generateReportCardResult(input: GenerateReportCardResultInput): Promise<ReportCardResult> {
    return this.baseService.atomicExecution.execute(async () => {
      const student = await this.requireStudent(input.studentId)
      this.checkActorSchool(student.schoolId)

      await this.baseService.access.reportCards.assertGenerate(student.id)
      await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
      const published = await this.repositories.results.findOne({ studentId: input.studentId, periodId: input.periodId, status: ReportCardResultStatus.Published })
      const regeneratingRevision = Boolean(published?.revisedDraft)
      const regeneratingAnnual = regeneratingRevision || await this.requireReportCardNotPublished(input.studentId, input.periodId)
      if (regeneratingAnnual)
        await this.baseService.access.reportCards.assertPublish(student.id)
      const reportCard = await this.buildReportCardResult(input)
      if (published && (regeneratingRevision || published.grading)) {
        const revised = new ReportCardResult({ ...published.data, sectionResults: [...published.sectionResults], revisedDraft: reportCardSnapshotSchema.parse(reportCard) })
        await this.repositories.results.forSchool!(student.schoolId).save(revised)
        return this.refreshGeneratedRanking(revised, student.schoolId)
      }
      if (regeneratingAnnual) {
        // Only this authorized workflow may reopen an obsolete annual calculation.
        // Ordinary published grades remain immutable; issued snapshots retain their history.
        await this.repositories.results.save(reportCard)
      }
      else {
        await this.baseService.entities.results.save(reportCard)
      }
      return this.refreshGeneratedRanking(reportCard, student.schoolId)
    }, { lockKeys: [academicStateLock(this.baseService.actor.schoolId)] })
  }

  private async refreshGeneratedRanking(result: ReportCardResult, schoolId: string): Promise<ReportCardResult> {
    const revision = result.revisedDraft?.gradingPolicyRevision ?? result.gradingPolicyRevision
    if (revision === undefined)
      return result
    await this.repositories.assessmentDependencies.refreshGradingRankings({ schoolId, classGroupId: result.classGroupId, policyRevision: revision })
    // Apply the normal read projection: another stale class/period must not expose partial ranks.
    return this.requireEntity(this.baseService.entities.results, result.id)
  }

  async writeHomeroomReportComment(input: WriteHomeroomReportCommentInput): Promise<ReportCardResult> {
    return writeReportComments(this.baseService, input)
  }

  async writeReportCardSectionComments(input: WriteReportCardSectionCommentsInput): Promise<ReportCardResult> {
    return writeReportComments(this.baseService, input)
  }

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    const student = await this.requireStudent(input.studentId)
    this.checkActorSchool(student.schoolId)
    const period = await this.requirePeriod(input.periodId)
    const currentResult = await this.repositories.results.findOne({ studentId: input.studentId, periodId: input.periodId })
    const annualRevision = input.reviewedGradingRevision !== undefined
      ? `${input.id}:grading:${input.reviewedGradingRevision}:${input.reviewedDraftVersion}`
      : currentResult?.aggregation?.source === ReportCardAggregationSource.ReportCards
        ? `${input.id}:annual:${currentResult.status === ReportCardResultStatus.Published ? currentResult.version - 1 : currentResult.version}`
        : input.id
    let issuanceId: string | undefined
    return this.baseService.commandExecution.execute({
      scope: await schoolCommandScope(this.baseService.actor, 'publishReportCardResult', annualRevision),
      input,
      resultMode: 'ordinary',
      lockKeys: [
        academicStateLock(this.baseService.actor.schoolId),
        `report-card-publish:${input.studentId}:${input.periodId}`,
        documentNumberLockKey(this.baseService.actor.schoolId, 'bulletin', period.academicYearId),
      ],
      authorize: async () => {
        await this.baseService.access.reportCards.assertPublish(student.id)
        await this.requireReportCardResources(input.periodId, input.reportCardDefinitionId, student.schoolId)
      },
      execute: async () => {
        const existing = await this.repositories.results.findOne({ studentId: input.studentId, periodId: input.periodId, status: ReportCardResultStatus.Published })
        if (existing && !existing.revisedDraft) {
          if (input.reportCardDefinitionId && existing.reportCardDefinitionId !== input.reportCardDefinitionId)
            throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', 'The published report uses a different definition')
          // The student/period lock makes distinct concurrent request IDs converge.
          return this.requireEntity(this.baseService.entities.results, existing.id)
        }
        const revision = existing?.revisedDraft
        if (revision && (input.reviewedGradingRevision !== revision.gradingPolicyRevision || input.reviewedDraftVersion !== revision.version))
          throw new BusinessRuleViolationError('GRADING_REVIEW_REQUIRED', 'Review the current revised draft before republishing')
        if (revision?.calculationStale)
          throw new BusinessRuleViolationError('REPORT_CARD_SOURCE_REVISION_CONFLICT', 'Regenerate the revised draft after the latest mark changes')
        const generated = revision ? hydrateReportRevision(revision) : await this.buildReportCardResult(input, true)
        if (revision && generated.aggregation && !(await loadReportAggregationContext(this.repositories, generated.studentId, generated.aggregation, period)).readiness.canPublish)
          throw new BusinessRuleViolationError('AGGREGATED_REPORT_CARD_SOURCES_NOT_READY', 'Review and republish contributing reports first')
        if (revision && generated.aggregation?.source === ReportCardAggregationSource.ReportCards) {
          const sources = await loadReportAggregationContext(this.repositories, generated.studentId, generated.aggregation, period)
          for (const source of sources.priorResultsByPeriodId.values()) {
            if (generated.aggregation.sourceReportVersions?.find(row => row.resultId === source.id)?.sourceVersion !== await reportCardAcademicVersion(source))
              throw new BusinessRuleViolationError('REPORT_CARD_SOURCE_REVISION_CONFLICT', 'Regenerate the annual revised draft from the reviewed contributing reports')
          }
        }
        if (generated.pendingAssessmentIds.length)
          throw new BusinessRuleViolationError('REPORT_CARD_MARKS_NOT_SUBMITTED', 'All applicable evaluation sheets must be submitted before publication')
        const published = new ReportCardResult({
          ...generated.data,
          sectionResults: [...generated.sectionResults],
          revisedDraft: undefined,
          publicationHistory: revision && existing ? [...existing.publicationHistory, reportCardSnapshotSchema.parse(existing)] : generated.publicationHistory,
          status: ReportCardResultStatus.Published,
          publishedAt: input.publishedAt ?? new Date(),
        })
        if (revision) {
          await validateReportCardResultSave(published, existing, this.repositories, true)
          const scope = await this.baseService.access.entity('results').assertSave(published, existing)
          await this.repositories.results.forAccess(scope).save(published)
        }
        else {
          await this.baseService.entities.results.save(published)
        }
        await runWorkflowNotifications(this.baseService, REPORT_CARD_PUBLISHED_EVENT_KEY, {
          result: published,
          student,
        })
        try {
          const issuance = await new DocumentsServiceWorkflow(this.baseService).enqueueBulletinForPublishedResult({
            resultId: published.id,
            studentId: published.studentId,
            requestId: revision ? `bulletin:${published.id}:grading:${published.gradingPolicyRevision}:${published.version}` : published.aggregation?.source === ReportCardAggregationSource.ReportCards ? `bulletin:${published.id}:annual:${published.version}` : undefined,
          })
          issuanceId = issuance.id
        }
        catch (error) {
          if (error instanceof BusinessRuleViolationError && error.code === DOCUMENT_FAILURES.SOURCE_MISSING)
            return published
          if (error instanceof Error && /no section results/i.test(error.message))
            return published
          throw error
        }
        return published
      },
      replay: async (stored: { id: string }) => {
        const existing = await this.requireEntity(this.baseService.entities.results, stored.id)
        if (!existing)
          denyResourceAccess()
        return existing
      },
      persistResult: result => ({ id: result.id }),
      audit: result => [{ event: 'publishReportCardResult', resourceType: 'results', resourceId: result.id }],
      outbox: () => issuanceId
        ? [{ id: issuanceId, kind: DOCUMENT_RENDER_KIND, version: 1, resourceType: 'document-issuance', resourceId: issuanceId }]
        : [],
    })
  }

  private async requireReportCardResources(
    periodId: string,
    reportCardDefinitionId: string | undefined,
    schoolId: string,
  ): Promise<void> {
    const period = await this.repositories.academicPeriods.findById(periodId)
    const definition = reportCardDefinitionId
      ? await this.repositories.definitions.findById(reportCardDefinitionId)
      : undefined
    if (!period || period.schoolId !== schoolId || (reportCardDefinitionId && !definition)) {
      denyResourceAccess()
    }
    if (definition && definition.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async requireReportCardNotPublished(studentId: string, periodId: string): Promise<boolean> {
    const reportCard = await this.repositories.results.findOne({ studentId, periodId })
    if (reportCard?.status === ReportCardResultStatus.Published) {
      if (reportCard.aggregation?.source === ReportCardAggregationSource.ReportCards) {
        const sources = await loadReportAggregationContext(this.repositories, studentId, reportCard.aggregation)
        const versions = await Promise.all([...sources.priorResultsByPeriodId.values()].map(async source => ({ source, version: await reportCardAcademicVersion(source) })))
        if (sources.readiness.canPublish && versions.some(({ source, version }) =>
          reportCard.aggregation!.sourceReportVersions?.find(entry => entry.periodId === source.periodId)?.sourceVersion !== version,
        )) {
          return true
        }
      }
      throw new BusinessRuleViolationError('PUBLISHED_REPORT_CARD_IMMUTABLE', `Published report card for student ${studentId} and period ${periodId} is immutable`)
    }
    return false
  }

  async buildReportCardResult({
    id,
    studentId,
    periodId,
    reportCardDefinitionId,
    generatedAt,
    aggregation,
  }: GenerateReportCardResultInput, publishing = false, background = false): Promise<ReportCardResult> {
    const period = await this.requirePeriod(periodId)
    const existing = await this.repositories.results.findOne({ studentId, periodId })
    let resolvedAggregation = aggregation ?? existing?.aggregation
    let context = await loadReportAssessmentContext(this.repositories, period.schoolId, studentId, resolvedAggregation?.sourcePeriodIds ?? [periodId])
    const enrollment = this.requireEnrollmentForPeriod({
      enrollments: context.enrollments,
      academicYearId: period.academicYearId,
      at: period.endDate,
    })
    const classGroup = await this.requireClassGroup(enrollment.classGroupId)
    const policy = (await this.repositories.gradeLevels.findById(classGroup.gradeLevelId))?.gradingPolicyFor(period.academicYearId)
    if (policy && policy.status !== 'completed' && !background)
      throw new BusinessRuleViolationError('GRADING_UPDATE_IN_PROGRESS', 'Wait for grading recalculation to finish')
    const definition = reportCardDefinitionId
      ? await this.requireReportCardDefinition(reportCardDefinitionId)
      : await this.requireDefaultReportCardDefinition({
          gradeLevelId: classGroup.gradeLevelId,
          academicYearId: period.academicYearId,
        })
    context = await scopeReportAssessmentContext(this.repositories, context, definition.id, classGroup.id)
    const aggregationContext = resolvedAggregation ? await loadReportAggregationContext(this.repositories, studentId, resolvedAggregation, period, policy?.revision) : undefined
    if (resolvedAggregation?.source === ReportCardAggregationSource.ReportCards) {
      resolvedAggregation = {
        ...resolvedAggregation,
        sourceReportVersions: await Promise.all([...aggregationContext!.priorResultsByPeriodId.values()].map(async source => ({
          periodId: source.periodId,
          resultId: source.id,
          version: source.version,
          sourceVersion: await reportCardAcademicVersion(source),
        }))),
      }
    }
    const { sectionResults, overallAverage, assessmentResultCount, attendanceSummary, canPublish } = await this.buildReportCardResults({
      studentId,
      periodId,
      classGroupId: classGroup.id,
      reportCardDefinitionId: definition.id,
      aggregation: resolvedAggregation,
      aggregationContext,
      policy,
      period,
      context,
    })
    const sourceAssessments = context.assessments.filter(row => row.marksStatus === 'submitted').map(row => ({ assessmentId: row.id, revision: row.marksRevision }))
    const sourceMarks = context.results.map(({ result }) => ({ resultId: result.id, assessmentId: result.assessmentId, revision: result.revision }))
    if (publishing && !canPublish)
      throw new BusinessRuleViolationError(resolvedAggregation ? 'AGGREGATED_REPORT_CARD_SOURCES_NOT_READY' : 'ACADEMIC_PERIOD_NOT_PUBLISHED', 'Publish all required source periods and report cards before publishing this report')
    const periodAssessmentResults = context.results
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
      sectionResults: preserveReportComments(existing, definition.id, sectionResults),
      version: Math.max(existing?.version ?? 0, existing?.revisedDraft?.version ?? 0) + 1,
      sourceAssessments,
      sourceMarks,
      pendingCorrectionIds: await this.repositories.marksCorrections.pendingForMarks(period.schoolId, sourceMarks.map(row => row.resultId)),
      pendingAssessmentIds: context.assessments.filter(row => row.marksStatus !== 'submitted').map(row => row.id),
      calculationStale: false,
      attendanceSummary: resolvedAttendanceSummary,
      assessmentResultCount: assessmentResultCount ?? periodAssessmentResults.length,
      overallAverage: policy && overallAverage !== undefined ? describeGrade(overallAverage, policy).reportedValue : overallAverage,
      grading: policy && overallAverage !== undefined ? describeGrade(overallAverage, policy) : undefined,
      gradingPolicyRevision: policy?.revision,
      aggregateLabel: policy?.aggregateLabel,
      publicationHistory: existing?.publicationHistory,
      rank: existing?.status === ReportCardResultStatus.Published && !publishing ? undefined : existing?.rank,
      classSize: existing?.classSize,
      passThreshold: policy ? policy.scale.ranges.find(range => range.isPassing)?.minScore : existing?.passThreshold,
      teacherComment: existing?.teacherComment,
      principalComment: existing?.principalComment,
      status: canPublish && publishing ? (existing?.status ?? ReportCardResultStatus.Draft) : ReportCardResultStatus.Draft,
      generatedAt: existing?.generatedAt ?? generatedAt,
      publishedAt: publishing ? existing?.publishedAt : undefined,
      aggregation: resolvedAggregation,
    })
  }

  private async buildReportCardResults({
    studentId,
    classGroupId,
    reportCardDefinitionId,
    aggregation,
    aggregationContext,
    policy,
    period,
    context,
  }: {
    studentId: string
    periodId: string
    classGroupId: string
    reportCardDefinitionId: string
    context: ReportAssessmentContext
    period: AcademicPeriod
    policy?: GradingPolicy
    aggregationContext?: ReportAggregationContext
    aggregation?: ReportCardAggregation
  }): Promise<{
    sectionResults: ReportCardResultSection[]
    overallAverage?: number
    assessmentResultCount?: number
    attendanceSummary?: AttendanceSummary
    canPublish: boolean
  }> {
    const allSections = dedupeReportCardDefinitionSections(
      await this.repositories.sections.list({ reportCardDefinitionId }),
    ).sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
    const classSubjects = (await this.repositories.classSubjects.list({ classGroupId }))
      .filter(classSubject => classSubject.isOffered !== false)
    const classSubjectBySubject = new Map(classSubjects.map(classSubject => [classSubject.subjectId, classSubject]))

    if (!aggregation) {
      const singlePeriod = await this.buildSinglePeriodReportCardResults({
        classSubjectBySubject,
        allSections,
        context,
        policy,
      })
      return {
        ...singlePeriod,
        canPublish: period.isPublished,
      }
    }

    const { readiness, publishedPeriods: sourcePeriods, priorResultsByPeriodId } = aggregationContext!
    const publishedSourcePeriodIds = new Set(sourcePeriods.map(source => source.id))
    const assessmentsWithResults = context.results.filter(({ assessment }) => publishedSourcePeriodIds.has(assessment.periodId))

    const priorClassSubjectIds = new Set<string>()
    const collectSubjects = (nodes: readonly ReportCardResultSection[]) => {
      for (const node of nodes) {
        if (node.classSubjectId)
          priorClassSubjectIds.add(node.classSubjectId)
        collectSubjects(node.subResults)
      }
    }
    for (const result of priorResultsByPeriodId.values()) collectSubjects(result.sectionResults)
    const priorSubjectIdentities = new Map((await this.repositories.classSubjects.findByIds([...priorClassSubjectIds])).map(row => [row.id, row.subjectId]))

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
          ? buildSubjectAverageFromPriorReportCards(section.id, aggregation, priorResultsByPeriodId, { id: classSubject.subjectId, byClassSubject: priorSubjectIdentities }, policy)
          : buildSubjectAverageFromAssessments([...context.subjectByClassSubject].filter(([, subjectId]) => subjectId === classSubject.subjectId).map(([id]) => id), assessmentsWithResults, policy)
        return new ReportCardResultSection({
          sectionId: section.id,
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: section.name,
          average: policy && average !== undefined ? describeGrade(average, policy).reportedValue : average,
          grading: policy && average !== undefined ? describeGrade(average, policy) : undefined,
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
      return buildGroupResultFromChildren(section, childResults, policy)
    }

    const sectionResults: ReportCardResultSection[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0
    for (const root of rootReportCardDefinitionSections(allSections)) {
      const result = await computeNode(root)
      if (result) {
        sectionResults.push(result)
        if (result.average !== undefined) {
          rootSumWeights += root.weight
          rootSumWeightedPoints += (result.grading?.value ?? result.average) * root.weight
        }
      }
    }

    const attendanceSummary = sourcePeriods.length
      ? await this.buildAttendanceSummary({ studentId, periods: sourcePeriods })
      : new AttendanceSummary({ presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 })

    const overallAverage = rootSumWeights > 0 ? policy ? rootSumWeightedPoints / rootSumWeights : roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined
    return {
      sectionResults,
      overallAverage,
      assessmentResultCount: assessmentsWithResults.length,
      attendanceSummary,
      canPublish: readiness.canPublish,
    }
  }

  private async buildSinglePeriodReportCardResults({
    classSubjectBySubject,
    allSections,
    context,
    policy,
  }: {
    policy?: GradingPolicy
    classSubjectBySubject: Map<string, { id: string, subjectId: string }>
    allSections: ReportCardDefinitionSection[]
    context: ReportAssessmentContext
  }): Promise<{ sectionResults: ReportCardResultSection[], overallAverage?: number }> {
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
          [...context.subjectByClassSubject].filter(([, subjectId]) => subjectId === classSubject.subjectId).map(([id]) => id),
          context.results,
          policy,
        )
        return new ReportCardResultSection({
          sectionId: section.id,
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: section.name,
          average: policy && average !== undefined ? describeGrade(average, policy).reportedValue : average,
          grading: policy && average !== undefined ? describeGrade(average, policy) : undefined,
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
      return buildGroupResultFromChildren(section, childResults, policy)
    }

    const sectionResults: ReportCardResultSection[] = []
    let rootSumWeights = 0
    let rootSumWeightedPoints = 0
    for (const root of rootReportCardDefinitionSections(allSections)) {
      const result = await computeNode(root)
      if (result) {
        sectionResults.push(result)
        if (result.average !== undefined) {
          rootSumWeights += root.weight
          rootSumWeightedPoints += (result.grading?.value ?? result.average) * root.weight
        }
      }
    }
    const overallAverage = rootSumWeights > 0 ? policy ? rootSumWeightedPoints / rootSumWeights : roundTo2(rootSumWeightedPoints / rootSumWeights) : undefined
    return { sectionResults, overallAverage }
  }

  private requireEnrollmentForPeriod({ enrollments, academicYearId, at }: {
    enrollments: readonly StudentClassEnrollment[]
    academicYearId: string
    at: Date
  }): StudentClassEnrollment {
    const effective = enrollments.filter(row => row.academicYearId === academicYearId && enrollmentEffectiveAt(row, at))
    if (effective.length !== 1)
      throw new BusinessRuleViolationError('REPORT_CARD_ENROLLMENT_AMBIGUOUS', 'Exactly one enrollment must be effective at the end of the report period')
    return effective[0]!
  }

  private async requireReportCardDefinition(reportCardDefinitionId: string) {
    const definition = await this.repositories.definitions.findById(reportCardDefinitionId)
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
    const definition = await this.repositories.definitions.findOne({ gradeLevelId, academicYearId, isDefault: true })
    if (!definition) {
      throw new BusinessRuleViolationError('NO_DEFAULT_REPORT_CARD_DEFINITION', `No default report card definition for grade level ${gradeLevelId}`)
    }
    return definition
  }

  private async buildAttendanceSummary({
    studentId,
    startDate,
    endDate,
    periods,
  }: { studentId: string } & ({ startDate: Date, endDate: Date, periods?: never } | { periods: readonly AcademicPeriod[], startDate?: never, endDate?: never })): Promise<AttendanceSummary> {
    const records = await this.repositories.attendance.list({
      studentId,
      ...(periods ? { $or: periods.map(period => ({ date: { $gte: normalizeDate(period.startDate), $lte: normalizeDate(period.endDate) } })) } : { date: { $gte: normalizeDate(startDate!), $lte: normalizeDate(endDate!) } }),
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
