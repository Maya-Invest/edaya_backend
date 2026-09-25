import type { AssessmentInput } from '@edaya/core'
import { AssessmentKind } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoInClassAssessments } from '../../../../src/datasets/demo/domains/assessments'

describe('demo assessments', () => {
  it('typed in-class assessments satisfy AssessmentInput', () => {
    const assessment = demoInClassAssessments[0] satisfies AssessmentInput
    expect(assessment.kind).toBe(AssessmentKind.Other)
    expect(assessment.periodId).toBe('2025-t1')
    expect(assessment.startsAt).toBe('2025-11-15T09:00:00.000Z')
    expect(assessment.endsAt).toBe('2025-11-15T10:00:00.000Z')
  })
})
