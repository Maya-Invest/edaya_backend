import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SQL } from 'drizzle-orm'
import { createHash } from 'node:crypto'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresSchoolRepositories, resetDisposableFinanceRecords } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import {
  AcademicYear,
  AllocationKind,
  Attachment,
  AttachmentOwnerKind,
  CatalogServiceStatus,
  ChargeStatus,
  noOpFileStorage,
  noOpNotificationGateway,
  PaymentKind,
  PaymentMethod,
  School,
  StaffMember,
  Student,
  studentYearAccountId,
} from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Run with bun run test:integration:native against the disposable loopback cluster')

interface NativeSchoolDb extends PostgresTransactionalDb {
  execute: (query: SQL) => Promise<unknown>
}

function nativeDb(db: unknown): NativeSchoolDb {
  return db as NativeSchoolDb
}

const handles = await Promise.all([
  createPostgresSchoolDatabase(url, { max: 1 }),
  createPostgresSchoolDatabase(url, { max: 1 }),
])
const repositories = handles.map(handle => new PostgresSchoolRepositories(handle.db))
const actor = createStaffActorMetadata({
  schoolId: 'finance-school',
  staffMemberId: 'finance-owner',
  subjectId: 'finance-person',
  requestId: 'native-test',
  authenticatedAt: new Date(),
  assuranceLevel: ActorAssuranceLevel.Strong,
})
const services = handles.map((handle, index) => new SchoolApplication({
  repositories: repositories[index]!,
  atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb),
  commandJournal: new PostgresCommandJournal(),
  notificationGateway: noOpNotificationGateway,
  fileStorage: noOpFileStorage,
}).forActor(actor))
const repos = repositories[0]!
const paymentDate = new Date('2026-09-08T00:00:00Z')
const yearId = 'finance-year'

beforeAll(async () => {
  await repos.init({ driver: 'node-postgres' })
  await repos.schools.save(new School({ id: actor.schoolId, name: 'Synthetic finance school', timeZone: 'UTC', ownerSubjectId: actor.subjectId }))
  await repos.staffMembers.save(new StaffMember({ id: actor.staffMemberId, schoolId: actor.schoolId, subjectId: actor.subjectId, firstName: 'Finance', lastName: 'Owner' }))
  await repos.academicYears.save(new AcademicYear({
    id: yearId,
    schoolId: actor.schoolId,
    name: '2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
  }))
}, 30000)

afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

async function student(id: string) {
  await repos.students.save(new Student({ id, schoolId: actor.schoolId, firstName: 'Synthetic', lastName: id }))
}

async function catalog(id: string, price: number, due: string) {
  return services[0]!.financeWorkflow.createCatalogService({
    id,
    academicYearId: yearId,
    name: id,
    defaultPrice: price,
    currency: 'USD',
    billingTerms: { kind: 'one_time', installments: [], singleDueDate: new Date(due) },
    status: CatalogServiceStatus.Active,
  })
}

function accountId(studentId: string) {
  return studentYearAccountId(actor.schoolId, studentId, yearId, 'USD')
}

test('concurrent identical payment commands credit the balance once', async () => {
  await student('native-same-student')
  await catalog('native-same-cat', 1000, '2026-02-01')
  await services[0]!.financeWorkflow.enrollStudentInService({
    id: 'native-same-enr',
    studentId: 'native-same-student',
    catalogServiceId: 'native-same-cat',
  })
  const input = {
    id: 'native-payment-same',
    studentId: 'native-same-student',
    academicYearId: yearId,
    amount: 400,
    paymentDate,
    method: PaymentMethod.Cash,
    allocation: { mode: 'account_only' as const },
  }
  await Promise.all(services.map(service => service.financeWorkflow.recordPayment(input)))
  expect((await repos.studentYearAccounts.findById(accountId('native-same-student')))?.availableBalance.amount).toBe(400)
  expect(await repos.payments.count({ id: input.id })).toBe(1)
  await expect(services[0]!.financeWorkflow.recordPayment({ ...input, amount: 401 })).rejects.toMatchObject({ code: 'COMMAND_REPLAY_CONFLICT' })
})

test('distinct simultaneous payments on different accounts both persist', async () => {
  await student('native-a')
  await student('native-b')
  await catalog('native-distinct-cat', 1000, '2026-02-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-a-enr', studentId: 'native-a', catalogServiceId: 'native-distinct-cat' })
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-b-enr', studentId: 'native-b', catalogServiceId: 'native-distinct-cat' })
  await Promise.all([
    services[0]!.financeWorkflow.recordPayment({
      id: 'native-payment-a',
      studentId: 'native-a',
      academicYearId: yearId,
      amount: 120,
      paymentDate,
      method: PaymentMethod.Cash,
      allocation: { mode: 'account_only' },
    }),
    services[1]!.financeWorkflow.recordPayment({
      id: 'native-payment-b',
      studentId: 'native-b',
      academicYearId: yearId,
      amount: 80,
      paymentDate,
      method: PaymentMethod.Cash,
      allocation: { mode: 'account_only' },
    }),
  ])
  expect((await repos.payments.findById('native-payment-a'))?.amount.amount).toBe(120)
  expect((await repos.payments.findById('native-payment-b'))?.amount.amount).toBe(80)
})

test('competing allocations on one account never overspend', async () => {
  await student('native-race')
  await catalog('native-race-a', 500, '2026-02-01')
  await catalog('native-race-b', 500, '2026-03-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-race-enr-a', studentId: 'native-race', catalogServiceId: 'native-race-a' })
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-race-enr-b', studentId: 'native-race', catalogServiceId: 'native-race-b' })
  await services[0]!.financeWorkflow.recordPayment({
    id: 'native-race-deposit',
    studentId: 'native-race',
    academicYearId: yearId,
    amount: 800,
    paymentDate,
    method: PaymentMethod.Cash,
    allocation: { mode: 'account_only' },
  })
  const id = accountId('native-race')
  await Promise.allSettled([
    services[0]!.financeWorkflow.allocateAccountBalance({ id: 'native-alloc-1', accountId: id, allocation: { mode: 'fifo' } }),
    services[1]!.financeWorkflow.allocateAccountBalance({ id: 'native-alloc-2', accountId: id, allocation: { mode: 'fifo' } }),
  ])
  const account = await repos.studentYearAccounts.findById(id)
  const allocations = await repos.allocations.list({ accountId: id })
  const active = allocations
    .filter(row => row.kind === AllocationKind.Settle)
    .reduce((sum, row) => sum + row.amount.amount, 0)
    - allocations.filter(row => row.kind === AllocationKind.Reverse).reduce((sum, row) => sum + row.amount.amount, 0)
  expect(account?.availableBalance.amount).toBeGreaterThanOrEqual(0)
  expect((account?.availableBalance.amount ?? 0) + active).toBe(800)
})

test('receipt reversal versus allocation keeps funds non-negative', async () => {
  await student('native-rev')
  await catalog('native-rev-cat', 1000, '2026-02-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-rev-enr', studentId: 'native-rev', catalogServiceId: 'native-rev-cat' })
  await services[0]!.financeWorkflow.recordPayment({
    id: 'native-rev-pay',
    studentId: 'native-rev',
    academicYearId: yearId,
    amount: 400,
    paymentDate,
    method: PaymentMethod.Cash,
    allocation: { mode: 'account_only' },
  })
  const id = accountId('native-rev')
  const results = await Promise.allSettled([
    services[0]!.financeWorkflow.reversePayment({ paymentId: 'native-rev-pay' }),
    services[1]!.financeWorkflow.allocateAccountBalance({ id: 'native-rev-alloc', accountId: id, allocation: { mode: 'fifo' } }),
  ])
  expect(results.some(result => result.status === 'fulfilled')).toBe(true)
  expect((await repos.studentYearAccounts.findById(id))?.availableBalance.amount).toBeGreaterThanOrEqual(0)
})

test('refund versus allocation keeps funds non-negative', async () => {
  await student('native-refund')
  await catalog('native-refund-cat', 1000, '2026-02-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-refund-enr', studentId: 'native-refund', catalogServiceId: 'native-refund-cat' })
  await services[0]!.financeWorkflow.recordPayment({
    id: 'native-refund-deposit',
    studentId: 'native-refund',
    academicYearId: yearId,
    amount: 250,
    paymentDate,
    method: PaymentMethod.Cash,
    allocation: { mode: 'account_only' },
  })
  const id = accountId('native-refund')
  await Promise.allSettled([
    services[0]!.financeWorkflow.refundAvailableBalance({
      id: 'native-refund',
      accountId: id,
      amount: 250,
      paymentDate,
      method: PaymentMethod.Cash,
    }),
    services[1]!.financeWorkflow.allocateAccountBalance({ id: 'native-refund-alloc', accountId: id, allocation: { mode: 'fifo' } }),
  ])
  expect((await repos.studentYearAccounts.findById(id))?.availableBalance.amount).toBeGreaterThanOrEqual(0)
  const refund = await repos.payments.findById('native-refund')
  if (refund)
    expect(refund.kind).toBe(PaymentKind.Disbursement)
})

test('an outer transaction failure rolls back payment, entries, and audit together', async () => {
  await student('native-rollback')
  await catalog('native-rollback-cat', 1000, '2026-02-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-rollback-enr', studentId: 'native-rollback', catalogServiceId: 'native-rollback-cat' })
  const receiptsBefore = await nativeDb(handles[0]!.db).execute(sql.raw(`SELECT count(*)::int AS count FROM command_receipts WHERE request_id = 'native-rolled-back'`))
  const atomic = new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb)
  await expect(atomic.execute(async () => {
    await services[0]!.financeWorkflow.recordPayment({
      id: 'native-rolled-back',
      studentId: 'native-rollback',
      academicYearId: yearId,
      amount: 200,
      paymentDate,
      method: PaymentMethod.Cash,
      allocation: { mode: 'fifo' },
    })
    throw new Error('Simulated failure after finance writes')
  })).rejects.toThrow('Simulated failure')
  expect(await repos.payments.findById('native-rolled-back')).toBeUndefined()
  expect((await repos.studentCharges.findById('native-rollback-enr'))?.allocatedAmount.amount ?? 0).toBe(0)
  const receiptsAfter = await nativeDb(handles[0]!.db).execute(sql.raw(`SELECT count(*)::int AS count FROM command_receipts WHERE request_id = 'native-rolled-back'`))
  const auditAfter = await nativeDb(handles[0]!.db).execute(sql.raw(`SELECT count(*)::int AS count FROM command_audit WHERE resource_id = 'native-rolled-back'`))
  const outboxAfter = await nativeDb(handles[0]!.db).execute(sql.raw(`SELECT count(*)::int AS count FROM command_outbox WHERE resource_id = 'native-rolled-back'`))
  expect((receiptsAfter as { rows: Array<{ count: number }> }).rows).toEqual((receiptsBefore as { rows: Array<{ count: number }> }).rows)
  expect(Number((auditAfter as { rows: Array<{ count: number }> }).rows[0]?.count ?? 0)).toBe(0)
  expect(Number((outboxAfter as { rows: Array<{ count: number }> }).rows[0]?.count ?? 0)).toBe(0)
})

test('canonical 60k/40k/120k scenario and allocation reversal', async () => {
  await student('native-canonical')
  await catalog('native-60', 60_000, '2026-02-01')
  await catalog('native-40', 40_000, '2026-03-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-enr-60', studentId: 'native-canonical', catalogServiceId: 'native-60' })
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-enr-40', studentId: 'native-canonical', catalogServiceId: 'native-40' })
  await services[0]!.financeWorkflow.recordPayment({
    id: 'native-120',
    studentId: 'native-canonical',
    academicYearId: yearId,
    amount: 120_000,
    paymentDate,
    method: PaymentMethod.Cash,
    allocation: { mode: 'fifo' },
  })
  const id = accountId('native-canonical')
  expect((await repos.studentYearAccounts.findById(id))?.availableBalance.amount).toBe(20_000)
  expect((await repos.studentCharges.findById('native-enr-60'))?.status).toBe(ChargeStatus.Paid)
  expect((await repos.studentCharges.findById('native-enr-40'))?.status).toBe(ChargeStatus.Paid)
  const history = await services[0]!.financeWorkflow.getPaymentSettlementHistory({ accountId: id })
  const first = history.allocations.find(row => row.chargeId === 'native-enr-60' && row.kind === 'settle')
  expect(first).toBeDefined()
  await services[0]!.financeWorkflow.reverseAllocation({ allocationId: first!.id })
  expect((await repos.studentYearAccounts.findById(id))?.availableBalance.amount).toBe(80_000)
  expect((await repos.studentCharges.findById('native-enr-60'))?.allocatedAmount.amount).toBe(0)
  const recon = await services[0]!.financeWorkflow.reconcileStudentYearAccount({ accountId: id })
  expect(recon.balanced).toBe(true)
})

async function preservationDigest() {
  const [schools, students, staff, years, attachments] = await Promise.all([
    repos.schools.list(),
    repos.students.list(),
    repos.staffMembers.list(),
    repos.academicYears.list(),
    repos.attachments.list(),
  ])
  const payload = {
    schools: schools.map(row => ({ id: row.id, name: row.name })).sort((a, b) => a.id.localeCompare(b.id)),
    students: students.map(row => ({ id: row.id, lastName: row.lastName })).sort((a, b) => a.id.localeCompare(b.id)),
    staff: staff.map(row => ({ id: row.id, firstName: row.firstName })).sort((a, b) => a.id.localeCompare(b.id)),
    years: years.map(row => ({ id: row.id, name: row.name })).sort((a, b) => a.id.localeCompare(b.id)),
    attachments: attachments
      .filter(row => row.ownerKind !== AttachmentOwnerKind.Payment)
      .map(row => ({ id: row.id, ownerKind: row.ownerKind, ownerId: row.ownerId }))
      .sort((a, b) => a.id.localeCompare(b.id)),
  }
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex')
}

test('finance-only reset preserves non-finance records and drops payment attachments', async () => {
  await student('native-reset')
  await catalog('native-reset-cat', 500, '2026-02-01')
  await services[0]!.financeWorkflow.enrollStudentInService({ id: 'native-reset-enr', studentId: 'native-reset', catalogServiceId: 'native-reset-cat' })
  const payment = await services[0]!.financeWorkflow.recordPayment({
    id: 'native-reset-pay',
    studentId: 'native-reset',
    academicYearId: yearId,
    amount: 50,
    paymentDate,
    method: PaymentMethod.Cash,
    allocation: { mode: 'account_only' },
  })
  await repos.attachments.save(new Attachment({
    id: 'native-payment-attachment',
    schoolId: actor.schoolId,
    ownerKind: AttachmentOwnerKind.Payment,
    ownerId: payment.id,
    fileName: 'receipt.pdf',
    fileUrl: 'https://files.example.test/receipt.pdf',
  }))
  await repos.attachments.save(new Attachment({
    id: 'native-student-attachment',
    schoolId: actor.schoolId,
    ownerKind: AttachmentOwnerKind.Student,
    ownerId: 'native-reset',
    fileName: 'note.pdf',
    fileUrl: 'https://files.example.test/note.pdf',
  }))
  const before = await preservationDigest()
  await resetDisposableFinanceRecords(nativeDb(handles[0]!.db))
  expect(await repos.payments.findById('native-reset-pay')).toBeUndefined()
  expect(await repos.catalogServices.findById('native-reset-cat')).toBeUndefined()
  expect(await repos.attachments.findById('native-payment-attachment')).toBeUndefined()
  expect((await repos.attachments.findById('native-student-attachment'))?.fileName).toBe('note.pdf')
  expect((await repos.students.findById('native-reset'))?.lastName).toBe('native-reset')
  expect(await preservationDigest()).toBe(before)
})
