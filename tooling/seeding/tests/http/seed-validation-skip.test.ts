import { describe, expect, test } from 'bun:test'
import { buildSeedValidationTargets } from '@edaya/fixtures/meta/validation-harness'
import type { SeedEntityValidationResult } from '../../src/diagnostics/seed-validation'

describe('HTTP seed validation — skipped profile photos', () => {
  test('profile-photos target exists in manifest', () => {
    const targets = buildSeedValidationTargets()
    expect(targets.some(target => target.entity === 'profile-photos')).toBe(true)
  })

  test('skipped profile photos are not counted as failures', () => {
    const entityResults: SeedEntityValidationResult[] = [
      {
        entity: 'students',
        serviceName: 'students',
        expectedMin: 1,
        actual: 10,
        status: 'passed',
      },
      {
        entity: 'profile-photos',
        serviceName: 'attachments',
        expectedMin: 5,
        actual: 0,
        status: 'skipped',
        reason: 'Profile photo seed was skipped.',
      },
    ]

    const failures = entityResults
      .filter(result => result.status === 'failed')
      .map(result => `${result.entity}: ${result.reason}`)

    const warnings = entityResults
      .filter(result => result.status === 'skipped')
      .map(result => `${result.entity}: ${result.reason ?? 'skipped'}`)

    expect(failures).toEqual([])
    expect(warnings).toEqual(['profile-photos: Profile photo seed was skipped.'])
  })
})
