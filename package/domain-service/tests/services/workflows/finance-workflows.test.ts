import { BusinessRuleViolationError, FeeStatus, PaymentMethod, PaymentStatus } from '@edaya/core'
import {
  describe,
  expect,
  test,
} from 'bun:test'
import {
  actor,
  createFinanceContext,
} from './workflow-test-context'

describe('SchoolService finance workflows', () => {
  test('replaying a payment does not add its amount again', async () => {
    const { mockRepos, service } = createFinanceContext()
    const result = await service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentFeeId: 'sf1',
      amount: 400,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    expect(result.id).toBe('pay1')
    expect(mockRepos.payments.save).not.toHaveBeenCalled()
    expect(mockRepos.studentFees.save).not.toHaveBeenCalled()
  })

  test('rejects a payment ID reused with changed input', async () => {
    const { mockRepos, service } = createFinanceContext()
    await expect(service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentFeeId: 'sf1',
      amount: 401,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toMatchObject({ code: 'PAYMENT_REPLAY_CONFLICT' })
    expect(mockRepos.studentFees.save).not.toHaveBeenCalled()
  })

  test('replaying a reversal leaves the balance unchanged', async () => {
    const { mockRepos, service } = createFinanceContext({ paymentStatus: PaymentStatus.Reversed, paidAmount: 0 })
    await service.financeWorkflow.reversePayment({ paymentId: 'pay1' })
    expect(mockRepos.payments.save).not.toHaveBeenCalled()
    expect(mockRepos.studentFees.save).not.toHaveBeenCalled()
  })

  test('assignFeeToStudent materializes installments through managed service', async () => {
    const { mockPolicy, mockRepos, service } = createFinanceContext()

    const result = await service.financeWorkflow.assignFeeToStudent({
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

    const result = await service.financeWorkflow.recordPayment({
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

    const result = await service.financeWorkflow.reversePayment({
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

    const result = await service.financeWorkflow.cancelPayment({
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

    await expect(service.financeWorkflow.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 100,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('reversePayment rejects a previously cancelled payment', async () => {
    const { service } = createFinanceContext({ paymentStatus: PaymentStatus.Cancelled })

    await expect(service.financeWorkflow.reversePayment({
      paymentId: 'pay1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
