import type { SchoolRepositories } from '../../../src/ports/school-repositories'
import { AcademicPeriod, AcademicYear, CORE_ENTITY_KEYS } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { assertAcademicPeriodUnused, validateAcademicYearDelete } from '../../../src/services/entities/config/school/academic-calendar-dependencies'

function repositories(overrides: Record<string, unknown> = {}): SchoolRepositories {
  return Object.fromEntries([
    ...[...CORE_ENTITY_KEYS, 'documentNumberSeries', 'familyFeedbackCampaigns'].map(key => [key, { count: async () => 0, list: async () => [] }]),
    ...Object.entries(overrides),
  ]) as unknown as SchoolRepositories
}

const year = new AcademicYear({ id: 'year', schoolId: 'school', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') })
const period = new AcademicPeriod({ id: 'period', schoolId: 'school', academicYearId: year.id, name: 'Term', startDate: year.startDate, endDate: year.endDate })

describe('calendar deletion reference protection', () => {
  test.each(['studentCharges', 'payments', 'documentIssuances', 'documentNumberSeries', 'staffManualPermissionAssignments', 'familyFeedbackCampaigns'])('rejects a year used by %s without cascading', async (resource) => {
    let filter: unknown
    const repos = repositories({ [resource]: { count: async (input: unknown) => {
      filter = input
      return 1
    } } })
    await expect(validateAcademicYearDelete(year, repos)).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_HAS_DEPENDENCIES' })
    expect(filter).toEqual({ academicYearId: year.id })
  })

  test('protects grading settings stored inside grade levels', async () => {
    const repos = repositories({ gradeLevels: { list: async () => [{ gradingPolicies: [], reportSettings: [{ academicYearId: year.id }] }] } })
    await expect(validateAcademicYearDelete(year, repos)).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_HAS_DEPENDENCIES' })
  })

  test.each([
    { academicPeriodId: period.id },
    { academicSources: [{ periodId: period.id }] },
  ])('protects document snapshot period references', async (snapshot) => {
    const repos = repositories({ documentIssuances: { list: async () => [{ snapshot }] } })
    await expect(assertAcademicPeriodUnused(period, repos)).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_HAS_DEPENDENCIES' })
  })

  test('protects report aggregation source periods and feedback campaigns', async () => {
    await expect(assertAcademicPeriodUnused(period, repositories({ results: { list: async () => [{ aggregation: { sourcePeriodIds: [period.id] } }] } }))).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_HAS_DEPENDENCIES' })
    await expect(assertAcademicPeriodUnused(period, repositories({ familyFeedbackCampaigns: { count: async () => 1 } }))).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_HAS_DEPENDENCIES' })
  })

  test('allows unused records and ignores other periods in snapshots', async () => {
    await validateAcademicYearDelete(year, repositories())
    await assertAcademicPeriodUnused(period, repositories({ documentIssuances: { list: async () => [{ snapshot: { academicPeriodId: 'other' } }] } }))
  })
})
