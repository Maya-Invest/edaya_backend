import { describe, expect, test } from 'bun:test'
import { getLatestReportCard, ReportCardResult, ReportCardResultStatus } from '../../../../src/domain/assessments/report-card-result'
import { AttendanceSummary } from '../../../../src/domain/value-objects/attendance-summary'

describe('ReportCardResult entity', () => {
  const baseArgs = {
    id: 'rc1',
    reportCardDefinitionId: 'def1',
    studentId: 'stu1',
    classGroupId: 'cg1',
    periodId: 'per1',
    sectionResults: [],
    attendanceSummary: new AttendanceSummary({ presentCount: 10, absenceCount: 0, lateCount: 0 }),
    assessmentResultCount: 5,
    overallAverage: 15.555,
    generatedAt: new Date(),
  }

  test('instantiates successfully with valid inputs', () => {
    const result = new ReportCardResult(baseArgs)

    expect(result.id).toBe('rc1')
    expect(result.studentId).toBe('stu1')
    expect(result.overallAverage).toBe(15.56) // Rounded
    expect(result.status).toBe(ReportCardResultStatus.Draft)
  })

  test('copyWith changes values successfully', () => {
    const result = new ReportCardResult(baseArgs)

    const publishedDate = new Date()
    const updated = result.copyWith({
      status: ReportCardResultStatus.Published,
      publishedAt: publishedDate,
    })

    expect(updated.status).toBe(ReportCardResultStatus.Published)
    expect(updated.publishedAt).toBe(publishedDate)
    expect(updated.id).toBe('rc1')
  })
})

describe('getLatestReportCard', () => {
  const baseArgs = {
    id: 'rc1',
    reportCardDefinitionId: 'def1',
    studentId: 'stu1',
    classGroupId: 'cg1',
    periodId: 'per1',
    sectionResults: [],
    attendanceSummary: new AttendanceSummary({ presentCount: 10, absenceCount: 0, lateCount: 0 }),
    assessmentResultCount: 5,
    overallAverage: 10,
    generatedAt: new Date('2023-01-01'),
  }

  test('returns undefined for empty array', () => {
    expect(getLatestReportCard([])).toBeUndefined()
  })

  test('returns the most recently published report card', () => {
    const rc1 = new ReportCardResult({
      ...baseArgs,
      id: 'rc1',
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2023-01-05'),
    })
    const rc2 = new ReportCardResult({
      ...baseArgs,
      id: 'rc2',
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2023-02-05'),
    })

    const latest = getLatestReportCard([rc1, rc2])
    expect(latest?.id).toBe('rc2')
  })

  test('falls back to generatedAt if publishedAt is undefined', () => {
    const rc1 = new ReportCardResult({
      ...baseArgs,
      id: 'rc1',
      generatedAt: new Date('2023-03-01'),
    })
    const rc2 = new ReportCardResult({
      ...baseArgs,
      id: 'rc2',
      generatedAt: new Date('2023-02-01'),
    })

    const latest = getLatestReportCard([rc1, rc2])
    expect(latest?.id).toBe('rc1')
  })
})
