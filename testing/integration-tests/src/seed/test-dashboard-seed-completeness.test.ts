import { buildSchoolOverview } from '@edaya/core'
import {
  parseSeedDate,
  resolveSeedReferenceDate,
  SEED_ACADEMIC_YEAR_ID,
  SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import { runDevSchoolSeed } from '@edaya/seeding'
import { afterEach, describe, expect, it } from 'bun:test'
import { resetApiRuntimesForTests } from '@/runtime'
import { createCoreRouteTestApp } from '../support/api-route-harness'

describe('dev dashboard seed completeness', () => {
  afterEach(async () => {
    await resetApiRuntimesForTests()
  })

  it('populates executive dashboard KPIs at the narrative reference date', async () => {
    const { application } = await createCoreRouteTestApp()
    const seedResult = await runDevSchoolSeed(application)
    expect(seedResult.status).toBe('seeded')

    const referenceDate = parseSeedDate(resolveSeedReferenceDate())
    const overview = await buildSchoolOverview(application.repositories, {
      schoolId: SEED_SCHOOL_ID,
      academicYearId: SEED_ACADEMIC_YEAR_ID,
      academicPeriodId: SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
      referenceDate,
    })

    expect(overview.kpis.studentCount).toBeGreaterThan(0)
    expect(overview.kpis.staffCount).toBeGreaterThan(0)
    expect(overview.kpis.attendanceRateToday).not.toBeNull()
    expect(overview.kpis.overdueFeeCount).toBeGreaterThan(0)
    expect(overview.kpis.openIncidentCount).toBeGreaterThan(0)
    expect(overview.kpis.pendingJustificationCount).toBeGreaterThan(0)
    expect(overview.kpis.incompleteGradingClassCount).toBeGreaterThan(0)
    expect(overview.upcoming.length).toBeGreaterThanOrEqual(3)

    const actionKeys = overview.actionItems.map(item => item.key)
    expect(actionKeys).toContain('overdue_fees')
    expect(actionKeys).toContain('pending_justifications')
    expect(actionKeys).toContain('high_severity_incidents')
    expect(actionKeys).toContain('incomplete_grading')

    expect(overview.upcoming.some(item => item.kind === 'calendar')).toBe(true)
    expect(overview.upcoming.some(item => item.kind === 'fee_due')).toBe(true)
  }, 30_000)
})
