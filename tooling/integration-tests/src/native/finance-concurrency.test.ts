import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import { PostgresAtomicExecution, PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { createRepositoryAuthorizationPolicy, createSystemActorMetadata } from '@edaya/authorization'
import { AcademicYear, Fee, FeeStatus, noOpFileStorage, noOpNotificationGateway, PaymentMethod, School, Student, StudentFee } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Run with bun run test:integration:native against the disposable loopback cluster')

// Independent pools prove serialization across runtime instances, not just a
// single-connection pool accidentally running requests one at a time.
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const repositories = handles.map(handle => new PostgresSchoolRepositories(handle.db))
const actor = createSystemActorMetadata({ schoolId: 'finance-school', systemId: 'native-fixture', requestId: 'native-test', reason: 'Synthetic concurrency verification' })
const services = handles.map((handle, index) => {
  const repos = repositories[index]!
  return new SchoolApplication({
    repositories: repos,
    atomicExecution: new PostgresAtomicExecution(handle.db as PostgresTransactionalDb),
    notificationGateway: noOpNotificationGateway,
    fileStorage: noOpFileStorage,
    authorizationPolicy: createRepositoryAuthorizationPolicy({
      repositories: repos,
      staffAssignmentRepository: repos.staffAssignments,
      staffMemberRepository: repos.staffMembers,
      guardianRepository: repos.guardians,
      guardianStudentLinkRepository: repos.guardianLinks,
      studentRepository: repos.students,
    }),
  }).forActor(actor)
})
const repos = repositories[0]!
const paymentDate = new Date('2026-09-08T00:00:00Z')

beforeAll(async () => {
  await repos.init({ driver: 'node-postgres' })
  await repos.schools.save(new School({ id: actor.schoolId, name: 'Synthetic finance school', timeZone: 'UTC' }))
  await repos.academicYears.save(new AcademicYear({ id: 'finance-year', schoolId: actor.schoolId, name: '2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31') }))
  await repos.students.save(new Student({ id: 'finance-student', schoolId: actor.schoolId, firstName: 'Synthetic', lastName: 'Student' }))
  await repos.fees.save(new Fee({ id: 'finance-fee', schoolId: actor.schoolId, academicYearId: 'finance-year', name: 'Synthetic fee', defaultAmount: 1000, currency: 'USD' }))
}, 30000)
afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

async function fee(id: string) {
  await repos.studentFees.save(new StudentFee({ id, studentId: 'finance-student', feeId: 'finance-fee', academicYearId: 'finance-year', expectedAmount: 1000, currency: 'USD', status: FeeStatus.Pending }))
}

test('concurrent identical payment commands credit the balance once', async () => {
  await fee('native-same')
  const input = { id: 'native-payment-same', studentFeeId: 'native-same', amount: 400, paymentDate, method: PaymentMethod.Cash }
  await Promise.all(services.map(service => service.financeWorkflow.recordPayment(input)))
  expect((await repos.studentFees.findById('native-same'))?.paidAmount.amount).toBe(400)
  expect(await repos.payments.count({ id: input.id })).toBe(1)
  await expect(services[0]!.financeWorkflow.recordPayment({ ...input, amount: 401 })).rejects.toMatchObject({ code: 'PAYMENT_REPLAY_CONFLICT' })
})

test('concurrent distinct payments and repeated reversals preserve totals', async () => {
  await fee('native-distinct')
  await Promise.all(services.map((service, index) => service.financeWorkflow.recordPayment({
    id: `native-payment-${index}`,
    studentFeeId: 'native-distinct',
    amount: 200,
    paymentDate,
    method: PaymentMethod.Cash,
  })))
  expect((await repos.studentFees.findById('native-distinct'))?.paidAmount.amount).toBe(400)
  await Promise.all(services.map(service => service.financeWorkflow.reversePayment({ paymentId: 'native-payment-0' })))
  expect((await repos.studentFees.findById('native-distinct'))?.paidAmount.amount).toBe(200)
})

test('an outer transaction failure rolls back payment and balance together', async () => {
  await fee('native-rollback')
  const atomic = new PostgresAtomicExecution(handles[0]!.db as PostgresTransactionalDb)
  await expect(atomic.execute(async () => {
    await services[0]!.financeWorkflow.recordPayment({ id: 'native-rolled-back', studentFeeId: 'native-rollback', amount: 200, paymentDate, method: PaymentMethod.Cash })
    throw new Error('Simulated failure after finance writes')
  })).rejects.toThrow('Simulated failure')
  expect(await repos.payments.findById('native-rolled-back')).toBeUndefined()
  expect((await repos.studentFees.findById('native-rollback'))?.paidAmount.amount).toBe(0)
})
