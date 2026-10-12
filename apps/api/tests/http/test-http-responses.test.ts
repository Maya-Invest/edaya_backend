import { AuthorizationError, AuthorizationErrorCode } from '@edaya/authorization'
import { BusinessRuleViolationError, DomainValidationError } from '@edaya/core'
import { describe, expect, it, mock } from 'bun:test'
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  routeErrorResponse,
} from '@/http/responses'

function createTestContext(): { context: any, json: ReturnType<typeof mock> } {
  const json = mock((body: unknown, status: number) => ({ body, status }))
  const context = {
    json,
    var: { logger: { error: mock() } },
  }
  return { context, json }
}

describe('routeErrorResponse', () => {
  it('maps AuthorizationError to 403', () => {
    const { context, json } = createTestContext()
    routeErrorResponse(context as any, new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Access denied'))
    expect(json).toHaveBeenCalledWith(
      { message: 'Access denied', code: AuthorizationErrorCode.Forbidden },
      403,
    )
  })

  it('maps DomainValidationError to 400', () => {
    const { context, json } = createTestContext()
    routeErrorResponse(context as any, new DomainValidationError('name must not be blank'))
    expect(json).toHaveBeenCalledWith(
      { message: 'name must not be blank' },
      400,
    )
  })

  it('maps BusinessRuleViolationError to 409', () => {
    const { context, json } = createTestContext()
    routeErrorResponse(context as any, new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_EXCEEDED', 'Capacity exceeded'))
    expect(json).toHaveBeenCalledWith(
      { message: 'Capacity exceeded', code: 'CLASS_GROUP_CAPACITY_EXCEEDED' },
      409,
    )
  })

  it('includes structured workload details for localized generation feedback', () => {
    const { context, json } = createTestContext()
    const details = { classGroupId: 'class', classSubjectId: 'english', weekKey: '2026-09-14', placed: 2, required: 3 }
    routeErrorResponse(context as any, new BusinessRuleViolationError('TIMETABLE_WORKLOAD_UNSATISFIED', 'Unmet workload', details))
    expect(json).toHaveBeenCalledWith({ message: 'Unmet workload', code: 'TIMETABLE_WORKLOAD_UNSATISFIED', details }, 409)
  })

  it('maps unknown errors to 500', () => {
    const { context, json } = createTestContext()
    routeErrorResponse(context as any, new Error('unexpected'))
    expect(json).toHaveBeenCalledWith(
      { message: 'Internal server error occurred' },
      500,
    )
  })
})

describe('response helpers', () => {
  it('forbiddenResponse includes optional code', () => {
    const { context, json } = createTestContext()
    forbiddenResponse(context as any, new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Denied'))
    expect(json).toHaveBeenCalledWith({ message: 'Denied', code: AuthorizationErrorCode.Forbidden }, 403)
  })

  it('conflictResponse includes business rule code', () => {
    const { context, json } = createTestContext()
    conflictResponse(context as any, new BusinessRuleViolationError('RULE', 'Blocked'))
    expect(json).toHaveBeenCalledWith({ message: 'Blocked', code: 'RULE' }, 409)
  })

  it('badRequestResponse merges details', () => {
    const { context, json } = createTestContext()
    badRequestResponse(context as any, 'Invalid', { field: 'name' })
    expect(json).toHaveBeenCalledWith({ message: 'Invalid', field: 'name' }, 400)
  })
})
