import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { Assessment, AssessmentResult, StudentClassEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { Assessment as AssessmentEntity, BusinessRuleViolationError } from '@edaya/core'

export function academicStateLock(schoolId: string): string {
  return `academic-state:${schoolId}`
}

export function assertMarksDraft(assessment: Assessment): void {
  if (assessment.marksStatus !== 'draft')
    throw new BusinessRuleViolationError('ASSESSMENT_MARKS_FROZEN', 'Submitted marks can only change through an approved correction')
}

export function assertMarksRevision(assessment: Assessment, expectedRevision: number): void {
  if (assessment.marksRevision !== expectedRevision)
    throw new BusinessRuleViolationError('MARKS_REVISION_CONFLICT', 'The marks sheet changed. Reload it before retrying this edit')
}

export function enrollmentEffectiveAt(enrollment: StudentClassEnrollment, at: Date): boolean {
  return enrollment.enrolledAt.getTime() <= at.getTime()
    && (!enrollment.endedAt || enrollment.endedAt.getTime() > at.getTime())
}

export async function assessmentDate(assessment: Assessment, repositories: { lessonSessions: Pick<SchoolRepositories['lessonSessions'], 'findById'> }): Promise<Date> {
  const at = assessment.dueAt ?? assessment.startsAt
    ?? (assessment.lessonSessionId ? (await repositories.lessonSessions.findById(assessment.lessonSessionId))?.startsAt : undefined)
  if (!at)
    throw new BusinessRuleViolationError('ASSESSMENT_DATE_REQUIRED', 'An evaluation date is required to resolve its roster')
  return at
}

export async function assessmentRoster(assessment: Assessment, repositories: Pick<SchoolRepositories, 'lessonSessions' | 'enrollments'>): Promise<string[]> {
  const at = await assessmentDate(assessment, repositories)
  const enrollments = await repositories.enrollments.list({ classGroupId: assessment.classGroupId })
  return [...new Set(enrollments.filter(row => enrollmentEffectiveAt(row, at)).map(row => row.studentId))].sort()
}

export function assertMarkDesignation(result: AssessmentResult): void {
  if (result.designation === 'scored' && result.score === undefined)
    throw new BusinessRuleViolationError('MARK_SCORE_REQUIRED', 'A scored mark requires a numeric score')
  if ((result.designation === 'absent' || result.designation === 'exempt') && result.score !== undefined)
    throw new BusinessRuleViolationError('MARK_SCORE_NOT_ALLOWED', 'Absent and exempt marks must not carry a score')
}

export async function invalidateAssessmentDrafts(assessment: Assessment, repositories: Pick<SchoolRepositories, 'assessmentDependencies' | 'classGroups'>): Promise<void> {
  const group = await repositories.classGroups.findById(assessment.classGroupId)
  if (!group)
    return
  await repositories.assessmentDependencies.invalidateDrafts({ schoolId: group.schoolId, assessmentId: assessment.id, periodId: assessment.periodId, classGroupId: assessment.classGroupId })
}

export async function markSheetEdited(assessmentId: string, repositories: SchoolRepositories, actor: SchoolScopedActorMetadata, revisions = 1, changedMarks: readonly { id: string, removed?: boolean }[] = []): Promise<void> {
  const assessment = await repositories.assessments.findById(assessmentId)
  if (!assessment)
    throw new BusinessRuleViolationError('ASSESSMENT_NOT_FOUND', 'Evaluation not found')
  assertMarksDraft(assessment)
  if (actor.kind !== 'staff' && actor.kind !== 'teacher')
    throw new BusinessRuleViolationError('MARKS_EDITOR_REQUIRED', 'Marks require an accountable teacher or staff editor')
  const markEditorSubjectIds = { ...assessment.marksReview.markEditorSubjectIds }
  for (const mark of changedMarks) {
    if (mark.removed)
      delete markEditorSubjectIds[mark.id]
    else
      markEditorSubjectIds[mark.id] = actor.subjectId
  }
  await repositories.assessments.save(new AssessmentEntity({
    ...assessment.data,
    marksRevision: assessment.marksRevision + revisions,
    marksReview: { ...assessment.marksReview, markEditorSubjectIds, editedBySubjectIds: [...new Set(Object.values(markEditorSubjectIds))] },
  }))
  await invalidateAssessmentDrafts(assessment, repositories)
}
