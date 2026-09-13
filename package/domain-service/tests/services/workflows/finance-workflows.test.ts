import { AcademicYear, BusinessRuleViolationError, Fee, FeeCategory, FeeStatus, Payment, PaymentMethod, PaymentStatus, Student, StudentFee } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createFinanceContext({
  studentFeeStatus = FeeStatus.Partial,
  paymentStatus = PaymentStatus.Recorded,
  paidAmount = 400,
  adjustmentAmount = 0,
}: {
  studentFeeStatus?: FeeStatus
  paymentStatus?: PaymentStatus
  paidAmount?: number
  adjustmentAmount?: number
} = {}) {
  const tuitionFee = new Fee({
    id: 'fee1',
    schoolId: 'sch1',
    academicYearId: 'ay1',
    name: 'Tuition',
    defaultAmount: 1000,
    currency: 'USD',
    category: FeeCategory.Tuition,
    installments: [
      { label: 'First', percentage: 50, dueDate: new Date('2026-02-01T00:00:00Z') },
      { label: 'Second', percentage: 50, dueDate: new Date('2026-05-01T00:00:00Z') },
    ],
  })
  const studentFee = new StudentFee({
    id: 'sf1',
    studentId: 'stu1',
    feeId: 'fee1',
    academicYearId: 'ay1',
    expectedAmount: 1000,
    paidAmount,
    adjustmentAmount,
    adjustmentReason: adjustmentAmount > 0 ? 'Sibling discount' : undefined,
    adjustedById: adjustmentAmount > 0 ? 'user1' : undefined,
    adjustedAt: adjustmentAmount > 0 ? new Date('2026-01-02T00:00:00Z') : undefined,
    currency: 'USD',
    status: studentFeeStatus,
    cancellationReason: studentFeeStatus === FeeStatus.Cancelled ? 'Cancelled' : undefined,
    cancelledById: studentFeeStatus === FeeStatus.Cancelled ? 'user1' : undefined,
    cancelledAt: studentFeeStatus === FeeStatus.Cancelled ? new Date('2026-01-01T00:00:00Z') : undefined,
  })
  const payment = new Payment({
    id: 'pay1',
    studentFeeId: 'sf1',
    amount: 400,
    currency: 'USD',
    paymentDate: new Date('2026-03-01T00:00:00Z'),
    method: PaymentMethod.Cash,
    status: paymentStatus,
    recordedById: 'user1',
    reversedAt: paymentStatus === PaymentStatus.Reversed ? new Date('2026-03-02T00:00:00Z') : undefined,
    reversedById: paymentStatus === PaymentStatus.Reversed ? 'user1' : undefined,
    cancelledAt: paymentStatus === PaymentStatus.Cancelled ? new Date('2026-03-02T00:00:00Z') : undefined,
    cancelledById: paymentStatus === PaymentStatus.Cancelled ? 'user1' : undefined,
  })
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({ id: 'ay1', schoolId: 'sch1', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' }))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Lovelace' }))
  await repositories.fees.save(tuitionFee)
  await repositories.studentFees.save(studentFee)
  await repositories.payments.save(payment)
  return { ...fixture, repositories, service: fixture.app }
}

describe('SchoolService finance workflows', () => {
  test('replaying a payment does not add its amount again', async () => {
    const { repositories, service } = await createFinanceContext()
    const result = await service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentFeeId: 'sf1',
      amount: 400,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    expect(result.id).toBe('pay1')
    expect(await repositories.payments.count()).toBe(1)
    expect((await repositories.studentFees.findById('sf1'))?.paidAmount.amount).toBe(400)
  })

  test('rejects a payment ID reused with changed input', async () => {
    const { repositories, service } = await createFinanceContext()
    await expect(service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentFeeId: 'sf1',
      amount: 401,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toMatchObject({ code: 'PAYMENT_REPLAY_CONFLICT' })
    expect((await repositories.studentFees.findById('sf1'))?.paidAmount.amount).toBe(400)
  })

  test('replaying a reversal leaves the balance unchanged', async () => {
    const { repositories, service } = await createFinanceContext({ paymentStatus: PaymentStatus.Reversed, paidAmount: 0 })
    await service.financeWorkflow.reversePayment({ paymentId: 'pay1' })
    expect(await repositories.payments.count()).toBe(1)
    expect((await repositories.studentFees.findById('sf1'))?.paidAmount.amount).toBe(0)
  })

  test('assignFeeToStudent materializes installments through managed service', async () => {
    const { repositories, service } = await createFinanceContext()

    await repositories.payments.delete('pay1')
    await repositories.studentFees.delete('sf1')
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
    expect((await repositories.studentFees.findById(result.id))?.data).toEqual(result.data)
  })

  test('recordPayment records payment and updates paid amount atomically', async () => {
    const { repositories, service } = await createFinanceContext()

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
    expect((await repositories.payments.findById(result.id))?.data).toEqual(result.data)
    expect(await repositories.studentFees.findById('sf1')).toMatchObject({
      status: FeeStatus.Paid,
    })
  })

  test('reversePayment reverses payment and decreases paid amount', async () => {
    const { repositories, service } = await createFinanceContext()

    const result = await service.financeWorkflow.reversePayment({
      paymentId: 'pay1',
      reversedAt: new Date('2026-03-03T00:00:00Z'),
      referenceDate: new Date('2026-03-03T00:00:00Z'),
    })

    expect(result.status).toBe(PaymentStatus.Reversed)
    expect(result.reversedById).toBe('user1')
    expect((await repositories.payments.findById(result.id))?.data).toEqual(result.data)
    expect(await repositories.studentFees.findById('sf1')).toMatchObject({
      paidAmount: expect.objectContaining({ amount: 0 }),
    })
  })

  test('cancelPayment cancels payment and decreases paid amount', async () => {
    const { repositories, service } = await createFinanceContext()

    const result = await service.financeWorkflow.cancelPayment({
      paymentId: 'pay1',
      cancelledAt: new Date('2026-03-03T00:00:00Z'),
      referenceDate: new Date('2026-03-03T00:00:00Z'),
    })

    expect(result.status).toBe(PaymentStatus.Cancelled)
    expect(result.cancelledById).toBe('user1')
    expect((await repositories.payments.findById(result.id))?.data).toEqual(result.data)
    expect(await repositories.studentFees.findById('sf1')).toMatchObject({
      paidAmount: expect.objectContaining({ amount: 0 }),
    })
  })

  test('recordPayment rejects cancelled student fees', async () => {
    const { service } = await createFinanceContext({ studentFeeStatus: FeeStatus.Cancelled })

    await expect(service.financeWorkflow.recordPayment({
      id: 'pay-new',
      studentFeeId: 'sf1',
      amount: 100,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('reversePayment rejects a previously cancelled payment', async () => {
    const { service } = await createFinanceContext({ paymentStatus: PaymentStatus.Cancelled })

    await expect(service.financeWorkflow.reversePayment({
      paymentId: 'pay1',
    })).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })
})
