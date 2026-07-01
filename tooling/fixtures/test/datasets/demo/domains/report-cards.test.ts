import type { GradeScaleInput } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoGradeScales,
  demoReportCardDefinitionFixtures,
  demoReportCardResults,
} from '../../../../src/datasets/demo/domains/report-cards'

describe('demo report-cards', () => {
  it('typed grade scales satisfy GradeScaleInput', () => {
    const scale = demoGradeScales[0] satisfies GradeScaleInput
    expect(scale.maxScore).toBe(20)
  })

  it('includes scales, definitions, and results', () => {
    expect(demoGradeScales.length).toBeGreaterThan(0)
    expect(demoReportCardDefinitionFixtures.length).toBeGreaterThan(0)
    expect(demoReportCardResults.length).toBeGreaterThan(0)
  })
})
