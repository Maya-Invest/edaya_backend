import { createGuardianActorMetadata } from '@edaya/authorization'
import { AcademicYear, CatalogServiceStatus, Guardian, GuardianStudentLink, PaymentKind, PaymentMethod, PaymentStatus, School, Student, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'

async function createFinanceContext() {
  const fixture = await createTestApp(createTestStaffActor('sch1', 'user1'), { owner: true })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear(withShortName({
    id: 'ay1',
    schoolId: 'sch1',
    name: 'Year',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
    status: 'published',
  })))
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
  test('Guardian payment detail scopes the payment, labels and currency checks to the selected pupil and year', async () => {
    const f = await createFinanceContext()
    const { repositories, service } = f
    await repositories.guardians.save(new Guardian({ id: 'guardian', schoolId: 'sch1', subjectId: 'family', firstName: 'G', lastName: 'Parent' }))
    await repositories.students.save(new Student({ id: 'sibling', schoolId: 'sch1', firstName: 'Z', lastName: 'Sibling' }))
    for (const studentId of ['stu1', 'sibling'])
      await repositories.guardianLinks.save(new GuardianStudentLink({ id: studentId, schoolId: 'sch1', guardianId: 'guardian', studentId, receivesAcademicReports: true }))
    const family = f.forActor(createGuardianActorMetadata({ guardianId: 'guardian', subjectId: 'family', schoolId: 'sch1', requestId: 'detail', authenticatedAt: new Date() }))
    const input = { studentId: 'stu1', academicYearId: 'ay1', paymentId: 'receipt' }
    const record = { id: input.paymentId, studentId: input.studentId, academicYearId: 'ay1', amount: 300, method: PaymentMethod.Cash, paymentDate: new Date('2026-05-01T13:15:16.123Z') }
    expect((await family.getGuardianPaymentDetail(input)).payment).toBeNull()
    await service.financeWorkflow.recordPayment(record)
    await service.financeWorkflow.recordPayment({ ...record, id: 'sibling-receipt', studentId: 'sibling' })
    const initial = await family.getGuardianPaymentDetail(input)
    expect(initial.payment).toEqual({ id: 'receipt', chargeLabels: [], currency: 'USD', amount: 300, kind: PaymentKind.Receipt, method: PaymentMethod.Cash, reference: null, status: PaymentStatus.Recorded, paymentDate: record.paymentDate.toISOString() })
    const charges = [['a', 'Books'], ['b', 'Transport'], ['c', 'Books'], ['d', 'Reverse only']] as const
    for (const [id, name] of charges) {
      await service.financeWorkflow.createCatalogService({ id: `catalog-${id}`, academicYearId: 'ay1', name, defaultPrice: 10, currency: 'USD', billingTerms: { kind: 'one_time', installments: [] }, status: CatalogServiceStatus.Active })
      await service.financeWorkflow.enrollStudentInService({ id, studentId: 'stu1', catalogServiceId: `catalog-${id}` })
    }
    await f.db.exec(`insert into allocations(id,school_id,account_id,charge_id,amount,currency,kind,caused_by_payment_id,effective_at,recorded_at,created_at)
      select 'alloc-'||c.id, 'sch1', p.account_id, c.id, 5, 'USD', case when c.id='d' then 'reverse' else 'settle' end,
        p.id, now(), now(), now() from student_charges c join payments p on p.id='receipt' where c.id in ('a','b','c','d')`)
    expect((await family.getGuardianPaymentDetail(input)).payment?.chargeLabels).toEqual(['Books', 'Transport'])
    expect((await family.getGuardianPaymentDetail({ ...input, paymentId: 'missing' })).payment).toBeNull()
    expect((await family.getGuardianPaymentDetail({ ...input, studentId: 'sibling' })).payment).toBeNull()
    expect((await family.getGuardianPaymentDetail({ ...input, academicYearId: 'another-year' })).payment).toBeNull()
    await expect(service.getGuardianPaymentDetail(input)).rejects.toThrow()
    await f.db.exec('update payments set status=\'reversed\',reversed_at=now(),reversed_by_id=\'user1\' where id=\'receipt\'')
    expect((await family.getGuardianPaymentDetail(input)).payment?.status).toBe(PaymentStatus.Reversed)
    await service.financeWorkflow.recordPayment({ ...record, id: 'unrelated' })
    await f.db.exec('update student_account_entries set currency=\'EUR\' where source_id=\'unrelated\'')
    await expect(family.getGuardianPaymentDetail(input)).rejects.toMatchObject({ code: 'CURRENCY_MISMATCH' })
    expect((await family.getGuardianPaymentDetail({ ...input, studentId: 'sibling', paymentId: 'sibling-receipt' })).payment?.currency).toBe('USD')
    await repositories.guardianLinks.delete('stu1')
    await expect(family.getGuardianPaymentDetail(input)).rejects.toThrow()
  })

  test('Guardian settlement pages preserve summary, account checks and independent continuations', async () => {
    const f = await createFinanceContext()
    const { service, repositories } = f
    const scope = { studentId: 'stu1', academicYearId: 'ay1' }
    await repositories.guardians.save(new Guardian({ id: 'guardian', schoolId: 'sch1', subjectId: 'family', firstName: 'G', lastName: 'Parent' }))
    await repositories.students.save(new Student({ id: 'sibling', schoolId: 'sch1', firstName: 'Z', lastName: 'Sibling' }))
    for (const studentId of ['stu1', 'sibling'])
      await repositories.guardianLinks.save(new GuardianStudentLink({ id: studentId, schoolId: 'sch1', guardianId: 'guardian', studentId, receivesAcademicReports: true }))
    const family = f.forActor(createGuardianActorMetadata({ guardianId: 'guardian', subjectId: 'family', schoolId: 'sch1', requestId: 'page', authenticatedAt: new Date() }))
    const initial = await family.getGuardianSettlements({ ...scope, studentId: 'sibling' })
    expect(initial).toMatchObject({ accountId: null, payments: [], charges: [], nextPaymentCursor: null, nextChargeCursor: null })
    for (const id of ['p1', 'p2', 'p3']) {
      await service.financeWorkflow.recordPayment({ ...scope, id, amount: 25, method: PaymentMethod.Cash, paymentDate: new Date('2026-05-01T09:00:00Z') })
    }
    for (const [id, name] of [['a', 'Books'], ['b', 'Books'], ['c', 'Transport'], ['d', 'Cancelled']] as const) {
      await service.financeWorkflow.createCatalogService({ id: `cat-${id}`, academicYearId: 'ay1', name, defaultPrice: 50, currency: 'USD', billingTerms: { kind: 'one_time', installments: [] }, status: CatalogServiceStatus.Active })
      await service.financeWorkflow.enrollStudentInService({ id, studentId: 'stu1', catalogServiceId: `cat-${id}` })
    }
    await service.financeWorkflow.cancelStudentCharge({ requestId: 'cancel-d', chargeId: 'd', reason: 'Duplicate' })
    await f.db.exec(`update student_charges set due_date=null where id in ('a','b','c','d');
      update student_charges set due_date='2026-05-01' where id='enr1';
      update payments set payment_date='2026-05-01 09:00:00.000123' where id='p3';
      insert into allocations(id,school_id,account_id,charge_id,amount,currency,kind,caused_by_payment_id,effective_at,recorded_at,created_at)
      select 'extra-'||c.id, 'sch1', p.account_id, c.id, 5, 'USD','settle',p.id,now(),now(),now() from student_charges c join payments p on p.id='p3' where c.id in ('a','b','d');
      insert into allocations(id,school_id,account_id,charge_id,amount,currency,kind,caused_by_payment_id,effective_at,recorded_at,created_at)
      select 'reverse-a','sch1',account_id,'a',5,'USD','reverse',id,now(),now(),now() from payments where id='p3'`)
    const old = await family.getStudentFinanceSummary(scope)
    const summary = await family.getGuardianFeesSummary(scope)
    expect(summary).toMatchObject({ accountId: old.accountId, currency: old.currency, available: old.available.amount, outstanding: old.outstanding.amount, overdue: old.overdue.amount, expected: 1150 })
    const first = await family.getGuardianSettlements({ ...scope, limit: 1 })
    expect(first.payments[0]).toMatchObject({ id: 'p3', chargeLabels: ['Books'] })
    expect(first.charges.map(c => c.id)).toEqual(['enr1'])
    await service.financeWorkflow.recordPayment({ ...scope, id: 'new', amount: 10, method: PaymentMethod.Cash, paymentDate: new Date('2026-06-01') })
    let pay = first.nextPaymentCursor
    const paymentIds = []
    while (pay) {
      const page = await family.getGuardianSettlements({ ...scope, limit: 1, cursor: pay })
      expect(page.charges).toEqual([])
      paymentIds.push(...page.payments.map(p => p.id))
      pay = page.nextPaymentCursor
    }
    expect(paymentIds).toEqual(['p1', 'p2'])
    expect((await family.getGuardianSettlements({ ...scope, limit: 1 })).payments[0]?.id).toBe('new')
    const rest = await family.getGuardianSettlements({ ...scope, cursor: first.nextChargeCursor! })
    expect(rest.charges.map(c => c.id)).toEqual(['a', 'b', 'c'])
    expect(rest.payments).toEqual([])
    expect(rest.charges[0]?.settlementCount).toBe(1)
    expect(rest.nextChargeCursor).toBeNull()
    await expect(family.getGuardianSettlements({ ...scope, studentId: 'sibling', cursor: first.nextPaymentCursor! })).rejects.toThrow('cursor')
    await expect(family.getGuardianSettlements({ ...scope, cursor: 'broken' })).rejects.toThrow('cursor')
    await expect(service.getGuardianSettlements(scope)).rejects.toThrow()
    await f.db.exec('update student_account_entries set currency=\'EUR\' where source_id=\'p1\'')
    await expect(family.getGuardianSettlements({ ...scope, limit: 1 })).rejects.toMatchObject({ code: 'CURRENCY_MISMATCH' })
    expect((await family.getGuardianFeesSummary(scope)).currency).toBe('USD')
    await repositories.guardianLinks.delete('stu1')
    await expect(family.getGuardianSettlements({ ...scope, cursor: first.nextChargeCursor! })).rejects.toThrow()
  })

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

  test('an unset school currency cannot be initialized after financial records exist', async () => {
    const { repositories, service } = await createFinanceContext()
    const school = await repositories.schools.findById('sch1')
    await repositories.schools.save(new School(withShortName({ ...school!.data, financeCurrency: undefined })))
    expect((await repositories.schools.findById('sch1'))?.financeCurrency).toBeUndefined()
    await expect(service.setupWorkflow.updateSchoolConfiguration({ schoolId: 'sch1', financeCurrency: 'EUR' })).rejects.toMatchObject({ code: 'SCHOOL_CURRENCY_LOCKED' })
  })
})

describe('finance workspace read models', () => {
  test('overview separates receipts, refunds, allocations and unused credit', async () => {
    const { service } = await createFinanceContext()
    await service.financeWorkflow.recordPayment({ id: 'receipt-summary', studentId: 'stu1', academicYearId: 'ay1', amount: 800, paymentDate: new Date(), method: PaymentMethod.Cash, allocation: { mode: 'targeted', targets: [{ chargeId: 'enr1', amount: 300 }] } })
    const detail = await service.getFinanceBillingDetail({ schoolId: 'sch1', academicYearId: 'ay1', chargeId: 'enr1' })
    expect(detail?.catalogServiceId).toBe('cat1')
    expect(detail?.studentName).toBe('Ada Lovelace')
    expect(detail?.createdAt).toMatch(/Z$/)
    expect(detail?.remaining).toBe(700)
    await service.financeWorkflow.refundAvailableBalance({ id: 'refund-summary', accountId: detail!.accountId!, amount: 100, paymentDate: new Date(), method: PaymentMethod.Cash })
    const summary = await service.getFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1' })
    expect(summary).toMatchObject({ received: 800, refunded: 100, netCollected: 700, outstanding: 700, availableCredit: 400, overdueStudents: 1 })
    const fee = await service.getFeeFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1', feeId: 'cat1' })
    expect(fee).toMatchObject({ applied: 300, studentsAssigned: 1, netBilled: 1000, availableCredit: 0, netCollected: 0 })
    const transactions = await service.getFinancePaymentsPage({ schoolId: 'sch1', academicYearId: 'ay1', limit: 1 })
    expect(transactions.rows).toHaveLength(1)
    expect(transactions.total).toBe(2)
    const selectedPayment = await service.getFinancePaymentsPage({ schoolId: 'sch1', academicYearId: 'ay1', paymentId: 'receipt-summary' })
    expect(selectedPayment.total).toBe(1)
    expect(selectedPayment.rows[0]?.id).toBe('receipt-summary')
  })

  test('full-result filtering precedes pagination and overdue is bounded after adjustments', async () => {
    const { service } = await createFinanceContext()
    await service.financeWorkflow.adjustStudentCharge({ requestId: 'summary-adjust', chargeId: 'enr1', adjustmentAmount: 700, reason: 'Scholarship' })
    const result = await service.getFinanceBillingPage({ schoolId: 'sch1', academicYearId: 'ay1', search: 'Ada', feeId: 'cat1', offset: 1, limit: 1 })
    expect(result.total).toBe(1)
    expect((await service.getFinanceBillingPage({ schoolId: 'sch1', academicYearId: 'ay1', dueFrom: '2099-01-01' })).total).toBe(0)
    expect(result.rows).toHaveLength(0)
    const overview = await service.getFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1' })
    expect(overview.outstanding).toBe(300)
    expect(overview.overdue).toBeLessThanOrEqual(overview.outstanding)
    expect((await service.getFinanceBillingPage({ schoolId: 'sch1', academicYearId: 'ay1', search: 'missing' })).total).toBe(0)
  })

  test('cancelled enrollment retains its fee identity and contributes no obligation', async () => {
    const { service } = await createFinanceContext()
    await service.financeWorkflow.cancelStudentCharge({ requestId: 'cancel-summary', chargeId: 'enr1', reason: 'Withdrawal' })
    await service.financeWorkflow.cancelServiceEnrollment({ enrollmentId: 'enr1', reason: 'Withdrawal' })
    const detail = await service.getFinanceBillingDetail({ schoolId: 'sch1', academicYearId: 'ay1', chargeId: 'enr1' })
    expect(detail).toMatchObject({ catalogServiceId: 'cat1', remaining: 0, netAmount: 0, status: 'cancelled' })
    const summary = await service.getFeeFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1', feeId: 'cat1' })
    expect(summary.studentsAssigned).toBe(0)
    expect(summary.overdue).toBe(0)
    expect(await service.getFinanceBillingDetail({ schoolId: 'sch1', academicYearId: 'other', chargeId: 'enr1' })).toBeNull()
    await expect(service.getFinanceOverview({ schoolId: 'other', academicYearId: 'ay1' })).rejects.toThrow()
  })

  test('reversed receipts are excluded and an empty year has actual zero totals', async () => {
    const { service } = await createFinanceContext()
    await service.financeWorkflow.recordPayment({ id: 'reverse-summary', studentId: 'stu1', academicYearId: 'ay1', amount: 200, paymentDate: new Date(), method: PaymentMethod.Cash, allocation: { mode: 'account_only' } })
    await service.financeWorkflow.reversePayment({ paymentId: 'reverse-summary' })
    expect(await service.getFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1' })).toMatchObject({ received: 0, refunded: 0, netCollected: 0, availableCredit: 0 })
    expect(await service.getFinanceOverview({ schoolId: 'sch1', academicYearId: 'empty' })).toMatchObject({ outstanding: 0, overdue: 0, overdueStudents: 0 })
  })
})

describe('finance workspace authorization', () => {
  test('student-scoped payment reads constrain totals, detail, matching count and exports', async () => {
    const { service, repositories, forActor } = await createFinanceContext()
    await repositories.students.save(new Student({ id: 'hidden-student', schoolId: 'sch1', firstName: 'Hidden', lastName: 'Student' }))
    await service.financeWorkflow.enrollStudentInService({ id: 'hidden-charge', studentId: 'hidden-student', catalogServiceId: 'cat1' })
    const { StaffMember, StaffPermissionAssignment, Permission } = await import('@edaya/core')
    await repositories.staffMembers.save(new StaffMember({ id: 'cashier', schoolId: 'sch1', firstName: 'Scoped', lastName: 'Cashier', subjectId: 'cashier-subject' }))
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'finance-scope', schoolId: 'sch1', staffId: 'cashier', permission: Permission.PAYMENT_READ, academicYearId: 'ay1', scopes: [{ kind: 'student', studentId: 'stu1' }] }))
    const cashier = forActor({ ...createTestStaffActor('sch1', 'cashier'), subjectId: 'cashier-subject' })
    expect(await cashier.getFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1' })).toMatchObject({ outstanding: 1000, studentsAssigned: 1 })
    expect((await cashier.getFinanceBillingPage({ schoolId: 'sch1', academicYearId: 'ay1', limit: 1 })).total).toBe(1)
    expect(await cashier.getFinanceBillingDetail({ schoolId: 'sch1', academicYearId: 'ay1', chargeId: 'hidden-charge' })).toBeNull()
    expect((await cashier.getFinanceBillingPage({ schoolId: 'sch1', academicYearId: 'ay1', search: 'Hidden' })).total).toBe(0)
    expect((await cashier.getFinanceBillingPage({ schoolId: 'sch1', academicYearId: 'other' })).total).toBe(0)
  })

  test('catalog-only staff cannot read financial aggregates', async () => {
    const { repositories, forActor } = await createFinanceContext()
    const { StaffMember, StaffPermissionAssignment, Permission } = await import('@edaya/core')
    await repositories.staffMembers.save(new StaffMember({ id: 'catalog-reader', schoolId: 'sch1', firstName: 'Catalog', lastName: 'Reader', subjectId: 'catalog-subject' }))
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'catalog-read', schoolId: 'sch1', staffId: 'catalog-reader', permission: Permission.FINANCIAL_CONFIG_READ, academicYearId: 'ay1', scopes: [{ kind: 'school' }] }))
    const reader = forActor({ ...createTestStaffActor('sch1', 'catalog-reader'), subjectId: 'catalog-subject' })
    await expect(reader.getFinanceOverview({ schoolId: 'sch1', academicYearId: 'ay1' })).rejects.toThrow()
    await expect(reader.getFinanceBillingDetail({ schoolId: 'sch1', academicYearId: 'ay1', chargeId: 'enr1' })).rejects.toThrow()
  })
})

describe('finance fee attribution across one account', () => {
  test('deduplicates overdue students and tracks allocation reversal, waiver and archived fees', async () => {
    const { service, repositories } = await createFinanceContext()
    const catalog = (await repositories.catalogServices.findById('cat1'))!
    await repositories.catalogServices.save(catalog.copyWith({ id: 'cat2', name: 'Transport' }))
    await service.financeWorkflow.enrollStudentInService({ id: 'enr2', studentId: 'stu1', catalogServiceId: 'cat2' })
    const input = { schoolId: 'sch1', academicYearId: 'ay1' }
    expect(await service.getFinanceOverview(input)).toMatchObject({ outstanding: 2000, overdueStudents: 1, studentsAssigned: 1 })
    await service.financeWorkflow.recordPayment({ id: 'split-receipt', studentId: 'stu1', academicYearId: 'ay1', amount: 800, paymentDate: new Date(), method: PaymentMethod.Cash, allocation: { mode: 'targeted', targets: [{ chargeId: 'enr1', amount: 300 }, { chargeId: 'enr2', amount: 200 }] } })
    expect(await service.getFeeFinanceOverview({ ...input, feeId: 'cat1' })).toMatchObject({ applied: 300, outstanding: 700, availableCredit: 0 })
    expect(await service.getFeeFinanceOverview({ ...input, feeId: 'cat2' })).toMatchObject({ applied: 200, outstanding: 800 })
    const allocation = (await repositories.allocations.list({ chargeId: 'enr2' })).find(row => row.isSettle)!
    await service.financeWorkflow.reverseAllocation({ allocationId: allocation.id })
    await service.financeWorkflow.waiveStudentCharge({ requestId: 'waive-transport', chargeId: 'enr2', reason: 'Scholarship' })
    await service.financeWorkflow.archiveCatalogService({ id: 'cat2', requestId: 'archive-transport' })
    expect(await service.getFeeFinanceOverview({ ...input, feeId: 'cat2' })).toMatchObject({ applied: 0, outstanding: 0, overdue: 0, studentsAssigned: 1 })
    expect(await service.getFinanceOverview(input)).toMatchObject({ received: 800, outstanding: 700, availableCredit: 500, overdueStudents: 1 })
    const byAmount = await service.getFinanceBillingPage({ ...input, sort: 'remaining', direction: 'asc', limit: 1 })
    expect(byAmount.rows[0]?.id).toBe('enr2')
    expect(byAmount.total).toBe(2)
  })
})
