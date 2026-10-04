import { AcademicPeriod, assertAnnualReportCardSources, reportCardAcademicVersion, ReportCardAggregationSource, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus, School, Student } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { applyReportCommentRevision } from '../../src/capabilities/academics/report-comment-revisions'
import { buildAnnualReportCardV1Payload } from '../../src/capabilities/documents/build-annual-report-card-v1-payload'
import { buildSubjectAverageFromPriorReportCards } from '../../src/services/workflows/report-card-aggregation'

const period = (id: string, month: string) => new AcademicPeriod({ id, schoolId: 'school', academicYearId: 'year', name: id, startDate: new Date(`2026-${month}-01`), endDate: new Date(`2026-${month}-28`), isPublished: true })
const leaf = (id: string, classSubjectId: string, average?: number) => new ReportCardResultSection({ sectionId: id, sectionKind: ReportCardDefinitionSectionKind.Subject, name: 'A very long subject name with a changed class subject record', classSubjectId, average, weight: 3, rank: 2, comment: 'Annual feedback', subResults: [] })
const group = (id: string, children: ReportCardResultSection[]) => new ReportCardResultSection({ sectionId: id, sectionKind: ReportCardDefinitionSectionKind.Group, name: 'BILAN SCIENCES', average: children[0]?.average, weight: 1, subResults: children })
const report = (id: string, periodId: string, section: ReportCardResultSection, average?: number) => new ReportCardResult({ id, periodId, studentId: 'student', classGroupId: 'class', reportCardDefinitionId: 'definition', status: ReportCardResultStatus.Published, publishedAt: new Date('2026-07-01'), generatedAt: new Date('2026-06-30'), overallAverage: average, rank: 2, classSize: 30, sectionResults: [section], attendanceSummary: { presentCount: 40, absenceCount: 2, excusedAbsenceCount: 1, lateCount: 1 }, assessmentResultCount: 0 })

async function fixture() {
  const first = report('r1', 'S1', group('old-group', [group('nested', [leaf('old-section', 'old-cs', 0)])]), 0)
  const second = report('r2', 'S2', group('other-group', [leaf('new-section', 'new-cs')]))
  const annualBase = report('annual', 'yearly', group('annual-group', [group('annual-nested', [leaf('annual-section', 'annual-cs', 9)])]), 9)
  const annual = new ReportCardResult({ ...annualBase.data, sectionResults: [...annualBase.sectionResults], aggregation: { source: ReportCardAggregationSource.ReportCards, sourcePeriodIds: ['S2', 'S1'], periodWeightsByPeriodId: { S1: 1, S2: 3 }, sourceReportVersions: await Promise.all([first, second].map(async result => ({ resultId: result.id, periodId: result.periodId, version: result.version, sourceVersion: await reportCardAcademicVersion(result) }))) } })
  return { first, second, annual, contributors: [{ period: period('S2', '05'), result: second }, { period: period('S1', '01'), result: first }] }
}

describe('annual report card academic payload and provenance', () => {
  test('annual calculation follows canonical identity across changed nested sections and preserves zero', async () => {
    const f = await fixture()
    const identities = { id: 'math', byClassSubject: new Map([['old-cs', 'math'], ['new-cs', 'math']]) }
    expect(buildSubjectAverageFromPriorReportCards('annual-section', f.annual.aggregation!, new Map([['S1', f.first], ['S2', f.second]]), identities)).toBe(0)
    const second = new ReportCardResult({ ...f.second.data, sectionResults: [group('changed-group', [leaf('changed-section', 'new-cs', 12)])] })
    expect(buildSubjectAverageFromPriorReportCards('annual-section', f.annual.aggregation!, new Map([['S1', f.first], ['S2', second]]), identities)).toBe(9)
    const third = report('r3', 'T3', group('third-group', [leaf('third-section', 'new-cs', 20)]), 20)
    expect(buildSubjectAverageFromPriorReportCards('annual-section', { source: ReportCardAggregationSource.ReportCards, sourcePeriodIds: ['S1', 'S2', 'T3'], periodWeightsByPeriodId: { S1: 1, S2: 3, T3: 2 } }, new Map([['S1', f.first], ['S2', second], ['T3', third]]), identities)).toBe(12.67)
  })

  test('historical council feedback cannot replace regenerated annual grades', async () => {
    const f = await fixture()
    const obsolete = new ReportCardResult({ ...f.annual.data, overallAverage: 1, teacherComment: 'Reviewed feedback', sectionResults: [group('annual-group', [group('annual-nested', [leaf('annual-section', 'annual-cs', 1)])])] })
    const revised = applyReportCommentRevision(f.annual, obsolete.data)
    expect(revised.overallAverage).toBe(9)
    expect(revised.sectionResults[0]?.subResults[0]?.subResults[0]?.average).toBe(9)
    expect(revised.teacherComment).toBe('Reviewed feedback')
  })
  for (const locale of ['fr-FR', 'en-US']) {
    test(`maps canonical subjects recursively and retains published annual values (${locale})`, async () => {
      const f = await fixture()
      const payload = buildAnnualReportCardV1Payload({ result: f.annual, periods: f.contributors, student: new Student({ id: 'student', schoolId: 'school', firstName: 'Ada', lastName: 'Lovelace' }), school: new School({ id: 'school', name: 'School', timeZone: 'UTC' }), periodLabel: 'Annual', schoolYear: '2025-2026', locale, subjectIdByClassSubjectId: new Map([['old-cs', 'math'], ['new-cs', 'math'], ['annual-cs', 'math']]), teacherNameByClassSubjectId: new Map([['annual-cs', 'Annual teacher']]) })
      const decimal = locale.startsWith('fr') ? ',' : '.'
      expect(payload.periods.map(entry => entry.id)).toEqual(['S1', 'S2'])
      expect(payload.periods.map(entry => entry.weight)).toEqual(['1', '3'])
      expect(payload.subjects[0]).toMatchObject({ periodAverages: [`0${decimal}00`, '—'], average: `9${decimal}00`, coefficient: '3', total: `27${decimal}00`, teacherName: 'Annual teacher', rank: '2 / 30', appreciation: 'Annual feedback' })
      expect(payload.subjects.filter(row => row.kind === 'bilan')).toHaveLength(2)
      expect(payload.subjects.at(-1)?.total).toBe(`27${decimal}00`)
      expect(payload.attendance?.absenceHoursTotal).toBe('2')
    })
  }

  test('requires every recorded contributor and detects academic changes without a revision bump', async () => {
    const f = await fixture()
    const annualPeriod = new AcademicPeriod({ ...period('yearly', '01').data, endDate: new Date('2026-06-30') })
    await assertAnnualReportCardSources(f.annual, annualPeriod, f.contributors)
    expect(await reportCardAcademicVersion(f.annual)).toMatch(/^[a-f0-9]{64}$/)
    const reweighted = new ReportCardResult({ ...f.annual.data, sectionResults: [...f.annual.sectionResults], aggregation: { ...f.annual.aggregation!, periodWeightsByPeriodId: { S1: 2, S2: 3 } } })
    expect(await reportCardAcademicVersion(reweighted)).not.toBe(await reportCardAcademicVersion(f.annual))
    await expect(assertAnnualReportCardSources(f.annual, annualPeriod, [f.contributors[0]!])).rejects.toThrow()
    const modified = new ReportCardResult({ ...f.first.data, sectionResults: [leaf('old-section', 'old-cs', 10)] })
    await expect(assertAnnualReportCardSources(f.annual, annualPeriod, [f.contributors[0]!, { period: f.contributors[1]!.period, result: modified }])).rejects.toThrow()
    await expect(assertAnnualReportCardSources(f.annual, new AcademicPeriod({ ...annualPeriod.data, isPublished: false }), f.contributors)).rejects.toThrow()
  })
})
