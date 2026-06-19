import {
  countSeedAssessments,
  SEED_ACADEMIC_PERIODS,
  SEED_ASSESSMENTS,
  SEED_REPORT_CARD_RESULTS,
  seedPeriodIdForDate,
} from '@edaya/dev-fixtures'
import { runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import { createCoreRouteTestApp } from '../support/api-route-harness'

describe('dev school year seed', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('covers all three trimesters with assessments and report cards', async () => {
    const { application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')
    if (seedResult.status === 'seeded') {
      expect(seedResult.assessments).toBe(countSeedAssessments())
    }

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
  }, 30_000)
})
