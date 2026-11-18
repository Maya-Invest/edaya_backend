import { Assessment, AssessmentKind, AssessmentResult } from '@edaya/core'
import { expect, test } from 'bun:test'
import { evaluationRankings } from '../../src/capabilities/academics/live-rankings'

test('submitted ranks compare captured reporting precision and count eligible scored pupils', () => {
  const ids = ['first', 'tie1', 'tie2', 'zero', 'absent', 'exempt', 'missing']
  const assessment = new Assessment({ id: 'sheet', classGroupId: 'class', classSubjectId: 'math', periodId: 'term', title: 'Test', kind: AssessmentKind.Quiz, lessonSessionId: 'lesson', coefficient: 1, maxScore: 20, marksStatus: 'submitted', marksReview: { rosterStudentIds: ids, submittedBy: 'teacher' } })
  const marks = [19, 15.331, 15.334, 0, 10, 10, undefined, 20].map((score, i) => new AssessmentResult({
    id: ids[i] ?? 'outsider',
    studentId: ids[i] ?? 'outsider',
    assessmentId: assessment.id,
    score,
    designation: i === 4 ? 'absent' : i === 5 ? 'exempt' : undefined,
  }))
  expect(Object.fromEntries(evaluationRankings([assessment], marks))).toEqual({
    first: { rank: 1, participantCount: 4 },
    tie1: { rank: 2, participantCount: 4 },
    tie2: { rank: 2, participantCount: 4 },
    zero: { rank: 4, participantCount: 4 },
  })
  expect(evaluationRankings([new Assessment({ ...assessment.data, marksStatus: 'draft', marksReview: {} })], marks).size).toBe(0)
})

test('mention points tie at captured school precision and scale revisions form separate cohorts', () => {
  const scores = [3.25, 3.21, 1, 0]
  const ids = scores.map((_, i) => String(i))
  const assessment = new Assessment({ id: 'mention', classGroupId: 'class', classSubjectId: 'music', periodId: 'term', title: 'Performance', kind: AssessmentKind.Quiz, lessonSessionId: 'lesson', coefficient: 1, maxScore: 4, marksStatus: 'submitted', marksReview: { rosterStudentIds: ids, submittedBy: 'teacher' } })
  const results = scores.map((value, i) => new AssessmentResult({
    id: ids[i],
    studentId: ids[i],
    assessmentId: assessment.id,
    calculation: { mode: 'mention-first', value, reportedValue: Math.trunc(10 * value) / 10, policyRevision: 2, scaleId: 'mentions', scaleRevision: i === 2 ? 1 : 2, maximum: 4, units: 'points', decimalPlaces: 1, roundingMode: 'truncate', mention: { id: 'A', code: 'A', label: 'Mastery' }, provenance: 'mention-points' },
  }))
  expect([...evaluationRankings([assessment], results).values()]).toEqual([
    { rank: 1, participantCount: 3 },
    { rank: 1, participantCount: 3 },
    { rank: 3, participantCount: 3 },
    { rank: 1, participantCount: 1 },
  ])
})
