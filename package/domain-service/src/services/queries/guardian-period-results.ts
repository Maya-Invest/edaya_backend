import type { BaseSchoolService } from '../base-school-service'
import { BusinessRuleViolationError, calculateModuleReport, describeGrade, ReportCardAggregationSource, ReportCardResultSection, ReportCardResultSectionKind, ReportCardResultStatus } from '@edaya/core'
import { enrollmentEffectiveAt } from '../../capabilities/academics/marks-state'
import { loadReportAssessmentContext, scopeReportAssessmentContext } from '../../capabilities/academics/report-assessment-context'
import { buildSubjectAverageFromAssessments, buildSubjectAverageFromPriorReportCards, loadReportAggregationContext } from '../workflows/report-card-aggregation'

/** Never calls report generation or reads a revised draft into the family response. */
export async function getGuardianPeriodResults(base: BaseSchoolService, input: { studentId: string, periodId: string }) {
  const { period, enrollments, facts } = await base.access.reportCards.guardianPeriodContext(input.studentId, input.periodId)
  const reports = await base.entities.results.list({ studentId: input.studentId, periodId: period.id, status: ReportCardResultStatus.Published })
  const report = reports[0]
  const effective = enrollments.filter(row => enrollmentEffectiveAt(row, period.endDate))
  if (!report && effective.length !== 1)
    throw new BusinessRuleViolationError('REPORT_CARD_ENROLLMENT_AMBIGUOUS', 'Exactly one enrollment must be effective at the end of the report period')
  const group = await facts.one('classGroups', report?.classGroupId ?? effective[0]!.classGroupId)
  if (group.academicYearId !== period.academicYearId)
    throw new BusinessRuleViolationError('REPORT_PERIOD_SCOPE_INVALID', 'The placement must belong to the requested year')
  const level = await facts.one('gradeLevels', group.gradeLevelId)
  const policy = level.gradingPolicyFor(period.academicYearId)
  // Draft values and comments are never read. Only the source-period configuration
  // is needed to calculate a provisional annual view from family-visible inputs.
  const configured = report ?? (await facts.list('results', { studentId: input.studentId, periodId: period.id }))[0]
  const aggregation = configured?.aggregation
  const aggregationContext = !report && aggregation ? await loadReportAggregationContext(base.repositories, input.studentId, aggregation, period) : undefined
  const periodIds = aggregation?.sourcePeriodIds ?? [period.id]
  let context = await loadReportAssessmentContext(base.repositories, base.actor.schoolId, input.studentId, periodIds)
  context = await scopeReportAssessmentContext(base.repositories, context, group.gradeLevelId, period.academicYearId)
  // Access-scoped readers remain the authority for submitted marks, including historical records.
  const visibleMarks = context.results.length ? await base.entities.assessmentResults.list({ studentId: input.studentId, assessmentId: { $in: context.results.map(row => row.assessment.id) } }) : []
  const visibleIds = new Set(visibleMarks.map(row => row.id))
  const marks = context.results.filter(row => visibleIds.has(row.result.id))
  let ready = !!policy && policy.status === 'completed' && marks.every(({ result }) => !result.calculation || result.calculation.policyRevision === policy.revision)
  const subjects = await facts.list('subjects', { gradeLevelId: group.gradeLevelId, academicYearId: period.academicYearId })
  const modules = await facts.list('reportModules', { gradeLevelId: group.gradeLevelId, academicYearId: period.academicYearId })
  ready = ready && subjects.every(subject => subject.coefficient !== undefined)
    && (!aggregationContext || (aggregationContext.readiness.canPublish
      && [...aggregationContext.priorResultsByPeriodId.values()].every(source => source.gradingPolicyRevision === policy?.revision)))
  let sections: readonly ReportCardResultSection[] = report?.sectionResults ?? []
  let average: number | undefined = report?.overallAverage
  let grading = report?.grading
  if (!report) {
    const rows = subjects.flatMap((subject) => {
      const offerings = context.classSubjects.filter(row => row.subjectId === subject.id)
      const offering = offerings.find(row => row.classGroupId === group.id) ?? offerings[0]
      if (!offering)
        return []
      return [{ subject, classSubjectId: offering.id, average: ready
        ? aggregation?.source === ReportCardAggregationSource.ReportCards && aggregationContext
          ? buildSubjectAverageFromPriorReportCards(`subject:${subject.id}`, aggregation, aggregationContext.priorResultsByPeriodId, { id: subject.id, byClassSubject: new Map(context.classSubjects.map(row => [row.id, row.subjectId])) }, policy)
          : buildSubjectAverageFromAssessments(offerings.map(row => row.id), marks, policy)
        : undefined }]
    })
    if (ready && policy) {
      const calculated = calculateModuleReport(modules, rows, policy)
      sections = calculated.sectionResults
      average = calculated.overallAverage
      grading = average === undefined ? undefined : describeGrade(average, policy)
    }
    else {
      const leaves = rows.sort((a, b) => a.subject.reportOrder - b.subject.reportOrder || a.subject.name.localeCompare(b.subject.name)).map(({ subject, classSubjectId }) => new ReportCardResultSection({
        sectionId: `subject:${subject.id}`,
        sectionKind: ReportCardResultSectionKind.Subject,
        subjectId: subject.id,
        classSubjectId,
        moduleId: subject.reportModuleId,
        name: subject.name,
        coefficient: subject.coefficient,
        weight: 0,
        subResults: [],
      }))
      sections = [...modules.sort((a, b) => a.order - b.order).flatMap((module) => {
        const children = leaves.filter(row => row.moduleId === module.id)
        return children.length ? [new ReportCardResultSection({ sectionId: `module:${module.id}`, sectionKind: ReportCardResultSectionKind.Module, moduleId: module.id, name: module.name, weight: 0, subResults: children })] : []
      }), ...leaves.filter(row => !row.moduleId)]
    }
  }
  const serialize = (section: ReportCardResultSection): Record<string, unknown> => ({ ...section.data, subjectId: section.subjectId ?? context.classSubjects.find(row => row.id === section.classSubjectId)?.subjectId, subResults: section.subResults.map(serialize) })
  return {
    studentId: input.studentId,
    periodId: period.id,
    academicYearId: period.academicYearId,
    classGroupId: group.id,
    state: report ? 'published' as const : 'provisional' as const,
    calculationReady: report ? true : ready,
    reportId: report?.id ?? null,
    publishedAt: report?.publishedAt?.toISOString() ?? null,
    average: average ?? null,
    grading: grading ?? null,
    teacherComment: report?.teacherComment ?? null,
    principalComment: report?.principalComment ?? null,
    sections: sections.map(serialize),
    marks: marks.map(({ assessment, result }) => ({
      id: result.id,
      assessmentId: assessment.id,
      subjectId: context.subjectByClassSubject.get(assessment.classSubjectId) ?? '',
      classSubjectId: assessment.classSubjectId,
      periodId: assessment.periodId,
      title: assessment.title,
      date: (assessment.startsAt ?? assessment.dueAt)?.toISOString() ?? null,
      score: result.score ?? null,
      designation: result.designation,
      coefficient: assessment.coefficient,
      maxScore: assessment.maxScore,
      description: assessment.description ?? null,
      kind: assessment.kind,
      notes: result.notes ?? null,
      grading: result.calculation ?? null,
      originalEntry: result.data.originalEntry ?? null,
    })),
  }
}
