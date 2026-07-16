import {
  ActorAssuranceLevel,
  AuthorizationError,
  authorizeTeacherReportCardCommentSave,
  createTeacherActorMetadata,
  teacherCanReadReportCard,
} from '@edaya/authorization'
import { assertCommentOnlyReportCardUpdate, assertDraftReportCardForTeacherComment, AttendanceSummary, BusinessRuleViolationError, ReportCardDefinitionSectionKind, ReportCardResult, ReportCardResultSection, ReportCardResultStatus } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

function teacherActor(scope: {
  classSubjectIds?: readonly string[]
  classGroupIds?: readonly string[]
} = {}) {
  return createTeacherActorMetadata({
    subjectId: 'user-teacher',
    teacherId: 'teacher-1',
    schoolId: 'school-1',
    teacherScope: {
      teaching: { classSubjectIds: scope.classSubjectIds ?? ['cs-math'] },
      homeroom: { classGroupIds: scope.classGroupIds ?? [] },
    },
    requestId: 'test',
    authenticatedAt: new Date('2026-09-01T00:00:00Z'),
    assuranceLevel: ActorAssuranceLevel.Standard,
  })
}

function homeroomActor(classGroupIds: readonly string[] = ['cg-7a']) {
  return teacherActor({ classGroupIds, classSubjectIds: [] })
}

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

  test('authorizeTeacherReportCardCommentSave enforces subject, group, and card capabilities', () => {
    const before = draftReportCard()

    expect(() => authorizeTeacherReportCardCommentSave(
      teacherActor({ classSubjectIds: ['cs-math'], classGroupIds: [] }),
      before,
      draftReportCard({
        teacherComment: 'Homeroom summary',
        sectionResults: defaultSectionResults({
          groupComment: 'Group overview',
          mathComment: 'Subject note',
        }),
      }),
    )).toThrow(AuthorizationError)

    expect(() => authorizeTeacherReportCardCommentSave(
      homeroomActor(['cg-7a']),
      before,
      draftReportCard({
        teacherComment: 'Homeroom summary',
        sectionResults: defaultSectionResults({ groupComment: 'Group overview' }),
      }),
    )).not.toThrow()

    const subjectOnlyAfter = draftReportCard({
      sectionResults: defaultSectionResults({
        groupComment: 'Solid term',
        mathComment: 'Updated math comment',
      }),
    })

    expect(() => authorizeTeacherReportCardCommentSave(
      teacherActor({ classSubjectIds: ['cs-math'], classGroupIds: [] }),
      before,
      subjectOnlyAfter,
    )).not.toThrow()

    expect(() => authorizeTeacherReportCardCommentSave(
      teacherActor({ classSubjectIds: ['cs-french'], classGroupIds: [] }),
      before,
      subjectOnlyAfter,
    )).toThrow(AuthorizationError)
  })

  test('teacherCanReadReportCard scopes read to homeroom class or assigned subject sections', () => {
    const result = draftReportCard()

    expect(teacherCanReadReportCard(homeroomActor(['cg-7a']), result)).toBe(true)
    expect(teacherCanReadReportCard(teacherActor({ classSubjectIds: ['cs-math'], classGroupIds: [] }), result)).toBe(true)
    expect(teacherCanReadReportCard(teacherActor({ classSubjectIds: ['cs-french'], classGroupIds: [] }), result)).toBe(true)
    expect(teacherCanReadReportCard(teacherActor({ classSubjectIds: ['cs-history'], classGroupIds: [] }), result)).toBe(false)
    expect(teacherCanReadReportCard(homeroomActor(['cg-8b']), result)).toBe(false)
  })
})
