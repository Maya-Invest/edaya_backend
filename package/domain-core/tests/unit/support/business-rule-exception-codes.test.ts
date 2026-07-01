import type { School } from '../../../src'
import { describe, expect, test } from 'bun:test'
import { requireSchool } from '../../../src/application/require-school'
import { BusinessRuleViolationError } from '../../../src/domain/shared/business-rule-error'
import { createStore } from '../../support/create-test-app'

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
