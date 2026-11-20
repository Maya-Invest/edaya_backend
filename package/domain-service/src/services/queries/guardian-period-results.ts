import type { Assessment, AssessmentResult } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, calculateModuleReport, describeGrade, DomainValidationError, ReportCardAggregationSource, ReportCardResultSection, ReportCardResultSectionKind, ReportCardResultStatus } from '@edaya/core'
import { evaluationRankings, subjectStandings, subjectStandingsFromReports } from '../../capabilities/academics/live-rankings'
import { enrollmentEffectiveAt } from '../../capabilities/academics/marks-state'
import { loadReportAssessmentContext, scopeReportAssessmentContext } from '../../capabilities/academics/report-assessment-context'
import { loadInBatches } from '../../capabilities/shared/bounded-reads'
import { buildSubjectAverageFromAssessments, buildSubjectAverageFromPriorReportCards, loadReportAggregationContext } from '../workflows/report-card-aggregation'

interface PeriodInput { studentId: string, periodId: string }

async function guardianContext(base: BaseSchoolService, input: PeriodInput, access = base.access) {
  const { period, enrollments, facts } = await access.reportCards.guardianPeriodContext(input.studentId, input.periodId)
  const reports = await base.entities.results.list({ studentId: input.studentId, periodId: period.id, status: ReportCardResultStatus.Published }, access)
  const report = reports[0]
  const effective = enrollments.filter(row => enrollmentEffectiveAt(row, period.endDate))
  if (!report && effective.length !== 1)
    throw new BusinessRuleViolationError('REPORT_CARD_ENROLLMENT_AMBIGUOUS', 'Exactly one enrollment must be effective at the end of the report period')
  const group = await facts.one('classGroups', report?.classGroupId ?? effective[0]!.classGroupId)
  if (group.academicYearId !== period.academicYearId)
    throw new BusinessRuleViolationError('REPORT_PERIOD_SCOPE_INVALID', 'The placement must belong to the requested year')
  return { period, facts, report, group, access }
}

type GuardianContext = Awaited<ReturnType<typeof guardianContext>>

function periodFields(input: PeriodInput, { period, report, group }: GuardianContext) {
  return {
    studentId: input.studentId,
    periodId: period.id,
    academicYearId: period.academicYearId,
    classGroupId: group.id,
    state: report ? 'published' as const : 'provisional' as const,
    reportId: report?.id ?? null,
    publishedAt: report?.publishedAt?.toISOString() ?? null,
    teacherComment: report?.teacherComment ?? null,
    principalComment: report?.principalComment ?? null,
  }
}

function serializeMark(assessment: Assessment, result: AssessmentResult, subjectId: string, ranks: ReturnType<typeof evaluationRankings>) {
  return {
    ...ranks.get(result.id),
    id: result.id,
    assessmentId: assessment.id,
    subjectId,
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
  }
}

/** Never calls report generation or reads a revised draft into the family response. */
async function readPeriod(base: BaseSchoolService, input: PeriodInput, authorized: GuardianContext, includeMarks: boolean, requestedSubject?: string) {
  const { facts, period, report, group, access } = authorized
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
  const visibleMarks = context.results.length ? await base.entities.assessmentResults.list({ studentId: input.studentId, assessmentId: { $in: context.results.map(row => row.assessment.id) } }, access) : []
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
  // Cohort reads are internal. Only the authorized child's aggregate leaves this query.
  const visibleSheets = new Map((includeMarks ? marks : []).map(({ assessment }) => [assessment.id, assessment]))
  const liveSubjects = !report && ready && aggregation?.source !== ReportCardAggregationSource.ReportCards
  const targetSubjectId = requestedSubject ? (context.classSubjects.find(row => row.id === requestedSubject)?.subjectId ?? requestedSubject) : undefined
  const offerings = context.classSubjects.filter(row => row.classGroupId === group.id
    && (!targetSubjectId || row.subjectId === targetSubjectId))
  const classSheets = liveSubjects
    ? await loadInBatches(offerings.map(row => row.id), ids =>
        base.repositories.assessments.list({ classGroupId: group.id, periodId: { $in: periodIds }, classSubjectId: { $in: ids }, marksStatus: 'submitted' }))
    : []
  const sheets = new Map([...visibleSheets, ...classSheets.map(row => [row.id, row] as const)])
  const cohort = await loadInBatches([...sheets.keys()], ids => base.repositories.assessmentResults.list({ assessmentId: { $in: ids } }))
  const ranks = evaluationRankings([...visibleSheets.values()], cohort)
  let standings = subjectStandings(classSheets, cohort, policy)
  if (!report && ready && policy && aggregation?.source === ReportCardAggregationSource.ReportCards) {
    const enrollment = await base.repositories.enrollments.list({ classGroupId: group.id })
    const members = enrollment.filter(row => enrollmentEffectiveAt(row, period.endDate)).map(row => row.studentId)
    const sources = await loadInBatches(members, ids => base.repositories.results.list({ studentId: { $in: ids }, classGroupId: group.id, periodId: { $in: periodIds }, status: ReportCardResultStatus.Published }))
    standings = subjectStandingsFromReports(sources, context.classSubjects.filter(row => row.classGroupId === group.id), aggregation, policy)
  }
  function liveRank(section: ReportCardResultSection) {
    const standing = section.classSubjectId && standings.get(section.classSubjectId)?.get(input.studentId)
    if (section.sectionKind === 'subject' && standing && standing.value === (section.grading?.reportedValue ?? section.average))
      return { rank: standing.rank, participantCount: standing.participantCount }
    return {}
  }
  const serialize = (section: ReportCardResultSection): Record<string, unknown> => ({ ...section.data, ...liveRank(section), subjectId: section.subjectId ?? context.classSubjects.find(row => row.id === section.classSubjectId)?.subjectId, subResults: section.subResults.map(serialize) })
  return {
    ...periodFields(input, authorized),
    calculationReady: report ? true : ready,
    average: average ?? null,
    grading: grading ?? null,
    sections: sections.map(serialize),
    marks: includeMarks ? marks.map(({ assessment, result }) => serializeMark(assessment, result, context.subjectByClassSubject.get(assessment.classSubjectId) ?? '', ranks)) : [],
  }
}

export async function getGuardianPeriodResults(base: BaseSchoolService, input: PeriodInput) {
  return readPeriod(base, input, await guardianContext(base, input), true)
}

function missingSubject(sections: readonly ReportCardResultSection[]): boolean {
  return sections.some(section => (!!section.classSubjectId && !section.subjectId) || missingSubject(section.subResults))
}

async function overview(base: BaseSchoolService, input: PeriodInput, authorized: GuardianContext, requestedSubject?: string) {
  const { report } = authorized
  if (report && !missingSubject(report.sectionResults)) {
    const serialize = (section: ReportCardResultSection): Record<string, unknown> => ({ ...section.data, subjectId: section.subjectId, subResults: section.subResults.map(serialize) })
    return { ...periodFields(input, authorized), calculationReady: true, average: report.overallAverage ?? null, grading: report.grading ?? null, sections: report.sectionResults.map(serialize) }
  }
  // Older report sections may only identify an offering. Resolve it using the same
  // pupil participation and period curriculum as the complete report.
  const { marks: _marks, ...summary } = await readPeriod(base, input, authorized, false, requestedSubject)
  return summary
}

export function getGuardianPeriodOverview(base: BaseSchoolService, input: PeriodInput) {
  return base.atomicExecution.execute(async () => overview(base, input, await guardianContext(base, input, base.access.forOperation())), { readSnapshot: true })
}

interface SubjectMarksInput extends PeriodInput {
  subjectId: string
  cursor?: string
  limit?: number
  focusMarkId?: string
}

function decodeCursor(value: string | undefined) {
  if (value === undefined)
    return undefined
  try {
    const data: unknown = JSON.parse(value)
    if (Array.isArray(data) && data.length === 2 && typeof data[1] === 'string' && data[1].length
      && (data[0] === null || (typeof data[0] === 'string' && new Date(data[0]).toISOString() === data[0]))) {
      return { date: data[0] as string | null, id: data[1] as string }
    }
  }
  catch {}
  throw new DomainValidationError('Invalid subject marks cursor')
}

function findSubject(sections: Record<string, unknown>[], id: string): Record<string, unknown> | undefined {
  for (const section of sections) {
    const { sectionKind, subjectId, classSubjectId, subResults } = section
    if (sectionKind === 'subject' && (subjectId === id || classSubjectId === id))
      return section
    if (Array.isArray(subResults)) {
      const nested = findSubject(subResults, id)
      if (nested)
        return nested
    }
  }
  return undefined
}

export async function getGuardianSubjectMarks(base: BaseSchoolService, input: SubjectMarksInput) {
  const limit = input.limit ?? 30
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    throw new DomainValidationError('Subject marks page size must be between 1 and 100')
  const after = decodeCursor(input.cursor)
  return base.atomicExecution.execute(async () => {
    const authorized = await guardianContext(base, input, base.access.forOperation())
    const { period, report, facts, group } = authorized
    const summary = await overview(base, input, authorized, input.subjectId)
    const section = findSubject(summary.sections, input.subjectId) ?? null
    const fields = { periodId: period.id, periodName: period.name, academicYearId: period.academicYearId, state: summary.state, section }
    if (!section)
      return { ...fields, marks: [], focusedMark: null, nextCursor: null }

    const configured = report ?? (await facts.list('results', { studentId: input.studentId, periodId: period.id }))[0]
    const { subjectId, classSubjectId } = section
    const filter = {
      schoolId: base.actor.schoolId,
      studentId: input.studentId,
      academicYearId: period.academicYearId,
      gradeLevelId: group.gradeLevelId,
      periodIds: configured?.aggregation?.sourcePeriodIds ?? [period.id],
      subjectId: typeof subjectId === 'string' ? subjectId : undefined,
      classSubjectId: typeof classSubjectId === 'string' ? classSubjectId : undefined,
    }
    const scope = await authorized.access.entity('assessmentResults').readScope()
    const repo = base.repositories
    const page = await repo.assessmentDependencies.guardianSubjectMarks(scope, { ...filter, after, limit: limit + 1 })
    const selected = page.slice(0, limit)
    const focus = input.focusMarkId && !selected.some(row => row.id === input.focusMarkId)
      ? await repo.assessmentDependencies.guardianSubjectMarks(scope, { ...filter, markId: input.focusMarkId, limit: 1 })
      : []
    const rows = [...selected, ...focus]
    const ids = rows.map(row => row.assessmentId)
    const sheets = await loadInBatches(ids, batch => repo.assessments.findByIds(batch))
    const cohort = await loadInBatches(ids, batch => repo.assessmentResults.list({ assessmentId: { $in: batch } }))
    const byId = new Map(sheets.map(sheet => [sheet.id, sheet]))
    const byMark = new Map(cohort.map(mark => [mark.id, mark]))
    const ranks = evaluationRankings(sheets, cohort)
    const toMark = (row: (typeof rows)[number]) => serializeMark(byId.get(row.assessmentId)!, byMark.get(row.id)!, row.subjectId, ranks)
    const marks = selected.map(toMark)
    const last = marks.at(-1)
    return { ...fields, marks, focusedMark: focus[0] ? toMark(focus[0]) : null, nextCursor: last && page.length > limit ? JSON.stringify([last.date, last.id]) : null }
  }, { readSnapshot: true })
}

/** Agenda may show assessments from a historical placement without a period report. */
export async function getGuardianAssessmentResult(base: BaseSchoolService, input: { studentId: string, assessmentId: string }, access = base.access) {
  if (base.actor.kind !== 'guardian')
    denyResourceAccess()
  const [result] = await base.entities.assessmentResults.list(input, access)
  if (!result)
    return { mark: null }
  const assessment = await base.entities.assessments.findById(input.assessmentId, access)
  if (!assessment || assessment.marksStatus !== 'submitted')
    return { mark: null }
  const cohort = await base.repositories.assessmentResults.list({ assessmentId: assessment.id })
  const ranks = evaluationRankings([assessment], cohort)
  return { mark: { ...ranks.get(result.id), assessmentId: assessment.id, score: result.score ?? null, maxScore: assessment.maxScore, designation: result.designation, grading: result.calculation ?? null, originalEntry: result.originalEntry ?? null } }
}
