import { describe, expect, it } from 'bun:test'
import { resolveDatasetCalendar } from '../../../src/capabilities/onboarding/ensure-academic-periods-from-dataset'
import { createOnboardingTestDataset } from '../../support/onboarding-dataset'

describe('dataset calendar profiles', () => {
  it('shares equivalent profiles and rejects incompatible fallback calendars', () => {
    const profile = createOnboardingTestDataset().calendarProfiles[0]!
    expect(resolveDatasetCalendar([profile, { ...profile, code: 'ALIAS' }])).toEqual(profile)
    expect(() => resolveDatasetCalendar([profile, { ...profile, periodType: 'semester' }])).toThrow('incompatible')
    expect(profile.periods.map(row => row.code)).toEqual(['T1', 'T2', 'T3'])
  })
})
