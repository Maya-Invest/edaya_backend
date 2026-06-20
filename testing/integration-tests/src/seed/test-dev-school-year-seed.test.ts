import {
  countSeedAssessments,
  SEED_ACADEMIC_PERIODS,
  SEED_ASSESSMENTS,
  SEED_REPORT_CARD_RESULTS,
  seedPeriodIdForDate,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { describeWithSeededSchoolData } from '../support/seeded-route-test-context'

describeWithSeededSchoolData('dev school year seed', (getContext) => {
  it('covers all three trimesters with assessments and report cards', async () => {
    const { seedResult } = getContext()
    expect(seedResult.assessments).toBe(countSeedAssessments())

    const assessmentsByPeriod = Object.fromEntries(
      SEED_ACADEMIC_PERIODS.map(period => [period.id, 0]),
    ) as Record<string, number>

    for (const assessment of SEED_ASSESSMENTS) {
      const periodId = seedPeriodIdForDate(assessment.date)
      assessmentsByPeriod[periodId] = (assessmentsByPeriod[periodId] ?? 0) + 1
    }

    for (const period of SEED_ACADEMIC_PERIODS) {
      expect(assessmentsByPeriod[period.id]).toBeGreaterThan(5)
    }

    const reportCardsByPeriod = Object.fromEntries(
      SEED_ACADEMIC_PERIODS.map(period => [period.id, 0]),
    ) as Record<string, number>

    for (const result of SEED_REPORT_CARD_RESULTS) {
      reportCardsByPeriod[result.periodId] = (reportCardsByPeriod[result.periodId] ?? 0) + 1
    }

    expect(reportCardsByPeriod['2025-t1']).toBeGreaterThanOrEqual(6)
    expect(reportCardsByPeriod['2025-t2']).toBeGreaterThanOrEqual(6)
    expect(reportCardsByPeriod['2025-t3']).toBeGreaterThanOrEqual(4)
  })
})
