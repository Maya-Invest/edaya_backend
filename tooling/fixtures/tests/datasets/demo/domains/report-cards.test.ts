import type { GradeScaleInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoGradeScales } from '../../../../src/datasets/demo/domains/report-cards'

describe('demo report-cards', () => {
  it('typed grade scales satisfy GradeScaleInput', () => {
    const scale = demoGradeScales[0] satisfies GradeScaleInput
    expect(scale.maxScore).toBe(20)
  })
})
