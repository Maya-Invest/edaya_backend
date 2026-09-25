import { AcademicYear, CatalogServiceStatus, PaymentKind, PaymentMethod, PaymentStatus, Student } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createFinanceContext() {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear({
    id: 'ay1',
    schoolId: 'sch1',
    name: 'Year',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'published',
  }))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Lovelace' }))
  await fixture.app.financeWorkflow.createCatalogService({
    id: 'cat1',
    academicYearId: 'ay1',
    name: 'Tuition',
    defaultPrice: 1000,
    currency: 'USD',
    billingTerms: {
      kind: 'one_time',
      installments: [
        { label: 'First', percentage: 50, dueDate: new Date('2026-02-01T00:00:00Z') },
        { label: 'Second', percentage: 50, dueDate: new Date('2026-05-01T00:00:00Z') },
      ],
    },
    status: CatalogServiceStatus.Active,
  })
  await fixture.app.financeWorkflow.enrollStudentInService({
    id: 'enr1',
    studentId: 'stu1',
    catalogServiceId: 'cat1',
  })
  return { ...fixture, repositories, service: fixture.app }
}

describe('SchoolService finance workflows', () => {
  test('enroll materializes one-time installments', async () => {
    const { repositories, service } = await createFinanceContext()
    const charge = await repositories.studentCharges.findById('enr1')
    expect(charge?.installments).toHaveLength(2)
    expect(charge?.installments[0]?.expectedAmount).toBe(500)
    expect(charge?.installments[1]?.expectedAmount).toBe(500)
    const replay = await service.financeWorkflow.enrollStudentInService({
      id: 'enr1',
      studentId: 'stu1',
      catalogServiceId: 'cat1',
    })
    expect(replay.id).toBe('enr1')
    expect(await repositories.studentServiceEnrollments.count()).toBe(1)
  })

  test('replaying a payment does not credit the account again', async () => {
    const { repositories, service } = await createFinanceContext()
    const first = await service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentId: 'stu1',
      academicYearId: 'ay1',
      amount: 400,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    const replay = await service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentId: 'stu1',
      academicYearId: 'ay1',
      amount: 400,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    expect(replay.id).toBe(first.id)
    expect(await repositories.payments.count()).toBe(1)
    const account = (await repositories.studentYearAccounts.list({ studentId: 'stu1' }))[0]
    expect(account?.availableBalance.amount).toBe(400)
  })

  test('rejects a payment ID reused with changed input', async () => {
    const { service } = await createFinanceContext()
    await service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentId: 'stu1',
      academicYearId: 'ay1',
      amount: 400,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    await expect(service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentId: 'stu1',
      academicYearId: 'ay1',
      amount: 401,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
    })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
  })

  test('FIFO allocation settles the charge and reversePayment restores available funds', async () => {
    const { repositories, service } = await createFinanceContext()
    await service.financeWorkflow.recordPayment({
      id: 'pay1',
      studentId: 'stu1',
      academicYearId: 'ay1',
      amount: 1000,
      paymentDate: new Date('2026-03-01T00:00:00Z'),
      method: PaymentMethod.Cash,
      allocation: { mode: 'fifo' },
    })
    expect((await repositories.studentCharges.findById('enr1'))?.allocatedAmount.amount).toBe(1000)
    const allocations = await repositories.allocations.list({ chargeId: 'enr1' })
    await service.financeWorkflow.reversePayment({
      paymentId: 'pay1',
      reverseAllocationIds: allocations.filter(item => item.isSettle).map(item => item.id),
    })
    expect((await repositories.payments.findById('pay1'))?.status).toBe(PaymentStatus.Reversed)
    expect((await repositories.studentYearAccounts.list({ studentId: 'stu1' }))[0]?.availableBalance.amount).toBe(0)
  })

  test('retired cancelPayment fails clearly', async () => {
    const { service } = await createFinanceContext()
    expect(() => service.financeWorkflow.cancelPayment()).toThrow('The fee model has been replaced')
  })

  test('recordPayment can deposit without settling a cancelled charge', async () => {
    const { repositories, service } = await createFinanceContext()
    await service.financeWorkflow.cancelStudentCharge({ requestId: 'cancel-enr1', chargeId: 'enr1', reason: 'Duplicate' })
    const payment = await service.financeWorkflow.recordPayment({
      id: 'pay-deposit',
      studentId: 'stu1',
      academicYearId: 'ay1',
      amount: 100,
      paymentDate: new Date('2026-03-02T00:00:00Z'),
      method: PaymentMethod.Cash,
    })
    expect(payment.kind).toBe(PaymentKind.Receipt)
    expect((await repositories.studentYearAccounts.list({ studentId: 'stu1' }))[0]?.availableBalance.amount).toBe(100)
  })
  test('catalog status edits require their own request identity and reject changed-target retries', async () => {
    const { service, repositories } = await createFinanceContext()
    const catalog = (await repositories.catalogServices.findById('cat1'))!
    await repositories.catalogServices.save(catalog.copyWith({ id: 'cat2', name: 'Other catalog' }))
    const input = { id: 'cat1', requestId: 'catalog-archive' }
    expect((await service.financeWorkflow.archiveCatalogService(input)).status).toBe(CatalogServiceStatus.Archived)
    expect((await service.financeWorkflow.archiveCatalogService(input)).id).toBe('cat1')
    await expect(service.financeWorkflow.archiveCatalogService({ ...input, id: 'cat2' })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
  })

  test('catalog edits have independent identities and replay hashes include the entire payload', async () => {
    const { service } = await createFinanceContext()
    const first = { requestId: 'catalog-edit-1', id: 'cat1', name: 'Tuition revised' }
    expect((await service.financeWorkflow.updateCatalogService(first)).name).toBe('Tuition revised')
    expect((await service.financeWorkflow.updateCatalogService(first)).name).toBe('Tuition revised')
    await expect(service.financeWorkflow.updateCatalogService({ ...first, name: 'Changed retry' })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
    expect((await service.financeWorkflow.updateCatalogService({ ...first, requestId: 'catalog-edit-2', name: 'Second edit' })).name).toBe('Second edit')
  })

  test('adjustment retries are idempotent but a second logical adjustment is rejected', async () => {
    const { service } = await createFinanceContext()
    const input = { requestId: 'adjust-1', chargeId: 'enr1', adjustmentAmount: 100, reason: 'Correction' }
    await service.financeWorkflow.adjustStudentCharge(input)
    expect((await service.financeWorkflow.adjustStudentCharge(input)).adjustmentAmount.amount).toBe(100)
    await expect(service.financeWorkflow.adjustStudentCharge({ ...input, reason: 'Different reason' })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
    await expect(service.financeWorkflow.adjustStudentCharge({ ...input, requestId: 'adjust-2' })).rejects.toMatchObject({ code: 'ALREADY_ADJUSTED_CHARGE' })
    await expect(service.setupWorkflow.updateSchoolConfiguration({ schoolId: 'sch1', financeCurrency: 'EUR' })).rejects.toMatchObject({ code: 'SCHOOL_CURRENCY_LOCKED' })
  })
})
