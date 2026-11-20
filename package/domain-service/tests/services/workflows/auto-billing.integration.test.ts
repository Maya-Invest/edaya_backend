import { ActorAssuranceLevel, createStaffActorMetadata } from '@edaya/authorization'
import { AcademicYear, autoBillingSchema, CatalogServiceStatus, ChargeStatus, ClassGroup, EnrollmentEndReason, GradeLevel, PaymentMethod, Permission, PlacementStatus, ServiceEnrollmentSource, StaffMember, StaffPermissionAssignment, Student, StudentAcademicYearProfile, StudentClassEnrollment, withShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { dispatchAutoBilling } from '../../../src/capabilities/finance/durable-auto-billing'
import { createTestApp } from '../../support/create-test-app'

async function fixture(count = 1) {
  const ctx = await createTestApp()
  const repos = ctx.schoolRepositories
  await repos.academicYears.save(new AcademicYear(withShortName({ id: 'year', schoolId: 'school', name: 'Year', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'), status: 'published' })))
  await repos.gradeLevels.save(new GradeLevel(withShortName({ id: 'grade', schoolId: 'school', name: 'Grade 6', shortName: 'G6', order: 1 })))
  await repos.gradeLevels.save(new GradeLevel(withShortName({ id: 'other-grade', schoolId: 'school', name: 'Grade 7', shortName: 'G7', order: 2 })))
  await repos.classGroups.save(new ClassGroup(withShortName({ id: 'class', schoolId: 'school', academicYearId: 'year', gradeLevelId: 'grade', name: '6A' })))
  await repos.placementStatuses.save(new PlacementStatus(withShortName({ id: 'status', schoolId: 'school', shortName: 'A', name: 'A' })))
  for (let i = 0; i < count; i++) {
    const id = `student-${String(i).padStart(3, '0')}`
    await repos.students.save(new Student({ id, schoolId: 'school', firstName: 'Student', lastName: String(i) }))
    await repos.enrollments.save(new StudentClassEnrollment({ id: `placement-${i}`, studentId: id, classGroupId: 'class', academicYearId: 'year', enrollmentIndex: 1 }))
  }
  const createFee = (autoBilling: Parameters<typeof ctx.app.financeWorkflow.createCatalogService>[0]['autoBilling'] = { mode: 'all' }, id = 'fee') => ctx.app.financeWorkflow.createCatalogService({
    id,
    academicYearId: 'year',
    name: 'Tuition',
    defaultPrice: 1001,
    currency: 'USD',
    status: CatalogServiceStatus.Active,
    autoBilling,
    billingTerms: { kind: 'one_time', installments: [{ label: 'First', percentage: 50 }, { label: 'Second', percentage: 50 }] },
  })
  return { ...ctx, repos, createFee, drain: () => dispatchAutoBilling(ctx.application) }
}

describe('automatic fee billing', () => {
  test('validates explicit all versus nonempty selections', () => {
    expect(autoBillingSchema.safeParse({ mode: 'matching', gradeLevelIds: [], placementStatusIds: null }).success).toBe(false)
    expect(autoBillingSchema.safeParse({ mode: 'matching', gradeLevelIds: null, placementStatusIds: null }).success).toBe(true)
  })

  test('bills active placements without profiles, snapshots terms, and never repeats assignments', async () => {
    const ctx = await fixture()
    await ctx.repos.students.save(new Student({ id: 'unplaced', schoolId: 'school', firstName: 'No', lastName: 'Class' }))
    await ctx.createFee()
    expect(await ctx.repos.studentCharges.count()).toBe(0)
    await ctx.drain()
    const [charge] = await ctx.repos.studentCharges.list()
    expect(charge?.expectedAmount.amount).toBe(1001)
    expect(charge?.installments.reduce((sum, row) => sum + row.expectedAmount, 0)).toBe(1001)
    const [assignment] = await ctx.repos.studentServiceEnrollments.list()
    expect(assignment?.source).toBe(ServiceEnrollmentSource.Automatic)
    expect(assignment?.automation?.configurationRevision).toHaveLength(64)
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'update', defaultPrice: 2000 })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    expect((await ctx.repos.studentCharges.findById(charge!.id))?.expectedAmount.amount).toBe(1001)
    expect((await ctx.app.financeWorkflow.getFeeAutoBilling({ catalogServiceId: 'fee' })).runs[0]?.status).toBe('completed')
  })

  test('requires both grade and status, then bills after profile change', async () => {
    const ctx = await fixture()
    await ctx.createFee({ mode: 'matching', gradeLevelIds: ['grade'], placementStatusIds: ['status'] })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(0)
    await ctx.app.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'student-000', academicYearId: 'year', placementStatusId: 'status' })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    await ctx.createFee({ mode: 'matching', gradeLevelIds: ['other-grade'], placementStatusIds: ['status'] }, 'other-fee')
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    const group = (await ctx.repos.classGroups.findById('class'))!
    await ctx.app.baseService.entities.classGroups.save(group.copyWith({ gradeLevelId: 'other-grade' }))
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(2)
  })

  test('off, draft and disabled queued fees create no charges', async () => {
    const ctx = await fixture()
    await ctx.createFee({ mode: 'off' })
    expect(await ctx.repos.autoBilling.listForFee('school', 'fee')).toHaveLength(0)
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'enable', autoBilling: { mode: 'all' } })
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'disable', autoBilling: { mode: 'off' } })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(0)
  })

  test('cancelled manual assignments are never resurrected', async () => {
    const ctx = await fixture()
    await ctx.createFee({ mode: 'off' })
    await ctx.app.financeWorkflow.enrollStudentInService({ id: 'manual', studentId: 'student-000', catalogServiceId: 'fee' })
    await ctx.app.financeWorkflow.cancelStudentCharge({ chargeId: 'manual', requestId: 'cancel', reason: 'Exempt' })
    await ctx.app.financeWorkflow.cancelServiceEnrollment({ enrollmentId: 'manual', reason: 'Exempt' })
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'enable', autoBilling: { mode: 'all' } })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    expect((await ctx.repos.studentCharges.findById('manual'))?.status).toBe(ChargeStatus.Cancelled)
  })

  test('run and outbox roll back with the triggering transaction', async () => {
    const ctx = await fixture()
    await expect(ctx.atomicExecution.execute(async () => {
      await ctx.createFee()
      throw new Error('abort')
    })).rejects.toThrow('abort')
    expect(await ctx.repos.catalogServices.count()).toBe(0)
    expect(await ctx.repos.autoBilling.listForFee('school', 'fee')).toHaveLength(0)
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(0)
  })

  test('checkpoints bounded batches and resumes after interruption', async () => {
    const ctx = await fixture(27)
    await ctx.createFee()
    await dispatchAutoBilling(ctx.application, { maxPages: 1 })
    expect(await ctx.repos.studentCharges.count()).toBe(25)
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(27)
    const [run] = await ctx.repos.autoBilling.listForFee('school', 'fee')
    expect(run?.createdCount).toBe(27)
    expect(run?.status).toBe('completed')
  })

  test('failed charge writes roll back the batch and retry exactly once', async () => {
    const ctx = await fixture()
    await ctx.createFee()
    ctx.failSaveOnAttempt('studentFeeRepository')
    await ctx.drain()
    expect(await ctx.repos.studentServiceEnrollments.count()).toBe(0)
    const [run] = await ctx.repos.autoBilling.listForFee('school', 'fee')
    expect(run?.status).toBe('failed')
    await ctx.app.financeWorkflow.retryAutoBilling({ runId: run!.id, requestId: 'retry' })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    expect((await ctx.repos.autoBilling.get('school', run!.id))?.createdCount).toBe(1)
  })
})

describe('automatic billing boundaries', () => {
  test('enrolment creation and transfers apply the final placement, while closure preserves charges', async () => {
    const ctx = await fixture(0)
    await ctx.createFee({ mode: 'matching', gradeLevelIds: ['grade'], placementStatusIds: null })
    await ctx.createFee({ mode: 'matching', gradeLevelIds: ['other-grade'], placementStatusIds: null }, 'next-fee')
    await ctx.repos.classGroups.save(new ClassGroup(withShortName({ id: 'next-class', schoolId: 'school', academicYearId: 'year', gradeLevelId: 'other-grade', name: '7A' })))
    await ctx.repos.students.save(new Student({ id: 'student', schoolId: 'school', firstName: 'New', lastName: 'Student' }))
    await ctx.app.studentWorkflow.enrollStudent({ id: 'new-placement', studentId: 'student', classGroupId: 'class', enrolledAt: new Date('2026-01-01') })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    await ctx.app.studentWorkflow.transferStudent({ enrollmentId: 'new-placement', nextEnrollmentId: 'next-placement', nextClassGroupId: 'next-class', effectiveAt: new Date('2026-02-01') })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(2)
    await ctx.app.studentWorkflow.closeEnrollment({ enrollmentId: 'next-placement', endReason: EnrollmentEndReason.Withdrawn, endedAt: new Date('2026-03-01') })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(2)
  })

  test('manual assignment racing the worker has only one financial effect', async () => {
    const ctx = await fixture()
    await ctx.createFee()
    await Promise.allSettled([
      ctx.app.financeWorkflow.enrollStudentInService({ id: 'manual-race', studentId: 'student-000', catalogServiceId: 'fee' }),
      ctx.drain(),
    ])
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    expect(await ctx.repos.studentServiceEnrollments.count()).toBe(1)
  })

  test('fee changes between batches use current rules and preserve the earlier batch', async () => {
    const ctx = await fixture(27)
    await ctx.createFee()
    await dispatchAutoBilling(ctx.application, { maxPages: 1 })
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'stop', autoBilling: { mode: 'off' } })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(25)
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'resume', autoBilling: { mode: 'all' }, defaultPrice: 2000 })
    await ctx.drain()
    const charges = await ctx.repos.studentCharges.list()
    expect(charges.filter(charge => charge.expectedAmount.amount === 1001)).toHaveLength(25)
    expect(charges.filter(charge => charge.expectedAmount.amount === 2000)).toHaveLength(2)
  })

  test('drafts wait for activation and foreign grade references are rejected', async () => {
    const ctx = await fixture()
    await ctx.app.financeWorkflow.createCatalogService({ id: 'draft', academicYearId: 'year', name: 'Draft', defaultPrice: 500, currency: 'USD', autoBilling: { mode: 'all' }, billingTerms: { kind: 'one_time', installments: [] } })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(0)
    await ctx.app.financeWorkflow.activateCatalogService({ id: 'draft', requestId: 'activate' })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    await ctx.repos.gradeLevels.save(new GradeLevel(withShortName({ id: 'foreign', schoolId: 'other-school', name: 'Foreign', shortName: 'F', order: 1 })))
    await expect(ctx.createFee({ mode: 'matching', gradeLevelIds: ['foreign'], placementStatusIds: null })).rejects.toMatchObject({ code: 'AUTO_BILLING_GRADE_INVALID' })
  })

  test('catalog management alone cannot enable billing; academic staff can trigger an authorised policy', async () => {
    const ctx = await fixture()
    await ctx.createFee({ mode: 'off' })
    await ctx.repos.staffMembers.save(new StaffMember({ id: 'staff', schoolId: 'school', subjectId: 'staff-user', firstName: 'Staff', lastName: 'Member' }))
    for (const permission of [Permission.FINANCIAL_CONFIG_READ, Permission.FINANCIAL_CATALOG_MANAGE, Permission.STUDENT_MANAGE])
      await ctx.repos.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: `grant-${permission}`, staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission, scopes: permission === Permission.STUDENT_MANAGE ? [{ kind: 'student', studentId: 'student-000' }] : [{ kind: 'school' }] }))
    const staff = ctx.forActor(createStaffActorMetadata({ schoolId: 'school', subjectId: 'staff-user', staffMemberId: 'staff', requestId: 'test', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }))
    expect((await staff.financeWorkflow.getAutoBillingOptions()).canConfigureAutomatic).toBe(false)
    await expect(staff.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'forbidden', autoBilling: { mode: 'all' } })).rejects.toMatchObject({ code: 'forbidden' })
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'enabled', autoBilling: { mode: 'matching', gradeLevelIds: null, placementStatusIds: ['status'] } })
    await ctx.drain()
    await staff.academicsWorkflow.upsertStudentAcademicYearProfile({ studentId: 'student-000', academicYearId: 'year', placementStatusId: 'status' })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(1)
    const [run] = await ctx.repos.autoBilling.listForFee('school', 'fee')
    await expect(staff.financeWorkflow.retryAutoBilling({ runId: run!.id, requestId: 'no-retry' })).rejects.toMatchObject({ code: 'forbidden' })
    await ctx.repos.staffPermissionAssignments.save(new StaffPermissionAssignment({ id: 'payment-grant', staffId: 'staff', schoolId: 'school', academicYearId: 'year', permission: Permission.PAYMENT_RECORD, scopes: [{ kind: 'all', grain: 'student' }] }))
    expect((await staff.financeWorkflow.getAutoBillingOptions()).canConfigureAutomatic).toBe(true)
    await staff.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'authorised', autoBilling: { mode: 'all' } })
  })
})

describe('automatic billing reconciliation coverage', () => {
  test('preserves paid, waived, and adjusted assignments on every repeat', async () => {
    const ctx = await fixture(3)
    await ctx.createFee({ mode: 'off' })
    for (let i = 0; i < 3; i++)
      await ctx.app.financeWorkflow.enrollStudentInService({ id: `manual-${i}`, studentId: `student-00${i}`, catalogServiceId: 'fee' })
    await ctx.app.financeWorkflow.recordPayment({ id: 'paid', studentId: 'student-000', academicYearId: 'year', amount: 1001, paymentDate: new Date(), method: PaymentMethod.Cash, allocation: { mode: 'targeted', targets: [{ chargeId: 'manual-0', amount: 1001 }] } })
    await ctx.app.financeWorkflow.waiveStudentCharge({ requestId: 'waive', chargeId: 'manual-1', reason: 'Scholarship' })
    await ctx.app.financeWorkflow.adjustStudentCharge({ requestId: 'adjust', chargeId: 'manual-2', adjustmentAmount: 100, reason: 'Correction' })
    const before = (await ctx.repos.studentCharges.list()).map(charge => charge.data)
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'enable-protected', autoBilling: { mode: 'all' }, defaultPrice: 4000 })
    await Promise.all([ctx.drain(), ctx.drain()])
    expect((await ctx.repos.studentCharges.list()).map(charge => charge.data)).toEqual(before)
    expect(await ctx.repos.studentServiceEnrollments.count()).toBe(3)
  })

  test('batch profile writes combine filters without accepting another year or school', async () => {
    const ctx = await fixture(2)
    await ctx.repos.academicYears.save(new AcademicYear(withShortName({ id: 'other-year', schoolId: 'school', name: 'Other year', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31') })))
    await ctx.repos.studentAcademicYearProfiles.save(new StudentAcademicYearProfile({ id: 'wrong-year-profile', schoolId: 'school', studentId: 'student-000', academicYearId: 'other-year', placementStatusId: 'status' }))
    await ctx.repos.students.save(new Student({ id: 'foreign-student', schoolId: 'foreign-school', firstName: 'Foreign', lastName: 'Student' }))
    await ctx.repos.classGroups.save(new ClassGroup(withShortName({ id: 'foreign-class', schoolId: 'foreign-school', academicYearId: 'year', gradeLevelId: 'grade', name: 'Foreign' })))
    await ctx.repos.enrollments.save(new StudentClassEnrollment({ id: 'foreign-placement', studentId: 'foreign-student', classGroupId: 'foreign-class', academicYearId: 'year', enrollmentIndex: 1 }))
    await ctx.createFee({ mode: 'matching', gradeLevelIds: ['grade', 'other-grade'], placementStatusIds: ['status'] })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(0)
    await ctx.app.baseService.entities.studentAcademicYearProfiles.batchSave([0, 1].map(i => new StudentAcademicYearProfile({ id: `profile-${i}`, schoolId: 'school', studentId: `student-00${i}`, academicYearId: 'year', placementStatusId: 'status' })))
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(2)
    await ctx.app.financeWorkflow.updateCatalogService({ id: 'fee', requestId: 'all-isolation', autoBilling: { mode: 'all' } })
    await ctx.drain()
    expect(await ctx.repos.studentCharges.count()).toBe(2)
  })
})
