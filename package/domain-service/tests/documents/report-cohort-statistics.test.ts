import { ReportCardResult, ReportCardResultStatus } from '@edaya/core'
import { expect, test } from 'bun:test'
import { gradingPeerAverages } from '../../src/capabilities/documents/document-format'

function report(id: string, revision = 1, average = 12) {
  return new ReportCardResult({ id, studentId: id, classGroupId: 'class', gradeLevelId: 'level', academicYearId: 'year', periodId: 'term', reportConfigurationRevision: revision, gradingPolicyRevision: 1, assessmentResultCount: 1, overallAverage: average, status: ReportCardResultStatus.Published, publishedAt: new Date(), sectionResults: [], attendanceSummary: { presentCount: 0, absenceCount: 0, excusedAbsenceCount: 0, lateCount: 0 } })
}

test('published cohort statistics never use revised drafts or another module configuration', () => {
  const target = report('target')
  const published = report('peer', 2, 18)
  const revisedDraft = { ...report('peer', 1, 20).data, status: ReportCardResultStatus.Draft, publishedAt: undefined, sectionResults: [] }
  const peer = new ReportCardResult({ ...published.data, sectionResults: [], revisedDraft })
  expect(gradingPeerAverages(target, [peer])).toEqual([])
  expect(gradingPeerAverages(target, [target, report('peer', 1, 18)])).toEqual([18, 12])
})
