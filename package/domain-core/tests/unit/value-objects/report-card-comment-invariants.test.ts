import { assertCommentOnlyReportCardUpdate, assertDraftReportCardForTeacherComment, AttendanceSummary, BusinessRuleViolationError, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

function draftReportCard(overrides: {
  teacherComment?: string
  overallAverage?: number
  sectionResults?: ReportCardResultSection[]
} = {}): ReportCardResult {
  return new ReportCardResult({
    id: 'rc-1',
    reportCardDefinitionId: 'def-1',
    studentId: 'student-1',
    classGroupId: 'cg-7a',
    periodId: 'period-1',
    sectionResults: overrides.sectionResults ?? defaultSectionResults(),
    attendanceSummary: new AttendanceSummary({ presentCount: 40, absenceCount: 0, lateCount: 1 }),
    assessmentResultCount: 4,
    overallAverage: overrides.overallAverage ?? 14,
    teacherComment: overrides.teacherComment,
    generatedAt: new Date('2026-09-01T00:00:00Z'),
  })
}

function defaultSectionResults(commentOverrides: {
  groupComment?: string
  mathComment?: string
} = {}): ReportCardResultSection[] {
  return [
    new ReportCardResultSection({
      sectionId: 'group-1',
      sectionKind: ReportCardDefinitionSectionKind.Group,
      name: 'Core subjects',
      average: 14,
      weight: 1,
      comment: commentOverrides.groupComment ?? 'Solid term',
      subResults: [
        new ReportCardResultSection({
          sectionId: 'subject-math',
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: 'Mathematics',
          average: 15,
          weight: 1,
          classSubjectId: 'cs-math',
          parentSectionId: 'group-1',
          comment: commentOverrides.mathComment ?? 'Good progress',
        }),
        new ReportCardResultSection({
          sectionId: 'subject-french',
          sectionKind: ReportCardDefinitionSectionKind.Subject,
          name: 'French',
          average: 13,
          weight: 1,
          classSubjectId: 'cs-french',
          parentSectionId: 'group-1',
        }),
      ],
    }),
  ]
}

describe('report card comment access', () => {
  test('assertDraftReportCardForTeacherComment rejects published cards', () => {
    const published = draftReportCard().copyWith({
      status: ReportCardResultStatus.Published,
      publishedAt: new Date('2026-09-15T00:00:00Z'),
    })

    expect(() => assertDraftReportCardForTeacherComment(published)).toThrow(BusinessRuleViolationError)
  })

  test('assertCommentOnlyReportCardUpdate allows comment-only changes', () => {
    const before = draftReportCard()
    const after = draftReportCard({
      teacherComment: 'Keep up the good work',
      sectionResults: defaultSectionResults({
        groupComment: 'Updated group comment',
        mathComment: 'Excellent effort',
      }),
    })

    expect(() => assertCommentOnlyReportCardUpdate(before, after)).not.toThrow()
  })

  test('assertCommentOnlyReportCardUpdate rejects grade or status changes', () => {
    const before = draftReportCard()
    const after = draftReportCard({ overallAverage: 16 })

    expect(() => assertCommentOnlyReportCardUpdate(before, after)).toThrow(BusinessRuleViolationError)
  })
})
