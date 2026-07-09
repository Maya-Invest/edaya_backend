import { describe, expect, test } from 'bun:test'
import {
  deriveRepairScopesFromFindings,
  SEED_DOCTOR_REPAIR_CHAIN,
} from '../../src/diagnostics/seed-doctor-repair'
import type { SeedDoctorFinding } from '../../src/diagnostics/seed-doctor'

function warn(code: string): SeedDoctorFinding {
  return { severity: 'warn', code, message: code }
}

describe('seed doctor repair', () => {
  test('SEED_DOCTOR_REPAIR_CHAIN preserves repair order', () => {
    expect(SEED_DOCTOR_REPAIR_CHAIN.map(step => step.scope)).toEqual([
      'auth:link',
      'service-account',
      'access',
      'profile-pictures',
    ])
  })

  test('deriveRepairScopesFromFindings maps warn findings to scopes in chain order', () => {
    const scopes = deriveRepairScopesFromFindings([
      warn('profile-photos-missing'),
      warn('staff-unlinked'),
      warn('access-assignments-missing'),
      { severity: 'error', code: 'auth-missing', message: 'x' },
    ])

    expect(scopes).toEqual(['auth:link', 'access', 'profile-pictures'])
  })

  test('deriveRepairScopesFromFindings ignores ok findings', () => {
    expect(deriveRepairScopesFromFindings([
      { severity: 'ok', code: 'staff-grants', message: 'ok' },
    ])).toEqual([])
  })
})
