import type { AcademicPeriod, ReportCardResult, ReportCardResultSection } from '@edaya/core'
import type { ReportCardDocumentContext, ReportCardV1SubjectRow } from './build-report-card-v1-payload'
import { BusinessRuleViolationError, ReportCardResultSectionKind, weightForPeriod } from '@edaya/core'
import { buildReportCardV1Payload } from './build-report-card-v1-payload'
import { catalogBulletinSection, catalogLangFromLocale, catalogPeriodLabel, catalogText } from './catalog-label'

export interface AnnualReportCardDocumentContext extends ReportCardDocumentContext {
  periods: readonly { period: AcademicPeriod, result: ReportCardResult }[]
  subjectIdByClassSubjectId: ReadonlyMap<string, string>
}

export function buildAnnualReportCardV1Payload(input: AnnualReportCardDocumentContext) {
  const locale = input.locale ?? 'fr-FR'
  const lang = catalogLangFromLocale(locale)
  const formatter = new Intl.NumberFormat(locale, { minimumFractionDigits: input.result.grading?.decimalPlaces ?? 2, maximumFractionDigits: input.result.grading?.decimalPlaces ?? 2 })
  const format = (value: number | undefined) => value === undefined ? '—' : formatter.format(value)
  const periods = [...input.periods].sort((a, b) => a.period.startDate.getTime() - b.period.startDate.getTime() || a.period.id.localeCompare(b.period.id))
  const subjectId = (section: ReportCardResultSection) => {
    const id = section.subjectId ?? (section.classSubjectId && input.subjectIdByClassSubjectId.get(section.classSubjectId))
    if (!id)
      throw new BusinessRuleViolationError('DOCUMENT_SOURCE_MISSING', 'A report subject could not be resolved')
    return id
  }
  const groupKey = (section: ReportCardResultSection) => section.moduleId ?? section.sectionId
  const values = (result: ReportCardResult) => {
    const subjects = new Map<string, ReportCardResultSection>()
    const groups = new Map<string, ReportCardResultSection>()
    const walk = (nodes: readonly ReportCardResultSection[]) => {
      for (const node of nodes) {
        if (node.sectionKind === ReportCardResultSectionKind.Subject) {
          const id = subjectId(node)
          if (subjects.has(id))
            throw new BusinessRuleViolationError('DOCUMENT_INPUT_CONFLICT', 'A subject appears more than once in a report')
          subjects.set(id, node)
        }
        else {
          const key = groupKey(node)
          if (key)
            groups.set(key, node)
          walk(node.subResults)
        }
      }
    }
    walk(result.sectionResults)
    return { subjects, groups }
  }
  const sourceValues = periods.map(entry => values(entry.result))
  const seen = new Set<string>()
  const rows: Array<ReportCardV1SubjectRow & { periodAverages: string[] }> = []
  const row = (section: ReportCardResultSection, kind: 'subject' | 'bilan', periodAverages: string[]) => ({
    name: kind === 'subject'
      ? section.name
      : catalogBulletinSection(catalogText(section.name, lang), lang),
    kind,
    average: `${format(section.average)}${section.grading ? ` · ${section.grading.mention.code}` : ''}`,
    coefficient: kind === 'subject' ? (section.coefficient === undefined ? '—' : String(section.coefficient)) : String(section.weight),
    total: format(section.average === undefined ? undefined : (section.grading?.value ?? section.average) * section.weight),
    rank: section.rank === undefined ? undefined : `${section.rank} / ${input.result.classSize ?? '—'}`,
    appreciation: section.comment,
    teacherName: kind === 'subject' ? input.teacherNameByClassSubjectId?.get(section.classSubjectId!) : undefined,
    teachers: kind === 'subject' ? input.teachersByClassSubjectId?.get(section.classSubjectId!) : undefined,
    periodAverages,
  })
  const walk = (nodes: readonly ReportCardResultSection[]) => {
    for (const node of nodes) {
      if (node.sectionKind === ReportCardResultSectionKind.Subject) {
        const id = subjectId(node)
        if (seen.has(id))
          throw new BusinessRuleViolationError('DOCUMENT_INPUT_CONFLICT', 'A subject appears more than once in the annual report')
        seen.add(id)
        rows.push(row(node, 'subject', sourceValues.map(source => format(source.subjects.get(id)?.average))))
      }
      else {
        walk(node.subResults)
        if (node.subResults.length)
          rows.push(row(node, 'bilan', sourceValues.map(source => format(source.groups.get(groupKey(node))?.average))))
      }
    }
  }
  walk(input.result.sectionResults)
  for (const source of sourceValues) {
    for (const [id, section] of source.subjects) {
      if (seen.has(id))
        continue
      seen.add(id)
      rows.push({
        name: section.name,
        kind: 'subject',
        teacherName: input.teacherNameByClassSubjectId?.get(section.classSubjectId!),
        teachers: input.teachersByClassSubjectId?.get(section.classSubjectId!),
        average: '—',
        coefficient: '—',
        total: '—',
        periodAverages: sourceValues.map(value => format(value.subjects.get(id)?.average)),
      })
    }
  }
  const gradedSubjects = input.result.sectionResults.filter(section => section.average !== undefined)
  rows.push({
    coefficient: String(gradedSubjects.reduce((sum, section) => sum + section.weight, 0)),
    total: gradedSubjects.length ? format(gradedSubjects.reduce((sum, section) => sum + (section.grading?.value ?? section.average!) * section.weight, 0)) : '—',
    name: input.result.aggregateLabel ?? (lang === 'en' ? 'Overall average' : 'Moyenne générale'),
    kind: 'totals',
    average: format(input.result.overallAverage),
    rank: input.result.rank === undefined ? undefined : `${input.result.rank} / ${input.result.classSize ?? '—'}`,
    periodAverages: periods.map(entry => format(entry.result.overallAverage)),
  })
  return {
    ...buildReportCardV1Payload(input),
    subjects: rows,
    periods: periods.map(({ period, result }) => ({
      id: period.id,
      label: catalogPeriodLabel(period.name, lang),
      weight: String(weightForPeriod(input.result.aggregation!, period.id)),
      average: format(result.overallAverage),
    })),
  }
}
