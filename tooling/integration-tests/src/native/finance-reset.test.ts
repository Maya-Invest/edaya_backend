import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { SqlExecutor } from '../../../db-migrate/scripts/lib/reset-finance-tables'
import { PostgresAtomicExecution, PostgresCommandJournal, PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, Attachment, AttachmentOwnerKind, CatalogServiceStatus, Guardian, noOpFileStorage, noOpNotificationGateway, PaymentMethod, School, StaffMember, Student } from '@edaya/core'
import { SchoolApplication } from '@edaya/service'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'
import { assertLoopbackNativeFinanceResetUrl } from '../../../db-migrate/scripts/lib/assert-finance-reset-target'
import { captureFinancePreservationDigest, FINANCE_RESET_TABLES, resetFinanceTables } from '../../../db-migrate/scripts/lib/reset-finance-tables'

const url = assertLoopbackNativeFinanceResetUrl(process.env.EDAYA_NATIVE_TEST_URL ?? '')

const handle = await createPostgresSchoolDatabase(url, { max: 2 })
const db = handle.db as SqlExecutor & PostgresTransactionalDb
const repos = new PostgresSchoolRepositories(handle.db)
const actor = createStaffActorMetadata({
  schoolId: 'finance-reset-school',
  staffMemberId: 'finance-reset-owner',
  subjectId: 'finance-reset-person',
  requestId: 'native-finance-reset',
  authenticatedAt: new Date(),
  assuranceLevel: ActorAssuranceLevel.Strong,
})
const app = new SchoolApplication({
  repositories: repos,
  atomicExecution: new PostgresAtomicExecution(db),
  commandJournal: new PostgresCommandJournal(),
  notificationGateway: noOpNotificationGateway,
  fileStorage: noOpFileStorage,
}).forActor(actor)
async function query(statement: string) {
  const result = await db.execute(sql.raw(statement))
  if (Array.isArray(result))
    return { rows: result as Array<Record<string, unknown>> }
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return { rows: result.rows as Array<Record<string, unknown>> }
  return { rows: [] as Array<Record<string, unknown>> }
}

beforeAll(async () => {
  await repos.init({ driver: 'node-postgres' })
}, 30000)

afterAll(async () => {
  await handle.dispose()
})

test('finance-only reset preserves identity, school, academic and journal rows', async () => {
  await repos.schools.save(new School({
    id: actor.schoolId,
    name: 'Reset school',
    timeZone: 'UTC',
    ownerSubjectId: actor.subjectId,
  }))
  await repos.staffMembers.save(new StaffMember({
    id: actor.staffMemberId,
    schoolId: actor.schoolId,
    subjectId: actor.subjectId,
    firstName: 'Reset',
    lastName: 'Owner',
  }))
  await repos.academicYears.save(new AcademicYear({
    id: 'reset-year',
    schoolId: actor.schoolId,
    name: '2026',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-12-31'),
  }))
  await repos.students.save(new Student({
    id: 'reset-student',
    schoolId: actor.schoolId,
    firstName: 'Kept',
    lastName: 'Student',
  }))
  await repos.guardians.save(new Guardian({
    id: 'reset-guardian',
    schoolId: actor.schoolId,
    firstName: 'Kept',
    lastName: 'Guardian',
  }))
  await repos.attachments.save(new Attachment({
    id: 'att-student-kept',
    schoolId: actor.schoolId,
    ownerKind: AttachmentOwnerKind.Student,
    ownerId: 'reset-student',
    fileName: 'portrait.jpg',
    fileUrl: 'https://files.example.test/portrait.jpg',
  }))
  await app.financeWorkflow.createCatalogService({
    id: 'reset-catalog',
    academicYearId: 'reset-year',
    name: 'Disposable tuition',
    defaultPrice: 60000,
    currency: 'USD',
    billingTerms: { kind: 'one_time', installments: [] },
    status: CatalogServiceStatus.Active,
  })
  await app.financeWorkflow.enrollStudentInService({
    id: 'reset-enr',
    studentId: 'reset-student',
    catalogServiceId: 'reset-catalog',
  })
  await app.financeWorkflow.recordPayment({
    id: 'reset-pay',
    studentId: 'reset-student',
    academicYearId: 'reset-year',
    amount: 120000,
    paymentDate: new Date('2026-04-01'),
    method: PaymentMethod.Cash,
    allocation: { mode: 'fifo' },
  })
  await repos.attachments.save(new Attachment({
    id: 'att-pay-reset',
    schoolId: actor.schoolId,
    ownerKind: AttachmentOwnerKind.Payment,
    ownerId: 'reset-pay',
    fileName: 'receipt.pdf',
    fileUrl: 'https://files.example.test/receipt.pdf',
  }))
  await db.execute(sql.raw(`
    INSERT INTO attachment_uploads (attachment_id, school_id, caller_id, attachment, expires_at)
    VALUES (
      'pending-pay-reset',
      '${actor.schoolId}',
      'identity:finance-reset-person',
      '{"id":"pending-pay-reset","schoolId":"${actor.schoolId}","ownerKind":"payment","ownerId":"reset-pay","fileName":"pending.pdf","storageKey":"pending-pay-reset","status":"pending_upload","purpose":"general"}'::jsonb,
      clock_timestamp() + INTERVAL '1 hour'
    )
  `))

  const before = await captureFinancePreservationDigest(db, actor.schoolId)
  expect((await repos.payments.findById('reset-pay'))?.id).toBe('reset-pay')
  expect((await repos.attachments.findById('att-pay-reset'))?.id).toBe('att-pay-reset')

  await resetFinanceTables(db, actor.schoolId)
  const after = await captureFinancePreservationDigest(db, actor.schoolId)

  expect(after.identity).toBe(before.identity)
  expect(after.content).toBe(before.content)
  expect(await repos.catalogServices.findById('reset-catalog')).toBeUndefined()
  expect(await repos.studentServiceEnrollments.findById('reset-enr')).toBeUndefined()
  expect(await repos.studentCharges.findById('reset-enr')).toBeUndefined()
  expect(await repos.payments.findById('reset-pay')).toBeUndefined()
  expect(await repos.attachments.findById('att-pay-reset')).toBeUndefined()
  expect((await repos.schools.findById(actor.schoolId))?.name).toBe('Reset school')
  expect((await repos.students.findById('reset-student'))?.lastName).toBe('Student')
  expect((await repos.guardians.findById('reset-guardian'))?.lastName).toBe('Guardian')
  expect((await repos.academicYears.findById('reset-year'))?.name).toBe('2026')
  expect((await repos.attachments.findById('att-student-kept'))?.fileName).toBe('portrait.jpg')
  expect(Number((await query(`SELECT count(*)::int AS count FROM command_receipts WHERE school_id = '${actor.schoolId}'`)).rows[0]?.count)).toBeGreaterThan(0)
  expect(Number((await query(`SELECT count(*)::int AS count FROM attachment_uploads WHERE attachment_id = 'pending-pay-reset'`)).rows[0]?.count)).toBe(0)
  for (const table of FINANCE_RESET_TABLES) {
    const count = Number((await query(`SELECT count(*)::int AS count FROM ${table} WHERE school_id = '${actor.schoolId}'`)).rows[0]?.count)
    expect(count).toBe(0)
  }
})
