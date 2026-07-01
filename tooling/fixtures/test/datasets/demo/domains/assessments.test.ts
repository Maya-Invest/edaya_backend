import type { AssessmentInput } from '@edaya/core'
import { AssessmentKind } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoAssessmentResultScores,
  demoInClassAssessments,
} from '../../../../src/datasets/demo/domains/assessments'
import { demoHomeworkAssessments } from '../../../../src/datasets/demo/domains/assessments-homework'

describe('demo assessments', () => {
  it('typed in-class assessments satisfy AssessmentInput', () => {
    const assessment = demoInClassAssessments[0] satisfies AssessmentInput
    expect(assessment.kind).toBe(AssessmentKind.Other)
    expect(assessment.periodId).toBe('2025-t1')
    expect(assessment.startsAt).toBe('2025-11-15T09:00:00.000Z')
    expect(assessment.endsAt).toBe('2025-11-15T10:00:00.000Z')
  })

  it('includes core, extended, and homework assessments with result scores', () => {
    expect(demoInClassAssessments.length).toBeGreaterThan(0)
    expect(demoInClassAssessments.length + demoHomeworkAssessments.length).toBeGreaterThan(0)
    expect(Object.keys(demoAssessmentResultScores).length).toBeGreaterThan(0)
  })
})
