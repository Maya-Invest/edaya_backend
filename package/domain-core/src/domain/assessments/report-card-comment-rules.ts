import type { ReportCardResult } from './report-card-result'
import type { ReportCardResultSection } from './report-card-result-section'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { ReportCardResultStatus } from './report-card-result'
import { ReportCardResultSectionKind } from './report-card-result-section'

type ReportCardCommentChange
  = | {
    kind: 'card'
    previous?: string
    next?: string
  }
  | {
    kind: 'group'
    sectionId: string
    previous?: string
    next?: string
  }
  | {
    kind: 'subject'
    sectionId: string
    classSubjectId: string
    previous?: string
    next?: string
  }

function sectionStructureKey(section: ReportCardResultSection): string {
  return [
    section.subjectId,
    section.moduleId,
    section.coefficient,
    section.weightingMode,
    section.explicitWeight,
    section.contributingCoefficientSum,
    section.order,
    JSON.stringify(section.grading),
    section.sectionId,
    section.sectionKind,
    section.name,
    section.average,
    section.weight,
    section.parentSectionId ?? '',
    section.classSubjectId ?? '',
  ].join('|')
}

function flattenSections(
  sections: readonly ReportCardResultSection[],
): Map<string, ReportCardResultSection> {
  const byId = new Map<string, ReportCardResultSection>()
  const visit = (section: ReportCardResultSection) => {
    byId.set(section.sectionId, section)
    for (const child of section.subResults) {
      visit(child)
    }
  }
  for (const section of sections) {
    visit(section)
  }
  return byId
}

function collectCommentChanges(
  before: ReportCardResult,
  after: ReportCardResult,
): ReportCardCommentChange[] {
  const changes: ReportCardCommentChange[] = []

  if (before.teacherComment !== after.teacherComment) {
    changes.push({
      kind: 'card',
      previous: before.teacherComment,
      next: after.teacherComment,
    })
  }

  const beforeSections = flattenSections(before.sectionResults)
  const afterSections = flattenSections(after.sectionResults)

  for (const [sectionId, afterSection] of afterSections) {
    const beforeSection = beforeSections.get(sectionId)
    if (!beforeSection || beforeSection.comment === afterSection.comment) {
      continue
    }

    if (afterSection.sectionKind === ReportCardResultSectionKind.Subject) {
      if (!afterSection.classSubjectId) {
        throw new BusinessRuleViolationError(
          'REPORT_CARD_COMMENT_INVALID_SECTION',
          `Subject section ${sectionId} is missing classSubjectId`,
        )
      }
      changes.push({
        kind: 'subject',
        sectionId,
        classSubjectId: afterSection.classSubjectId,
        previous: beforeSection.comment,
        next: afterSection.comment,
      })
      continue
    }

    changes.push({
      kind: 'group',
      sectionId,
      previous: beforeSection.comment,
      next: afterSection.comment,
    })
  }

  return changes
}

function assertSectionStructureUnchanged(
  beforeSections: readonly ReportCardResultSection[],
  afterSections: readonly ReportCardResultSection[],
): void {
  const beforeById = flattenSections(beforeSections)
  const afterById = flattenSections(afterSections)

  if (beforeById.size !== afterById.size) {
    throw new BusinessRuleViolationError(
      'REPORT_CARD_COMMENT_ONLY_UPDATE',
      'Teachers may only update report card comments on draft report cards',
    )
  }

  for (const [sectionId, beforeSection] of beforeById) {
    const afterSection = afterById.get(sectionId)
    if (!afterSection || sectionStructureKey(beforeSection) !== sectionStructureKey(afterSection)) {
      throw new BusinessRuleViolationError(
        'REPORT_CARD_COMMENT_ONLY_UPDATE',
        'Teachers may only update report card comments on draft report cards',
      )
    }
  }
}

export function assertDraftReportCardForTeacherComment(result: ReportCardResult): void {
  if (result.status === ReportCardResultStatus.Published) {
    throw new BusinessRuleViolationError(
      'PUBLISHED_REPORT_CARD_IMMUTABLE',
      `Published report card ${result.id} is immutable`,
    )
  }
}

export function assertCommentOnlyReportCardUpdate(
  before: ReportCardResult,
  after: ReportCardResult,
): void {
  if (before.id !== after.id) {
    throw commentOnlyViolation()
  }
  if (
    before.gradeLevelId !== after.gradeLevelId
    || before.academicYearId !== after.academicYearId
    || before.reportConfigurationRevision !== after.reportConfigurationRevision
    || before.studentId !== after.studentId
    || before.classGroupId !== after.classGroupId
    || before.periodId !== after.periodId
    || before.assessmentResultCount !== after.assessmentResultCount
    || before.overallAverage !== after.overallAverage
    || before.rank !== after.rank
    || before.classSize !== after.classSize
    || before.passThreshold !== after.passThreshold
    || before.principalComment !== after.principalComment
    || before.status !== after.status
    || before.generatedAt.getTime() !== after.generatedAt.getTime()
    || before.publishedAt?.getTime() !== after.publishedAt?.getTime()
    || JSON.stringify(before.attendanceSummary) !== JSON.stringify(after.attendanceSummary)
    || JSON.stringify(before.aggregation) !== JSON.stringify(after.aggregation)
  ) {
    throw commentOnlyViolation()
  }

  assertSectionStructureUnchanged(before.sectionResults, after.sectionResults)
}

function commentOnlyViolation(): BusinessRuleViolationError {
  return new BusinessRuleViolationError(
    'REPORT_CARD_COMMENT_ONLY_UPDATE',
    'Teachers may only update report card comments on draft report cards',
  )
}

export { collectCommentChanges }
