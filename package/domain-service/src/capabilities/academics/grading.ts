import type { Assessment, AssessmentResult, GradingPolicy } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { BusinessRuleViolationError, calculateGrade, AssessmentResult as Result } from '@edaya/core'

export const GRADING_RECALCULATE_KIND = 'grading.recalculate'

export async function assessmentGradingPolicy(repositories: Pick<SchoolRepositories, 'classGroups' | 'gradeLevels'>, assessment: Assessment): Promise<GradingPolicy | undefined> {
  const group = await repositories.classGroups.findById(assessment.classGroupId)
  return group ? (await repositories.gradeLevels.findById(group.gradeLevelId))?.gradingPolicyFor(group.academicYearId) : undefined
}

export function captureGradeEntry(result: AssessmentResult, assessment: Assessment, policy?: GradingPolicy, existing?: AssessmentResult): AssessmentResult {
  const excluded = result.designation === 'absent' || result.designation === 'exempt'
  if (excluded) {
    if (result.score !== undefined || result.mentionId !== undefined)
      throw new BusinessRuleViolationError('MARK_SCORE_NOT_ALLOWED', 'Absent and exempt entries cannot contain a grade')
    return new Result({ ...result.data, originalEntry: undefined, calculation: undefined })
  }
  if (existing && result.score === existing.score && result.mentionId === existing.mentionId && result.designation === existing.designation) {
    return new Result({ ...result.data, originalEntry: existing.originalEntry, calculation: existing.calculation })
  }
  if (result.score === undefined && result.mentionId === undefined && result.designation !== 'scored')
    return new Result({ ...result.data, originalEntry: undefined, calculation: undefined })
  let entry: AssessmentResult['originalEntry']
  if (policy?.mode === 'mention-first') {
    if (result.score !== undefined)
      throw new BusinessRuleViolationError('GRADING_MENTION_REQUIRED', 'Select a mention for this grade level')
    const range = policy.scale.ranges.find(range => range.id === result.mentionId)
    if (!range?.id || range.gpaValue === undefined)
      throw new BusinessRuleViolationError('GRADING_MENTION_REQUIRED', 'Select a configured mention')
    entry = { kind: 'mention', intervalId: range.id, code: range.letter, label: range.interpretation ?? range.letter, policyRevision: policy.revision, points: range.gpaValue }
  }
  else {
    if (result.mentionId !== undefined)
      throw new BusinessRuleViolationError('GRADING_NUMERIC_REQUIRED', 'Enter a numeric mark for this grade level')
    if (result.score !== undefined)
      entry = { kind: 'numeric', value: result.score, maximum: assessment.maxScore }
  }
  return new Result({ ...result.data, originalEntry: entry, calculation: entry && policy ? calculateGrade(entry, policy) : undefined })
}

/** Called under the academic-state lock; never changes original entries or revisions. */
export function recalculateGrade(result: AssessmentResult, assessment: Assessment, policy: GradingPolicy): AssessmentResult {
  const entry = result.originalEntry ?? (result.score === undefined ? undefined : { kind: 'numeric' as const, value: result.score, maximum: assessment.maxScore })
  return new Result({ ...result.data, originalEntry: entry, calculation: entry && result.designation !== 'absent' && result.designation !== 'exempt' ? calculateGrade(entry, policy) : undefined })
}
