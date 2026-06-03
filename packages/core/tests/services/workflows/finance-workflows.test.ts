import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  AuthorizationError,
  AuthorizationErrorCode,
} from '../../../src/authorization'
import {
  FeeStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../../src/entities'
import { BusinessRuleViolationError } from '../../../src/shared/business-rule-error'
import {
  actor,
  createFinanceContext,
} from './workflow-test-context'

describe('SchoolService finance workflows', () => {
  test('assignFeeToStudent materializes installments through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createFinanceContext()

    const result = await service.assignFeeToStudent({
      id: 'sf-new',
      studentId: 'stu1',
      feeId: 'fee1',
      referenceDate: new Date('2026-01-01T00:00:00Z'),
    })

    expect(result.id).toBe('sf-new')
    expect(result.installments).toHaveLength(2)
    expect(result.installments[0]?.expectedAmount).toBe(500)
    expect(result.installments[1]?.expectedAmount).toBe(500)
    expect(result.status).toBe(FeeStatus.Pending)
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(result)
  })

  test('recordPayment records payment and updates paid amount atomically', async () => {
    const { mockAtomic, mockPolicy, mockRepos, service } = createFinanceContext()

    const result = await service.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 600,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
      referenceDate: new Date('2026-03-02T00:00:00Z'),
    })

    expect(result.id).toBe('pay-new')
    expect(result.recordedById).toBe('user1')
    expect(mockAtomic.execute).toHaveBeenCalled()
    expect(mockPolicy.checkStudentAccess).toHaveBeenCalledWith(actor, ['stu1'])
    expect(mockPolicy.checkStudentFeeAccess).toHaveBeenCalledWith(actor, ['sf1'])
    expect(mockRepos.payments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sf1',
      status: FeeStatus.Paid,
    }))
  })

  test('reversePayment reverses payment and decreases paid amount', async () => {
    const { mockRepos, service } = createFinanceContext()

    const result = await service.reversePayment({
      paymentId: 'pay1',
      reversedAt: new Date('2026-03-03T00:00:00Z'),
      referenceDate: new Date('2026-03-03T00:00:00Z'),
    })

    expect(result.status).toBe(PaymentStatus.Reversed)
    expect(result.reversedById).toBe('user1')
    expect(mockRepos.payments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sf1',
      paidAmount: expect.objectContaining({ amount: 0 }),
    }))
  })

  test('cancelPayment cancels payment and decreases paid amount', async () => {
    const { mockRepos, service } = createFinanceContext()

    const result = await service.cancelPayment({
      paymentId: 'pay1',
      cancelledAt: new Date('2026-03-03T00:00:00Z'),
      referenceDate: new Date('2026-03-03T00:00:00Z'),
    })

    expect(result.status).toBe(PaymentStatus.Cancelled)
    expect(result.cancelledById).toBe('user1')
    expect(mockRepos.payments.save).toHaveBeenCalledWith(result)
    expect(mockRepos.studentFees.save).toHaveBeenCalledWith(expect.objectContaining({
      id: 'sf1',
      paidAmount: expect.objectContaining({ amount: 0 }),
    }))
  })

  test('recordPayment rejects cancelled student fees', async () => {
    const { service } = createFinanceContext({ studentFeeStatus: FeeStatus.Cancelled })

    await expect(service.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 100,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('reversePayment rejects non-recorded payments', async () => {
    const { service } = createFinanceContext({ paymentStatus: PaymentStatus.Reversed })

    await expect(service.reversePayment({
      paymentId: 'pay1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('assignFeeToStudent checks finance.manage permission', async () => {
    const context = createFinanceContext()
    const mockPolicy = context.mockPolicy as any
    const service = context.service
    mockPolicy.checkGlobalAction.mockImplementation(async (_actor: any, action: string) => {
      if (action === 'finance.manage') {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    })

    await expect(service.assignFeeToStudent({
      id: 'sf-new',
      studentId: 'stu1',
      feeId: 'fee1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('recordPayment checks finance.manage permission', async () => {
    const context = createFinanceContext()
    const mockPolicy = context.mockPolicy as any
    const service = context.service
    mockPolicy.checkGlobalAction.mockImplementation(async (_actor: any, action: string) => {
      if (action === 'finance.manage') {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    })

    await expect(service.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 100,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('updatePaymentStatus checks finance.manage permission', async () => {
    const context = createFinanceContext()
    const mockPolicy = context.mockPolicy as any
    const service = context.service
    mockPolicy.checkGlobalAction.mockImplementation(async (_actor: any, action: string) => {
      if (action === 'finance.manage') {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    })

    await expect(service.reversePayment({
      paymentId: 'pay1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })


})
