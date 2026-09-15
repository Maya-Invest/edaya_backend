import { AcademicYear, CatalogServiceStatus, ChargeStatus, PaymentKind, PaymentMethod, PaymentStatus, Student } from '@edaya/core'
import { beforeEach, describe, expect, test } from 'bun:test'
import { createTestApp } from '../support/create-test-app'

describe('service catalog accounting', () => {
  let fixture: Awaited<ReturnType<typeof createTestApp>>

  beforeEach(async () => {
    fixture = await createTestApp()
    await fixture.schoolRepositories.academicYears.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      status: 'published',
    }))
    await fixture.schoolRepositories.students.save(new Student({
      id: 'stu-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))
  })

  async function catalogAndEnroll() {
    const finance = fixture.app.financeWorkflow
    await finance.createCatalogService({
      id: 'cat-tuition',
      academicYearId: 'year-1',
      name: 'Tuition A',
      defaultPrice: 60000,
      currency: 'XOF',
      billingTerms: { kind: 'one_time', installments: [], singleDueDate: new Date('2026-02-01') },
      status: CatalogServiceStatus.Active,
    })
    await finance.createCatalogService({
      id: 'cat-transport',
      academicYearId: 'year-1',
      name: 'Transport',
      defaultPrice: 40000,
      currency: 'XOF',
      billingTerms: { kind: 'one_time', installments: [], singleDueDate: new Date('2026-03-01') },
      status: CatalogServiceStatus.Active,
    })
    await finance.enrollStudentInService({ id: 'enr-60', studentId: 'stu-1', catalogServiceId: 'cat-tuition' })
    await finance.enrollStudentInService({ id: 'enr-40', studentId: 'stu-1', catalogServiceId: 'cat-transport' })
  }

  test('FIFO receipt of 120000 against 60000 and 40000 leaves 20000 available', async () => {
    await catalogAndEnroll()
    const payment = await fixture.app.financeWorkflow.recordPayment({
      id: 'pay-120',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      amount: 120000,
      paymentDate: new Date('2026-04-01'),
      method: PaymentMethod.BankTransfer,
      allocation: { mode: 'fifo' },
    })
    expect(payment.kind).toBe(PaymentKind.Receipt)
    const summary = await fixture.app.financeWorkflow.getStudentFinanceSummary({ studentId: 'stu-1', academicYearId: 'year-1' })
    expect(summary.available.amount).toBe(20000)
    expect(summary.outstanding.amount).toBe(0)
    const sixty = await fixture.schoolRepositories.studentCharges.findById('enr-60')
    const forty = await fixture.schoolRepositories.studentCharges.findById('enr-40')
    expect(sixty?.status).toBe(ChargeStatus.Paid)
    expect(forty?.status).toBe(ChargeStatus.Paid)
    expect(sixty?.allocatedAmount.amount).toBe(60000)
    expect(forty?.allocatedAmount.amount).toBe(40000)
  })

  test('reversing the first allocation restores 60000 debt and 80000 available', async () => {
    await catalogAndEnroll()
    await fixture.app.financeWorkflow.recordPayment({
      id: 'pay-120',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      amount: 120000,
      paymentDate: new Date('2026-04-01'),
      method: PaymentMethod.BankTransfer,
      allocation: { mode: 'fifo' },
    })
    const allocations = await fixture.schoolRepositories.allocations.list({ chargeId: 'enr-60' })
    const settle = allocations.find(item => item.isSettle)!
    await fixture.app.financeWorkflow.reverseAllocation({ allocationId: settle.id })
    const summary = await fixture.app.financeWorkflow.getStudentFinanceSummary({ studentId: 'stu-1', academicYearId: 'year-1' })
    expect(summary.available.amount).toBe(80000)
    expect(summary.outstanding.amount).toBe(60000)
    const sixty = await fixture.schoolRepositories.studentCharges.findById('enr-60')
    expect(sixty?.allocatedAmount.amount).toBe(0)
    expect(sixty?.status).toBe(ChargeStatus.Overdue)
  })

  test('refund is a distinct disbursement and cannot exceed available funds', async () => {
    await catalogAndEnroll()
    await fixture.app.financeWorkflow.recordPayment({
      id: 'pay-120',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      amount: 120000,
      paymentDate: new Date('2026-04-01'),
      method: PaymentMethod.Cash,
      allocation: { mode: 'fifo' },
    })
    const account = (await fixture.schoolRepositories.studentYearAccounts.list({ studentId: 'stu-1' }))[0]!
    const refund = await fixture.app.financeWorkflow.refundAvailableBalance({
      id: 'refund-1',
      accountId: account.id,
      amount: 20000,
      paymentDate: new Date('2026-04-02'),
      method: PaymentMethod.Cash,
    })
    expect(refund.kind).toBe(PaymentKind.Disbursement)
    expect(refund.status).toBe(PaymentStatus.Recorded)
    const summary = await fixture.app.financeWorkflow.getStudentFinanceSummary({ studentId: 'stu-1', academicYearId: 'year-1' })
    expect(summary.available.amount).toBe(0)
    await expect(fixture.app.financeWorkflow.refundAvailableBalance({
      id: 'refund-2',
      accountId: account.id,
      amount: 1,
      paymentDate: new Date('2026-04-03'),
      method: PaymentMethod.Cash,
    })).rejects.toMatchObject({ code: 'REFUND_EXCEEDS_AVAILABLE' })
  })

  test('retired fee commands fail clearly', async () => {
    expect(() => fixture.app.financeWorkflow.createFee()).toThrow('The fee model has been replaced')
    expect(() => fixture.app.financeWorkflow.cancelPayment()).toThrow('The fee model has been replaced')
  })

  test('duplicate payment references in the same year are rejected', async () => {
    await catalogAndEnroll()
    await fixture.app.financeWorkflow.recordPayment({
      id: 'pay-1',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      amount: 1000,
      paymentDate: new Date('2026-04-01'),
      method: PaymentMethod.Cash,
      reference: 'RCPT-1',
    })
    await expect(fixture.app.financeWorkflow.recordPayment({
      id: 'pay-2',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      amount: 1000,
      paymentDate: new Date('2026-04-02'),
      method: PaymentMethod.Cash,
      reference: 'RCPT-1',
    })).rejects.toMatchObject({ code: 'PAYMENT_REFERENCE_DUPLICATE' })
  })

  test('reconciliation is balanced after the required scenario', async () => {
    await catalogAndEnroll()
    await fixture.app.financeWorkflow.recordPayment({
      id: 'pay-120',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      amount: 120000,
      paymentDate: new Date('2026-04-01'),
      method: PaymentMethod.BankTransfer,
      allocation: { mode: 'fifo' },
    })
    const recon = await fixture.app.financeWorkflow.getFinanceReconciliation({ schoolId: 'school', academicYearId: 'year-1' })
    expect(recon.balanced).toBe(true)
  })

  test('recordPayment can open a second-currency account from a generated account id', async () => {
    await catalogAndEnroll()
    const payment = await fixture.app.financeWorkflow.recordPayment({
      id: 'pay-usd',
      studentId: 'stu-1',
      academicYearId: 'year-1',
      accountId: 'sya:school:stu-1:year-1:USD',
      amount: 5000,
      paymentDate: new Date('2026-04-02'),
      method: PaymentMethod.Card,
      allocation: { mode: 'account_only' },
    })
    expect(payment.accountId).toBe('sya:school:stu-1:year-1:USD')
    const account = await fixture.schoolRepositories.studentYearAccounts.findById(payment.accountId)
    expect(account?.currency).toBe('USD')
    expect(account?.availableBalance.amount).toBe(5000)
  })
})
