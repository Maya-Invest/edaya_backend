import type { AssessmentInput, AssessmentResultInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoHomeworkAssessments,
  demoHomeworkSubmissions,
} from '../../../../src/datasets/demo/domains/assessments-homework'

describe('demo homework assessments', () => {
  it('typed homework assessments satisfy AssessmentInput', () => {
    const assessment = demoHomeworkAssessments[0] satisfies AssessmentInput
    expect(assessment.title).toBe('Fractions worksheet')
  })

  it('typed homework submissions satisfy AssessmentResultInput', () => {
    const submission = demoHomeworkSubmissions[0] satisfies AssessmentResultInput
    expect(submission.assessmentId).toBe('d-t1-1')
  })
})
