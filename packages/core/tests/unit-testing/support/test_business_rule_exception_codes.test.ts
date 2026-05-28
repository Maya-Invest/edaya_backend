import type { School } from '../../../src/entities/school/school'
import { describe, expect, test } from 'bun:test'
import { BusinessRuleViolationError } from '../../../src/services/shared/business-rule-error'
import { requireSchool } from '../../../src/services/shared/require-school'
import { createStore } from '../../support/in-memory-school-headless-app'

describe('Business rule exception shape and code verification', () => {
  test('requireSchool throws BusinessRuleViolationError with UNKNOWN_SCHOOL code on missing school', async () => {
    const schoolsRepo = createStore<School>()

    let thrownError: any = null
    try {
      await requireSchool(schoolsRepo as any, 'non-existent-school')
    }
    catch (err: any) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(BusinessRuleViolationError)
    expect(thrownError.code).toBe('UNKNOWN_SCHOOL')
    expect(thrownError.message).toContain('Unknown school: non-existent-school')
  })
})
