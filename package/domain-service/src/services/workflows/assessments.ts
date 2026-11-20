import type { AcademicPeriod, Assessment, AssessmentInput, AssessmentResult, AssessmentResultInput, DecideMarksCorrectionInput, GradeScale, GradeScaleInput, GradingPolicy, RejectMarksCorrectionInput, ReportCardAggregation, ReportCardResultSection, RequestMarksCorrectionInput, ReviseMarksCorrectionInput, StudentClassEnrollment } from '@edaya/core'
import type { ReportAssessmentContext } from '../../capabilities/academics/report-assessment-context'
import type { BaseSchoolService } from '../base-school-service'
import type { AssessmentsWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import type { ConfigureGradeScaleInput } from './configuration-editors'
import type { ConfigureGradingInput, RetryGradingInput } from './grading-configuration'
import type { MarksReviewInput } from './marks-review'
import type { ReportAggregationContext } from './report-card-aggregation'
import type { HomeroomCommentInput, SectionCommentsInput } from './report-comments'
import type { ConfigureReportModulesInput, ConfigureReportSettingsInput } from './report-configuration'
import { denyResourceAccess } from '@edaya/authorization'
import { Assessment as AssessmentEntity, AssessmentResult as AssessmentResultEntity, AttendanceJustificationStatus, AttendanceStatus, AttendanceSummary, BusinessRuleViolationError, calculateModuleReport, describeGrade, DOCUMENT_FAILURES, GradeScale as GradeScaleEntity, normalizeDate, reportCardAcademicVersion, ReportCardAggregationSource, ReportCardResult, ReportCardResultStatus, reportCardSnapshotSchema, withShortName } from '@edaya/core'
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
import { ConfigurationEditorsWorkflow } from './configuration-editors'
import { DocumentsServiceWorkflow } from './documents'
import { GradingConfigurationWorkflow } from './grading-configuration'
import { MarksCorrectionsWorkflow } from './marks-corrections'
import { MarksReviewWorkflow } from './marks-review'
import { buildSubjectAverageFromAssessments, buildSubjectAverageFromPriorReportCards, loadReportAggregationContext } from './report-card-aggregation'
import { writeReportComments } from './report-comments'
import { ReportConfigurationWorkflow } from './report-configuration'

export interface PublishReportCardResultInput {
  reviewedReportConfigurationRevision?: number
  reviewedGradingRevision?: number
  reviewedDraftVersion?: number
  id: string
  studentId: string
  periodId: string
  publishedAt?: Date
  aggregation?: ReportCardAggregation
}

export interface GenerateReportCardResultInput {
  id: string
  studentId: string
  periodId: string
  generatedAt?: Date
  aggregation?: ReportCardAggregation
}

export type WriteHomeroomReportCommentInput = HomeroomCommentInput
export type WriteReportCardSectionCommentsInput = SectionCommentsInput

export type CreateGradeScaleInput = GradeScaleInput
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

  configureGradeScale(input: ConfigureGradeScaleInput) { return new ConfigurationEditorsWorkflow(this.baseService).configureScale(input) }
  configureReportModules(input: ConfigureReportModulesInput) { return new ReportConfigurationWorkflow(this.baseService).configure(input) }
  configureReportSettings(input: ConfigureReportSettingsInput) { return new ReportConfigurationWorkflow(this.baseService).configure(input) }

  configureGrading(input: ConfigureGradingInput) { return new GradingConfigurationWorkflow(this.baseService).configure(input) }
  retryGrading(input: RetryGradingInput) { return new GradingConfigurationWorkflow(this.baseService).retry(input) }

  async createGradeScale(input: CreateGradeScaleInput): Promise<GradeScale> {
    return this.baseService.atomicExecution.execute(async () => {
      const gradeScale = new GradeScaleEntity(withShortName(input))
      await this.baseService.entities.gradeScales.save(gradeScale)
      return gradeScale
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
      await this.requireReportCardResources(input.periodId, student.schoolId)
      const published = await this.repositories.results.findOne({ studentId: input.studentId, periodId: input.periodId, status: ReportCardResultStatus.Published })
      const regeneratingAnnual = Boolean(published)
      if (regeneratingAnnual)
        await this.baseService.access.reportCards.assertPublish(student.id)
      const reportCard = await this.buildReportCardResult(input)
      if (published) {
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
        await this.requireReportCardResources(input.periodId, student.schoolId)
      },
      execute: async () => {
        const existing = await this.repositories.results.findOne({ studentId: input.studentId, periodId: input.periodId, status: ReportCardResultStatus.Published })
        if (existing && !existing.revisedDraft) {
          // The student/period lock makes distinct concurrent request IDs converge.
          return this.requireEntity(this.baseService.entities.results, existing.id)
        }
        const revision = existing?.revisedDraft
        if (revision && (input.reviewedGradingRevision !== revision.gradingPolicyRevision || input.reviewedDraftVersion !== revision.version))
          throw new BusinessRuleViolationError('GRADING_REVIEW_REQUIRED', 'Review the current revised draft before republishing')
        if (revision?.calculationStale)
          throw new BusinessRuleViolationError('REPORT_CARD_SOURCE_REVISION_CONFLICT', 'Regenerate the revised draft after the latest mark changes')
        const draft = revision ?? await this.repositories.results.findOne({ studentId: input.studentId, periodId: input.periodId })
        if (!draft || draft.status === 'published' || draft.calculationStale || input.reviewedDraftVersion !== draft.version || input.reviewedGradingRevision !== draft.gradingPolicyRevision || input.reviewedReportConfigurationRevision !== draft.reportConfigurationRevision)
          throw new BusinessRuleViolationError('REPORT_REVIEW_REQUIRED', 'Generate and review the current report draft before publication')
        const generated = hydrateReportRevision(draft instanceof ReportCardResult ? draft.data : draft)
        if (generated.aggregation) {
          if (!(await loadReportAggregationContext(this.repositories, generated.studentId, generated.aggregation, period)).readiness.canPublish)
            throw new BusinessRuleViolationError('AGGREGATED_REPORT_CARD_SOURCES_NOT_READY', 'Review and republish contributing reports first')
        }
        else if (!period.isPublished) {
          throw new BusinessRuleViolationError('ACADEMIC_PERIOD_NOT_PUBLISHED', 'Publish the academic period first')
        }
        if (generated.aggregation?.source === ReportCardAggregationSource.ReportCards) {
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

  private async requireReportCardResources(periodId: string, schoolId: string): Promise<void> {
    const period = await this.repositories.academicPeriods.findById(periodId)
    if (!period || period.schoolId !== schoolId)
      denyResourceAccess()
  }

  async buildReportCardResult({
    id,
    studentId,
    periodId,
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
    const level = await this.repositories.gradeLevels.findById(classGroup.gradeLevelId)
    const policy = level?.gradingPolicyFor(period.academicYearId)
    if (!level || !policy)
      throw new BusinessRuleViolationError('GRADING_POLICY_REQUIRED', 'Configure grading for this grade level and academic year')
    const reportSettings = level.reportSettingsFor(period.academicYearId)
    if (policy && policy.status !== 'completed' && !background)
      throw new BusinessRuleViolationError('GRADING_UPDATE_IN_PROGRESS', 'Wait for grading recalculation to finish')
    context = await scopeReportAssessmentContext(this.repositories, context, classGroup.gradeLevelId, period.academicYearId)
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
      gradeLevelId: classGroup.gradeLevelId,
      academicYearId: period.academicYearId,
      reportConfigurationRevision: reportSettings.revision,
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
      gradeLevelId: classGroup.gradeLevelId,
      academicYearId: period.academicYearId,
      reportConfigurationRevision: reportSettings.revision,
      studentId,
      classGroupId: classGroup.id,
      periodId,
      sectionResults: preserveReportComments(existing?.revisedDraft ? hydrateReportRevision(existing.revisedDraft) : existing, sectionResults, reportSettings.revision),
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
      passThreshold: reportSettings.passThreshold,
      teacherComment: existing?.revisedDraft?.teacherComment ?? existing?.teacherComment,
      principalComment: existing?.revisedDraft?.principalComment ?? existing?.principalComment,
      status: canPublish && publishing ? (existing?.status ?? ReportCardResultStatus.Draft) : ReportCardResultStatus.Draft,
      generatedAt: existing?.generatedAt ?? generatedAt,
      publishedAt: publishing ? existing?.publishedAt : undefined,
      aggregation: resolvedAggregation,
    })
  }

  private async buildReportCardResults({ studentId, classGroupId, gradeLevelId, academicYearId, aggregation, aggregationContext, policy, period, context }: {
    studentId: string
    periodId?: string
    classGroupId: string
    gradeLevelId: string
    academicYearId: string
    reportConfigurationRevision?: number
    aggregation?: ReportCardAggregation
    aggregationContext?: ReportAggregationContext
    policy: GradingPolicy
    period: AcademicPeriod
    context: ReportAssessmentContext
  }) {
    const subjects = await this.repositories.subjects.list({ schoolId: period.schoolId, gradeLevelId, academicYearId })
    const modules = await this.repositories.reportModules.list({ schoolId: period.schoolId, gradeLevelId, academicYearId })
    const offerings = [...context.classSubjects].sort((a, b) => Number(a.classGroupId === classGroupId) - Number(b.classGroupId === classGroupId))
    const bySubject = new Map(offerings.map(row => [row.subjectId, row]))
    const prior = aggregationContext?.priorResultsByPeriodId ?? new Map<string, ReportCardResult>()
    const priorIdentities = new Map<string, string>()
    const collect = (nodes: readonly ReportCardResultSection[]) => {
      for (const node of nodes) {
        if (node.subjectId && node.classSubjectId)
          priorIdentities.set(node.classSubjectId, node.subjectId)
        collect(node.subResults)
      }
    }
    for (const result of prior.values()) collect(result.sectionResults)
    const publishedIds = new Set(aggregationContext?.publishedPeriods.map(row => row.id))
    const marks = aggregation ? context.results.filter(row => publishedIds.has(row.assessment.periodId)) : context.results
    const rows = subjects.flatMap((subject) => {
      const offering = bySubject.get(subject.id)
      if (!offering)
        return []
      const average = aggregation?.source === ReportCardAggregationSource.ReportCards
        ? buildSubjectAverageFromPriorReportCards(`subject:${subject.id}`, aggregation, prior, { id: subject.id, byClassSubject: priorIdentities }, policy)
        : buildSubjectAverageFromAssessments([...context.subjectByClassSubject].filter(([, id]) => id === subject.id).map(([id]) => id), marks, policy)
      return [{ subject, classSubjectId: offering.id, average }]
    })
    return {
      ...calculateModuleReport(modules, rows, policy),
      assessmentResultCount: marks.length,
      attendanceSummary: aggregationContext ? await this.buildAttendanceSummary({ studentId, periods: aggregationContext.publishedPeriods }) : undefined,
      canPublish: aggregationContext ? aggregationContext.readiness.canPublish : period.isPublished,
    }
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
