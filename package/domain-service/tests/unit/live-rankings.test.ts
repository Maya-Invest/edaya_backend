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
