import type { FamilyFeedbackAnswer, FamilyFeedbackQuestionId, FamilyFeedbackScoredValue } from './catalog'
import type { FamilyFeedbackAggregatePayload, FamilyFeedbackQuestionAggregate } from './snapshot'
import {
  FAMILY_FEEDBACK_QUESTION_IDS,
  FAMILY_FEEDBACK_SCORED_SUBJECT_THRESHOLD,

} from './catalog'

export interface FamilyFeedbackScoredRow {
  questionId: FamilyFeedbackQuestionId
  value: FamilyFeedbackAnswer
  guardianSubjectId: string
}

const EMPTY_DISTRIBUTION = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as const

export function aggregateFamilyFeedback(
  rows: readonly FamilyFeedbackScoredRow[],
  eligibleSlotCount: number,
  completedSlotCount: number,
  themes?: string,
): FamilyFeedbackAggregatePayload {
  const questions = FAMILY_FEEDBACK_QUESTION_IDS.map(questionId => aggregateQuestion(rows, questionId))
  const overallSuppressed = questions.some(question => question.suppressed)
  return {
    eligibleSlotCount,
    completedSlotCount,
    responseRate: eligibleSlotCount === 0 ? 0 : completedSlotCount / eligibleSlotCount,
    overallSuppressed,
    questions,
    themes,
  }
}

function aggregateQuestion(
  rows: readonly FamilyFeedbackScoredRow[],
  questionId: FamilyFeedbackQuestionId,
): FamilyFeedbackQuestionAggregate {
  const forQuestion = rows.filter(row => row.questionId === questionId)
  const scored = forQuestion.filter(row => row.value !== 'cannot_assess') as Array<FamilyFeedbackScoredRow & { value: FamilyFeedbackScoredValue }>
  const subjects = new Set(scored.map(row => row.guardianSubjectId))
  const suppressed = subjects.size < FAMILY_FEEDBACK_SCORED_SUBJECT_THRESHOLD
  const distribution = { ...EMPTY_DISTRIBUTION }
  if (!suppressed) {
    for (const row of scored)
      distribution[row.value] += 1
  }
  return {
    questionId,
    suppressed,
    nScored: suppressed ? 0 : scored.length,
    nCannotAssess: suppressed ? 0 : forQuestion.length - scored.length,
    distribution,
  }
}

export function familyFeedbackReminderTimes(openedAt: Date, closesAt: Date): ReadonlyArray<{ kind: 'mid' | 'final', at: Date }> {
  const opened = openedAt.getTime()
  const closes = closesAt.getTime()
  if (!(closes > opened))
    return []
  const mid = new Date(opened + (closes - opened) / 2)
  const final = new Date(closes - 48 * 60 * 60 * 1000)
  const times: Array<{ kind: 'mid' | 'final', at: Date }> = []
  if (mid.getTime() > opened && mid.getTime() < closes)
    times.push({ kind: 'mid', at: mid })
  if (final.getTime() > opened && final.getTime() < closes) {
    const midTime = times[0]?.at.getTime()
    if (midTime === undefined || Math.abs(final.getTime() - midTime) > 60_000)
      times.push({ kind: 'final', at: final })
  }
  return times
}
