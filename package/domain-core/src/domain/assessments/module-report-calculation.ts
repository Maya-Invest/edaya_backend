import type { Subject } from '../academics/subject'
import type { GradingPolicy } from '../school/grading-policy'
import type { ReportModule } from './report-module'
import { describeGrade } from '../school/grading-policy'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { ReportCardResultSection, ReportCardResultSectionKind } from './report-card-result-section'

export interface ReportSubjectAverage {
  subject: Subject
  classSubjectId: string
  average?: number
}

/** Grouping and both weighting modes share this calculation for period and annual reports. */
export function calculateModuleReport(
  modules: readonly ReportModule[],
  subjects: readonly ReportSubjectAverage[],
  policy: GradingPolicy,
): { sectionResults: ReportCardResultSection[], overallAverage?: number } {
  const missing = subjects.filter(row => row.average !== undefined && row.subject.coefficient === undefined)
  if (missing.length)
    throw new BusinessRuleViolationError('REPORT_SUBJECT_COEFFICIENT_REQUIRED', 'Set coefficients for all contributing subjects', { subjects: missing.map(({ subject }) => ({ id: subject.id, name: subject.name })) })
  const moduleIds = new Set(modules.map(module => module.id))
  if (subjects.some(({ subject }) => subject.reportModuleId && !moduleIds.has(subject.reportModuleId)))
    throw new BusinessRuleViolationError('REPORT_MODULE_SCOPE_INVALID', 'Every assigned module must belong to the report level and year')
  const ids = new Set<string>()
  const rows = [...subjects].sort((a, b) => a.subject.reportOrder - b.subject.reportOrder || a.subject.name.localeCompare(b.subject.name) || a.subject.id.localeCompare(b.subject.id)).map(({ subject, classSubjectId, average }) => {
    if (ids.has(subject.id))
      throw new BusinessRuleViolationError('REPORT_SUBJECT_DUPLICATED', 'A subject may appear only once in a report')
    ids.add(subject.id)
    return new ReportCardResultSection({
      sectionId: `subject:${subject.id}`,
      sectionKind: ReportCardResultSectionKind.Subject,
      subjectId: subject.id,
      classSubjectId,
      moduleId: subject.reportModuleId,
      parentSectionId: subject.reportModuleId ? `module:${subject.reportModuleId}` : undefined,
      name: subject.name,
      order: subject.reportOrder,
      coefficient: subject.coefficient,
      weight: average === undefined ? 0 : subject.coefficient!,
      average: average === undefined ? undefined : describeGrade(average, policy).reportedValue,
      grading: average === undefined ? undefined : describeGrade(average, policy),
      subResults: [],
    })
  })
  const sectionResults: ReportCardResultSection[] = []
  for (const module of [...modules].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    const children = rows.filter(row => row.moduleId === module.id)
    if (!children.length)
      continue
    const coefficientSum = children.reduce((sum, row) => sum + row.weight, 0)
    const value = coefficientSum ? children.reduce((sum, row) => sum + (row.grading?.value ?? 0) * row.weight, 0) / coefficientSum : undefined
    const grading = value === undefined ? undefined : describeGrade(value, policy)
    sectionResults.push(new ReportCardResultSection({
      sectionId: `module:${module.id}`,
      sectionKind: ReportCardResultSectionKind.Module,
      moduleId: module.id,
      name: module.name,
      order: module.order,
      weightingMode: module.weightingMode,
      explicitWeight: module.explicitWeight,
      contributingCoefficientSum: coefficientSum,
      weight: value === undefined ? 0 : module.weightingMode === 'explicit' ? module.explicitWeight! : coefficientSum,
      average: grading?.reportedValue,
      grading,
      subResults: children,
    }))
  }
  sectionResults.push(...rows.filter(row => !row.moduleId))
  const weight = sectionResults.reduce((sum, row) => sum + row.weight, 0)
  const overallAverage = weight ? sectionResults.reduce((sum, row) => sum + (row.grading?.value ?? 0) * row.weight, 0) / weight : undefined
  return { sectionResults, overallAverage }
}
