import { AcademicPeriod, withShortName } from '@edaya/core'
import { expect, test } from 'bun:test'
import { fixture } from './support/marks-fixture'

test('native dashboard loads a populated year with no periods and restores period metrics when configured', async () => {
  const f = await fixture('dashboard-no-period')
  await f.r.assessments.delete(f.id('assessment'))
  await f.r.academicPeriods.delete(f.id('period'))
  const input = { schoolId: f.id('school'), academicYearId: f.id('year') }
  const overview = await f.editor.getSchoolOverview(input)
  expect(overview.academicPeriodId).toBeNull()
  expect(overview.kpis.studentCount).toBe(1)
  expect(overview.classRiskRows).toHaveLength(1)
  expect(overview.classRiskRows[0]?.gradingCompletionPercent).toBeNull()
  expect(overview.kpis.unpublishedReportCardCount).toBeNull()
  expect(overview.areaHealth.academics).toEqual({ gradingCompletionPercent: null, publishedReportCards: null, totalReportCards: null, incompleteGradingClassCount: null })
  expect(overview.actionItems).toEqual([])
  await f.r.academicPeriods.save(new AcademicPeriod(withShortName({ id: f.id('new-period'), schoolId: f.id('school'), academicYearId: f.id('year'), name: 'Term', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })))
  const configured = await f.editor.getSchoolOverview({ ...input, academicPeriodId: f.id('new-period') })
  expect(configured.academicPeriodId).toBe(f.id('new-period'))
  expect(configured.kpis.unpublishedReportCardCount).toBe(1)
  expect(configured.areaHealth.academics.totalReportCards).toBe(1)
  expect(configured.actionItems).toContainEqual({ key: 'unpublished_report_cards', count: 1 })
})
