import { BusinessRuleViolationError } from '@edaya/core'
import { requireSchool } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { createStore } from '../support/create-test-app'

describe('Business rule exception shape and code verification', () => {
  test('requireSchool throws BusinessRuleViolationError with UNKNOWN_SCHOOL code on missing school', async () => {
    const schoolsRepo = createStore<{ id: string }>()

    let thrownError: unknown = null
    try {
      await requireSchool(schoolsRepo as never, 'non-existent-school')
    }
    catch (err: unknown) {
      thrownError = err
    }

    expect(thrownError).toBeInstanceOf(BusinessRuleViolationError)
    expect((thrownError as BusinessRuleViolationError).code).toBe('UNKNOWN_SCHOOL')
    expect((thrownError as BusinessRuleViolationError).message).toContain('Unknown school: non-existent-school')
  })
})
