import type { FamilyFeedbackScoredRow } from '@edaya/core'
import { aggregateFamilyFeedback, familyFeedbackReminderTimes } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

function rowsForSubjects(count: number, value: FamilyFeedbackScoredRow['value'] = 4): FamilyFeedbackScoredRow[] {
  const questionIds = ['communication', 'clarity', 'support', 'student_experience'] as const
  return Array.from({ length: count }, (_, index) => questionIds.flatMap(questionId => [{
    questionId,
    value,
    guardianSubjectId: `subject-${index}`,
  }])).flat()
}

describe('family feedback aggregation', () => {
  test('suppresses a question below ten distinct guardian subjects', () => {
    const payload = aggregateFamilyFeedback(rowsForSubjects(9), 20, 9)
    expect(payload.overallSuppressed).toBe(true)
    expect(payload.questions.every(question => question.suppressed)).toBe(true)
    expect(payload.questions[0]!.distribution[4]).toBe(0)
    expect(payload.responseRate).toBe(9 / 20)
  })

  test('releases scored questions at ten distinct subjects', () => {
    const payload = aggregateFamilyFeedback(rowsForSubjects(10), 20, 10)
    expect(payload.overallSuppressed).toBe(false)
    expect(payload.questions[0]!.suppressed).toBe(false)
    expect(payload.questions[0]!.nScored).toBe(10)
    expect(payload.questions[0]!.distribution[4]).toBe(10)
  })

  test('counts siblings as one guardian subject', () => {
    const rows: FamilyFeedbackScoredRow[] = Array.from({ length: 10 }, (_, index) => (
      ['communication', 'clarity', 'support', 'student_experience'] as const
    ).map(questionId => ({
      questionId,
      value: 5 as const,
      guardianSubjectId: index === 9 ? 'subject-0' : `subject-${index}`,
    }))).flat()
    const payload = aggregateFamilyFeedback(rows, 10, 10)
    expect(payload.questions[0]!.suppressed).toBe(true)
    expect(payload.overallSuppressed).toBe(true)
  })

  test('excludes cannot_assess from the score denominator and can suppress one question', () => {
    const scored = rowsForSubjects(10, 3)
    const withNa = scored.map(row => row.questionId === 'student_experience' && row.guardianSubjectId === 'subject-0'
      ? { ...row, value: 'cannot_assess' as const }
      : row)
    const payload = aggregateFamilyFeedback(withNa, 10, 10)
    const experience = payload.questions.find(question => question.questionId === 'student_experience')!
    const communication = payload.questions.find(question => question.questionId === 'communication')!
    expect(communication.suppressed).toBe(false)
    expect(experience.suppressed).toBe(true)
    expect(payload.overallSuppressed).toBe(true)
    expect(experience.distribution[3]).toBe(0)
  })

  test('skips reminder times when the window is too short for a distinct 48h send', () => {
    const openedAt = new Date('2026-03-01T00:00:00.000Z')
    const closesAt = new Date('2026-03-01T02:00:00.000Z')
    expect(familyFeedbackReminderTimes(openedAt, closesAt)).toEqual([
      { kind: 'mid', at: new Date('2026-03-01T01:00:00.000Z') },
    ])
  })
})
