import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import { AccessPolicies, ActorAssuranceLevel, AuthorizationError, createGuardianActorMetadata, createPlatformActorMetadata, createPlatformUser, createS2sActorMetadata, createS2sClient, createStaffActorMetadata, createStudentActorMetadata, createSystemActorMetadata, createTeacherActorMetadata, PlatformPolicies } from '@edaya/authorization'
import { AccountInvitation, AccountInvitationContactChannel, AccountInvitationKind, AccountInvitationStatus, Assessment, AssessmentResult, Attachment, AttachmentOwnerKind, AttendanceJustificationStatus, AttendanceRecord, AttendanceStatus, CatalogService, CatalogServiceCategory, CatalogServiceStatus, ChargeStatus, ClassSubject, ClassSubjectMatter, ClassSubjectMatterStatus, ClassSubjectProgress, GradeLevelSubject, LessonSession, noOpNotificationGateway, Payment, PaymentKind, PaymentMethod, PaymentStatus, Permission, PlatformUser, S2sClient, StaffMember, StaffPermissionAssignment, Student, StudentCharge, StudentServiceEnrollment, StudentStatus, StudentYearAccount, studentYearAccountId, SubjectMatter, Teacher } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { drizzle } from 'drizzle-orm/pglite'
import { hashInvitationToken } from '../../domain-service/src/capabilities/invitations/invitation-token'
import { PostgresAtomicExecution } from '../src/lib/transaction'
import { PostgresSchoolRepositories } from '../src/postgres-school-repositories'
import { PostgresCommandJournal } from '../src/stores/command-journal-store'
import { seedAuthorizationPlacement, seedAuthorizationRelationships } from './support/authorization-database'

describe('authorization policies against native repository scopes', () => {
  let db: PGlite
  let repositories: PostgresSchoolRepositories
  const staff = createStaffActorMetadata({ schoolId: 'school-a', staffMemberId: 'staff-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'request', assuranceLevel: ActorAssuranceLevel.Verified })
  const teacher = createTeacherActorMetadata({ schoolId: 'school-a', teacherId: 'teacher-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'request' })
  const guardian = createGuardianActorMetadata({ schoolId: 'school-a', guardianId: 'guardian-a', subjectId: 'person-a', authenticatedAt: new Date(), requestId: 'request' })
  beforeEach(async () => {
    db = new PGlite()
    repositories = new PostgresSchoolRepositories(drizzle(db))
    await repositories.init({ driver: 'pglite' })
    await seedAuthorizationPlacement(db)
    await seedAuthorizationRelationships(db)
  })
  afterEach(async () => {
    await db.close()
  })

  function schoolService(actor: SchoolScopedActorMetadata = staff) {
    const unexpected = async (): Promise<never> => {
      throw new Error('Unexpected external effect')
    }
    return new SchoolService({
      actor,
      repositories,
      atomicExecution: new PostgresAtomicExecution(drizzle(db)),
      commandJournal: new PostgresCommandJournal(),
      notificationGateway: noOpNotificationGateway,
      fileStorage: { putObject: unexpected, deleteObject: unexpected, headObject: unexpected, readObject: unexpected, createPresignedUpload: unexpected, createPresignedDownload: unexpected },
      accountInvitationsEnabled: false,
    })
  }

  async function addGrant(permission: Permission, classGroupId = 'class-a', extra: Partial<ConstructorParameters<typeof StaffPermissionAssignment>[0]> = {}) {
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: `${permission}-${classGroupId}`,
      schoolId: 'school-a',
      staffId: 'staff-a',
      academicYearId: 'year-a',
      permission,
      scopes: [{ kind: 'class_group', classGroupId }],
      ...extra,
    }))
  }

  test('read, single, count and pagination have identical tenant and class boundaries', async () => {
    await addGrant(Permission.GRADE_READ)
    const access = new AccessPolicies(staff, repositories)
    const results = repositories.assessmentResults.forAccess(await access.grades.readScope())
    expect((await results.list()).map(row => row.id)).toEqual(['1-math', '2-french'])
    expect(await results.count()).toBe(2)
    expect(await results.findById('3-other')).toBeUndefined()
    expect(await results.findById('4-foreign')).toBeUndefined()
    expect((await results.list({ $offset: 1, $limit: 1 })).map(row => row.id)).toEqual(['2-french'])
    expect(await results.list({ $offset: 2, $limit: 1 })).toEqual([])
  })

  test('a read grant never contributes placement to a write grant', async () => {
    await addGrant(Permission.GRADE_READ, 'class-other')
    await addGrant(Permission.GRADE_INPUT)
    const access = new AccessPolicies(staff, repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'assessment-other', studentId: 'student-other' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-other' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-b', studentId: 'student-b' })).rejects.toThrow()
  })

  test('subject teachers cannot read or input another subject for their own student', async () => {
    const access = new AccessPolicies(teacher, repositories)
    const resultRepo = repositories.assessmentResults.forAccess(await access.grades.readScope())
    expect((await resultRepo.list()).map(row => row.id)).toEqual(['1-math'])
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'assessment-french', studentId: 'student-a' })).rejects.toThrow()
    await expect(access.grades.assertInput({ assessmentId: 'assessment-other', studentId: 'student-other' })).rejects.toThrow()
  })

  test('homeroom access admits class grade reads but not subject grade input', async () => {
    await db.exec('DELETE FROM teacher_assignments; INSERT INTO teacher_assignments (id, teacher_id, academic_year_id, kind, class_group_id, status, created_at) VALUES (\'homeroom\', \'teacher-a\', \'year-a\', \'homeroom\', \'class-a\', \'active\', now())')
    const access = new AccessPolicies(teacher, repositories)
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(2)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
  })

  test('uses current facts after expiration, relationship removal and selected-year changes', async () => {
    await addGrant(Permission.GRADE_INPUT, 'class-a', { endsAt: new Date('2000-01-01') })
    const access = new AccessPolicies(staff, repositories)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    const teacherAccess = new AccessPolicies(teacher, repositories)
    await teacherAccess.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await db.exec('DELETE FROM teacher_assignments WHERE id = \'teaching\'')
    await expect(teacherAccess.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    const oldYear = new AccessPolicies({ ...staff, academicYearId: 'year-old' }, repositories)
    await expect(oldYear.grades.readScope()).rejects.toThrow()
  })

  test('assignments confer authority directly and removal takes effect without grant synchronization', async () => {
    await db.exec(`INSERT INTO staff_assignments (id, staff_id, academic_year_id, role, permissions, class_group_id, created_at)
      VALUES ('assignment', 'staff-a', 'year-a', 'Supervisor', '["GRADE_INPUT"]', 'class-a', now())`)
    const access = new AccessPolicies(staff, repositories)
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    expect(await repositories.staffPermissionAssignments.count()).toBe(0)
    await db.exec('DELETE FROM staff_assignments WHERE id = \'assignment\'')
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
  })

  test('selected guardian profile never inherits the same person’s staff or teaching grants', async () => {
    await addGrant(Permission.GRADE_INPUT)
    await db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const access = new AccessPolicies(guardian, repositories)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    expect((await repositories.assessmentResults.forAccess(await access.grades.readScope()).list()).map(row => row.id).sort()).toEqual(['1-math', '2-french'])
  })

  test('updates check both old and proposed placement, including every student', async () => {
    await addGrant(Permission.GRADE_INPUT)
    const access = new AccessPolicies(staff, repositories)
    const old = (await repositories.assessmentResults.findById('3-other'))!
    const moved = new AssessmentResult({ ...old.data, assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.assertSave(Permission.GRADE_INPUT, 'assessmentResults', moved, old)).rejects.toThrow()
    const local = (await repositories.assessmentResults.findById('1-math'))!
    const foreignStudent = new AssessmentResult({ ...local.data, studentId: 'student-b' })
    await expect(access.assertSave(Permission.GRADE_INPUT, 'assessmentResults', foreignStudent, local)).rejects.toThrow()
    const updated = new AssessmentResult({ ...local.data, score: 18 })
    const scope = await access.assertSave(Permission.GRADE_INPUT, 'assessmentResults', updated, local)
    await repositories.assessmentResults.forAccess(scope).save(updated)
    expect((await repositories.assessmentResults.findById(local.id))?.score).toBe(18)
  })

  test('owners retain tenant boundaries and unknown job identities receive no authority', async () => {
    await db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const access = new AccessPolicies(staff, repositories)
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(3)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-b', studentId: 'student-b' })).rejects.toThrow()
    const job = createSystemActorMetadata({ schoolId: 'school-a', systemId: 'unknown', requestId: 'job', reason: 'test' })
    await expect(new AccessPolicies(job, repositories).grades.readScope()).rejects.toThrow()
  })
  test('S2S access classes use live facts, school boundaries and canonical actions', async () => {
    const client = new S2sClient({ id: 'client', schoolId: 'school-a', clientId: 'integration', accessClass: 'read', keyPrefix: 's2s', keyHash: 'hash', createdBySubjectId: 'operator' })
    await repositories.s2sClients.save(client)
    const actor = createS2sActorMetadata({ actorId: client.id, schoolId: client.schoolId, clientId: client.clientId, requestId: 'test' })
    expect('accessClass' in actor).toBe(false)
    const access = new AccessPolicies(actor, repositories)
    expect(await repositories.assessmentResults.forAccess(await access.grades.readScope()).count()).toBe(3)
    await expect(access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })).rejects.toThrow()
    await repositories.s2sClients.save(new S2sClient({ ...client.data, accessClass: 'write' }))
    await access.grades.assertInput({ assessmentId: 'assessment-math', studentId: 'student-a' })
    await expect(access.grades.assertInput({ assessmentId: 'assessment-b', studentId: 'student-b' })).rejects.toThrow()
    for (const action of [Permission.ACCESS_CONTROL_ASSIGN, Permission.SERVICE_ACCOUNT_CREATE, Permission.PLATFORM_USER_CREATE, Permission.S2S_CLIENT_CREATE]) {
      await expect(access.assertSchool(action)).rejects.toThrow()
    }
    await repositories.s2sClients.save(new S2sClient({ ...client.data, revokedAt: new Date() }))
    await expect(access.grades.readScope()).rejects.toThrow()
  })

  test('platform grants are live, profile-isolated and bounded when delegated', async () => {
    const user = new PlatformUser({ id: 'operator', subjectId: 'person-a', email: 'operator@example.com', isActive: true, createdBySubjectId: 'bootstrap', permissions: [Permission.PLATFORM_USER_READ, Permission.PLATFORM_USER_CREATE, Permission.S2S_CLIENT_CREATE] })
    await repositories.platformUsers.save(user)
    const actor = createPlatformActorMetadata({ actorId: user.id, subjectId: user.subjectId, email: user.email, authenticatedAt: new Date(), requestId: 'test' })
    expect('permissions' in actor).toBe(false)
    const policies = new PlatformPolicies(actor, repositories.platformUsers)
    await policies.readUsers()
    await expect(new PlatformPolicies(staff, repositories.platformUsers).readUsers()).rejects.toThrow()
    await db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    await expect(new AccessPolicies(staff, repositories).assertSchool(Permission.PLATFORM_USER_READ)).rejects.toThrow()
    const atomic = new PostgresAtomicExecution(drizzle(db))
    await expect(createPlatformUser(repositories.platformUsers, actor, {
      subjectId: 'new-operator',
      email: 'new@example.com',
      permissions: [Permission.S2S_CLIENT_REVOKE],
    }, atomic)).rejects.toThrow()
    expect(await repositories.platformUsers.count()).toBe(1)
    await expect(createS2sClient(repositories, actor, { schoolId: 'missing-school', clientId: 'missing', accessClass: 'read' }, atomic)).rejects.toThrow()
    expect(await repositories.s2sClients.count()).toBe(0)
    const created = await createS2sClient(repositories, actor, { schoolId: 'school-a', clientId: 'valid', accessClass: 'read' }, atomic)
    expect(created.client.schoolId).toBe('school-a')
    await repositories.platformUsers.save(new PlatformUser({ ...user.data, permissions: [Permission.PLATFORM_USER_CREATE] }))
    await expect(policies.readUsers()).rejects.toThrow()
    await repositories.platformUsers.save(new PlatformUser({ ...user.data, isActive: false }))
    await expect(policies.createUser()).rejects.toThrow()
  })

  test('grade creation and editing bind separate actions, including managed writes', async () => {
    await addGrant(Permission.GRADE_UPDATE)
    const service = schoolService()
    const before = (await repositories.assessmentResults.findById('1-math'))!
    await service.baseService.entities.assessmentResults.save(new AssessmentResult({ ...before.data, score: 17 }))
    expect((await repositories.assessmentResults.findById(before.id))?.score).toBe(17)
    await expect(service.baseService.entities.assessmentResults.save(new AssessmentResult({ ...before.data, id: 'new-result' }))).rejects.toThrow()
    await expect(service.baseService.access.grades.assertInput(before)).rejects.toThrow()
    await service.baseService.access.grades.assertUpdate(before)
    await repositories.staffPermissionAssignments.delete(`${Permission.GRADE_UPDATE}-class-a`)
    await addGrant(Permission.GRADE_INPUT)
    await expect(service.baseService.entities.assessmentResults.save(new AssessmentResult({ ...before.data, score: 18 }))).rejects.toThrow()
    expect((await repositories.assessmentResults.findById(before.id))?.score).toBe(17)
  })

  test('alternative actions cannot combine authority across old and proposed placement or batch targets', async () => {
    await addGrant(Permission.GRADE_INPUT, 'class-a')
    await addGrant(Permission.GRADE_UPDATE, 'class-other')
    const access = new AccessPolicies(staff, repositories)
    const before = (await repositories.assessmentResults.findById('1-math'))!
    const moved = new AssessmentResult({ ...before.data, assessmentId: 'assessment-other', studentId: 'student-other' })
    await expect(access.assertSave([Permission.GRADE_INPUT, Permission.GRADE_UPDATE], 'assessmentResults', moved, before)).rejects.toThrow()
    await expect(access.assertResources([Permission.GRADE_INPUT, Permission.GRADE_UPDATE], 'assessmentResults', ['1-math', '3-other'])).rejects.toThrow()
  })

  test('a mixed-class batch fails without persisting its allowed first row', async () => {
    await addGrant(Permission.GRADE_UPDATE)
    const local = (await repositories.assessmentResults.findById('1-math'))!
    const unrelated = (await repositories.assessmentResults.findById('3-other'))!
    await expect(schoolService().baseService.entities.assessmentResults.batchSave([
      new AssessmentResult({ ...local.data, score: 19 }),
      new AssessmentResult({ ...unrelated.data, score: 19 }),
    ])).rejects.toThrow()
    expect((await repositories.assessmentResults.findById(local.id))?.score).toBe(10)
    expect((await repositories.assessmentResults.findById(unrelated.id))?.score).toBe(14)
  })

  test('scoped overdue counts use the same student and tenant predicates as lists', async () => {
    await repositories.catalogServices.save(new CatalogService({
      id: 'overdue-catalog',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      name: 'Tuition',
      defaultPrice: 100,
      currency: 'USD',
      billingTerms: { kind: 'one_time', installments: [] },
      status: CatalogServiceStatus.Active,
    }))
    for (const studentId of ['student-a', 'student-other', 'student-b']) {
      const schoolId = studentId === 'student-b' ? 'school-b' : 'school-a'
      const academicYearId = studentId === 'student-b' ? 'year-b' : 'year-a'
      if (studentId !== 'student-b') {
        await repositories.studentServiceEnrollments.save(new StudentServiceEnrollment({
          id: `charge-${studentId}`,
          schoolId,
          studentId,
          catalogServiceId: 'overdue-catalog',
          academicYearId,
          acceptedTerms: {
            catalogServiceId: 'overdue-catalog',
            name: 'Tuition',
            category: CatalogServiceCategory.Tuition,
            currency: 'USD',
            price: 100,
            billingKind: 'one_time',
            billingTerms: { kind: 'one_time', installments: [] },
          },
        }))
      }
      await repositories.studentCharges.save(new StudentCharge({
        id: `charge-${studentId}`,
        schoolId,
        studentId,
        enrollmentId: `charge-${studentId}`,
        academicYearId,
        label: 'Tuition',
        expectedAmount: 100,
        currency: 'USD',
        status: ChargeStatus.Overdue,
        dueDate: new Date('2026-01-01'),
      }))
    }
    await addGrant(Permission.QUERY_OVERDUE_FEES_READ, 'unused', { scopes: [{ kind: 'student', studentId: 'student-a' }] })
    const service = schoolService()
    expect(await service.getOverdueFeeCount('school-a')).toBe(1)
    await expect(service.getOverdueFeeCount('school-b')).rejects.toThrow()
    const scoped = repositories.studentCharges.forAccess(await service.baseService.access.finance.overdueChargesScope())
    expect((await scoped.list()).map(row => row.studentId)).toEqual(['student-a'])
    await repositories.staffPermissionAssignments.delete(`${Permission.QUERY_OVERDUE_FEES_READ}-unused`)
    await expect(service.getOverdueFeeCount('school-a')).rejects.toThrow()
  })

  test('payment reversal uses only PAYMENT_REVERSE and cannot rewrite receipt details', async () => {
    await addGrant(Permission.PAYMENT_REVERSE, 'school', { scopes: [{ kind: 'school' }] })
    const accountId = studentYearAccountId('school-a', 'student-a', 'year-a', 'USD')
    await repositories.studentYearAccounts.save(new StudentYearAccount({
      id: accountId,
      schoolId: 'school-a',
      studentId: 'student-a',
      academicYearId: 'year-a',
      currency: 'USD',
      availableBalance: 40,
    }))
    await repositories.payments.save(new Payment({
      id: 'payment',
      schoolId: 'school-a',
      accountId,
      academicYearId: 'year-a',
      kind: PaymentKind.Receipt,
      amount: 40,
      currency: 'USD',
      paymentDate: new Date(),
      method: PaymentMethod.Cash,
    }))
    const service = schoolService()
    const changed = await service.financeWorkflow.reversePayment({ paymentId: 'payment' })
    expect(changed.status).toBe(PaymentStatus.Reversed)
    expect((await repositories.studentYearAccounts.findById(accountId))?.availableBalance.amount).toBe(0)
    await expect(service.financeWorkflow.recordPayment({
      id: 'new-payment',
      accountId,
      amount: 10,
      paymentDate: new Date(),
      method: PaymentMethod.Cash,
    })).rejects.toThrow()
    expect(await repositories.payments.count()).toBe(1)
  })

  test('PAYMENT_REVERSE cannot create or rewrite payment details', async () => {
    await addGrant(Permission.PAYMENT_REVERSE, 'school', { scopes: [{ kind: 'school' }] })
    const accountId = studentYearAccountId('school-a', 'student-a', 'year-a', 'USD')
    await repositories.studentYearAccounts.save(new StudentYearAccount({
      id: accountId,
      schoolId: 'school-a',
      studentId: 'student-a',
      academicYearId: 'year-a',
      currency: 'USD',
      availableBalance: 40,
    }))
    const payment = new Payment({
      id: 'payment',
      schoolId: 'school-a',
      accountId,
      academicYearId: 'year-a',
      amount: 40,
      currency: 'USD',
      paymentDate: new Date(),
      method: PaymentMethod.Cash,
    })
    await repositories.payments.save(payment)
    const input = {
      ...payment.data,
      amount: 40,
      currency: 'USD',
      status: PaymentStatus.Reversed,
      reversedAt: new Date(),
      reversedById: 'staff-a',
    }
    const entities = schoolService().baseService.entities.payments
    for (const proposal of [{ ...input, amount: 90 }, { ...input, method: PaymentMethod.Card }, { ...input, id: 'new-payment' }])
      await expect(entities.save(new Payment(proposal))).rejects.toBeInstanceOf(AuthorizationError)
    expect((await repositories.payments.findById(payment.id))?.status).toBe(PaymentStatus.Recorded)
    expect(await repositories.payments.count()).toBe(1)
  })

  test('charge cancellation preserves recording authority for creation and financial details', async () => {
    await addGrant(Permission.PAYMENT_CANCEL, 'school', { scopes: [{ kind: 'school' }] })
    await repositories.catalogServices.save(new CatalogService({
      id: 'cancel-catalog',
      schoolId: 'school-a',
      academicYearId: 'year-a',
      name: 'Tuition',
      defaultPrice: 100,
      currency: 'USD',
      billingTerms: { kind: 'one_time', installments: [] },
      status: CatalogServiceStatus.Active,
    }))
    await repositories.studentServiceEnrollments.save(new StudentServiceEnrollment({
      id: 'student-charge',
      schoolId: 'school-a',
      studentId: 'student-a',
      catalogServiceId: 'cancel-catalog',
      academicYearId: 'year-a',
      acceptedTerms: {
        catalogServiceId: 'cancel-catalog',
        name: 'Tuition',
        category: CatalogServiceCategory.Tuition,
        currency: 'USD',
        price: 100,
        billingKind: 'one_time',
        billingTerms: { kind: 'one_time', installments: [] },
      },
    }))
    const charge = new StudentCharge({
      id: 'student-charge',
      schoolId: 'school-a',
      studentId: 'student-a',
      enrollmentId: 'student-charge',
      academicYearId: 'year-a',
      label: 'Tuition',
      expectedAmount: 100,
      currency: 'USD',
      status: ChargeStatus.Pending,
    })
    await repositories.studentCharges.save(charge)
    const stored = await repositories.studentCharges.findById(charge.id)
    if (!stored)
      throw new Error('expected saved student charge')
    const cancelled = stored.copyWith({
      status: ChargeStatus.Cancelled,
      cancellationReason: 'Duplicate',
      cancelledAt: new Date(),
      cancelledById: 'staff-a',
    })
    const entities = schoolService().baseService.entities.studentCharges
    for (const proposal of [
      cancelled.copyWith({ expectedAmount: 200 }),
      cancelled.copyWith({ studentId: 'student-other' }),
      cancelled.copyWith({ id: 'new-charge' }),
    ])
      await expect(entities.save(proposal)).rejects.toBeInstanceOf(AuthorizationError)
    expect((await repositories.studentCharges.findById(charge.id))?.status).toBe(ChargeStatus.Pending)
    await entities.save(cancelled)
    expect((await repositories.studentCharges.findById(charge.id))?.status).toBe(ChargeStatus.Cancelled)
  })

  test('teacher timetable queries constrain events to current subject assignments', async () => {
    for (const [id, classSubjectId, classGroupId] of [['math-session', 'math-a', 'class-a'], ['french-session', 'french-a', 'class-a'], ['other-session', 'math-other', 'class-other']]) {
      await repositories.lessonSessions.save(new LessonSession({ id: id!, schoolId: 'school-a', classGroupId: classGroupId!, classSubjectId: classSubjectId!, displayLabel: id!, startsAt: new Date('2026-05-01T10:00:00Z'), endsAt: new Date('2026-05-01T11:00:00Z') }))
    }
    const input = { classGroupId: 'class-a', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-01') }
    const service = schoolService(teacher)
    expect((await service.getClassGroupTimetable(input)).events.map(event => event.id)).toEqual(['math-session'])
    await expect(service.getClassGroupTimetable({ ...input, classGroupId: 'class-other' })).rejects.toThrow()
    await db.exec('DELETE FROM teacher_assignments')
    await expect(service.getClassGroupTimetable(input)).rejects.toThrow()
  })

  test('teacher timetable queries keep assigned sessions and reject other teachers', async () => {
    for (const [id, classSubjectId, classGroupId, teacherIds] of [
      ['math-session', 'math-a', 'class-a', ['teacher-a']],
      ['french-session', 'french-a', 'class-a', []],
      ['other-session', 'math-other', 'class-other', ['teacher-a']],
    ] as const) {
      await repositories.lessonSessions.save(new LessonSession({
        id,
        schoolId: 'school-a',
        classGroupId,
        classSubjectId,
        displayLabel: id,
        startsAt: new Date('2026-05-01T10:00:00Z'),
        endsAt: new Date('2026-05-01T11:00:00Z'),
        timetableTeacherIds: [...teacherIds],
      }))
    }
    const input = { teacherId: 'teacher-a', startDate: new Date('2026-05-01'), endDate: new Date('2026-05-01') }
    const service = schoolService(teacher)
    expect((await service.getTeacherTimetable(input)).events.map(event => event.id)).toEqual(['math-session'])
    await repositories.teachers.save(new Teacher({ id: 'teacher-other', schoolId: 'school-a', firstName: 'Other', lastName: 'Teacher' }))
    await expect(service.getTeacherTimetable({ ...input, teacherId: 'teacher-other' })).rejects.toThrow()
    await expect(schoolService(guardian).getTeacherTimetable(input)).rejects.toThrow()
  })

  test('attachment scopes follow their owner and do not expose unrelated, foreign or sensitive records', async () => {
    for (const [id, ownerKind, ownerId] of [
      ['own-profile', AttachmentOwnerKind.Student, 'student-a'],
      ['other-profile', AttachmentOwnerKind.Student, 'student-other'],
      ['foreign-profile', AttachmentOwnerKind.Student, 'student-b'],
      ['math-file', AttachmentOwnerKind.AssessmentResult, '1-math'],
      ['french-file', AttachmentOwnerKind.AssessmentResult, '2-french'],
      ['health-file', AttachmentOwnerKind.StudentHealthProfile, 'health-a'],
    ] as const) {
      await repositories.attachments.save(new Attachment({ id, schoolId: 'school-a', ownerKind, ownerId, fileName: id, storageKey: id }))
    }
    await db.exec('INSERT INTO student_health_profiles (id, school_id, student_id, allergies, medical_conditions, created_at, updated_at) VALUES (\'health-a\', \'school-a\', \'student-a\', \'[]\', \'[]\', now(), now())')
    const teacherFiles = repositories.attachments.forAccess(await new AccessPolicies(teacher, repositories).scope(Permission.ATTACHMENT_READ, 'attachments'))
    expect((await teacherFiles.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['math-file', 'own-profile'])
    expect(await teacherFiles.count()).toBe(2)
    expect(await teacherFiles.findById('french-file')).toBeUndefined()
    const familyFiles = repositories.attachments.forAccess(await new AccessPolicies(guardian, repositories).scope(Permission.ATTACHMENT_READ, 'attachments'))
    expect((await familyFiles.list({ $orderBy: [{ field: 'id', direction: 'asc' }] })).map(row => row.id)).toEqual(['french-file', 'math-file', 'own-profile'])
    expect(await familyFiles.findById('health-file')).toBeUndefined()
    expect(await familyFiles.findById('foreign-profile')).toBeUndefined()
  })

  test('inactive selected profiles and removed guardian links are denied using current facts', async () => {
    await db.exec('UPDATE students SET subject_id = \'student-person\' WHERE id = \'student-a\'')
    const student = createStudentActorMetadata({ schoolId: 'school-a', studentId: 'student-a', subjectId: 'student-person', authenticatedAt: new Date(), requestId: 'student' })
    const access = new AccessPolicies(student, repositories)
    expect(await repositories.students.forAccess(await access.scope(Permission.STUDENT_READ, 'students')).count()).toBe(1)
    await db.exec('UPDATE students SET status = \'inactive\' WHERE id = \'student-a\'')
    await expect(access.scope(Permission.STUDENT_READ, 'students')).rejects.toThrow()
    const family = new AccessPolicies(guardian, repositories)
    expect(await repositories.students.forAccess(await family.scope(Permission.STUDENT_READ, 'students')).count()).toBe(1)
    await db.exec('DELETE FROM guardian_student_links')
    expect(await repositories.students.forAccess(await family.scope(Permission.STUDENT_READ, 'students')).count()).toBe(0)
    await db.exec('UPDATE guardians SET has_access = false WHERE id = \'guardian-a\'')
    await expect(family.scope(Permission.STUDENT_READ, 'students')).rejects.toThrow()
  })

  test('workspace and structure permissions do not disclose staff or authorize staff mutations', async () => {
    await addGrant(Permission.QUERY_WORKSPACE_READ, 'workspace', { scopes: [{ kind: 'school' }] })
    await addGrant(Permission.SCHOOL_STRUCTURE_CONFIGURE, 'structure', { scopes: [{ kind: 'school' }] })
    const people = schoolService().baseService.entities.staffMembers
    expect((await people.findById('staff-a'))?.id).toBe('staff-a')
    expect(await people.findById('staff-b')).toBeUndefined()
    expect((await people.list()).map(row => row.id)).toEqual(['staff-a'])
    expect(await people.count()).toBe(1)
    const original = (await repositories.staffMembers.findById('staff-a'))!
    await expect(people.save(new StaffMember({ ...original.data, lastName: 'Changed' }))).rejects.toThrow()
    await addGrant(Permission.STAFF_READ, 'staff', { scopes: [{ kind: 'school' }] })
    expect((await people.list()).map(row => row.id)).toEqual(['staff-a'])
    expect(await people.findById('staff-b')).toBeUndefined()
    await expect(people.save(new StaffMember({ ...original.data, id: 'new-staff' }))).rejects.toThrow()
  })

  test('student create, update and archive permissions have distinct effects', async () => {
    const students = schoolService().baseService.entities.students
    const before = (await repositories.students.findById('student-a'))!
    await addGrant(Permission.STUDENT_UPDATE, 'update', { scopes: [{ kind: 'school' }] })
    await students.save(new Student({ ...before.data, firstName: 'Changed' }))
    await expect(students.save(new Student({ ...before.data, id: 'new-student' }))).rejects.toThrow()
    await expect(students.save(new Student({ ...before.data, status: StudentStatus.Inactive }))).rejects.toThrow()
    await addGrant(Permission.STUDENT_CREATE, 'create', { scopes: [{ kind: 'school' }] })
    await students.save(new Student({ ...before.data, id: 'new-student' }))
    await addGrant(Permission.STUDENT_ARCHIVE, 'archive', { scopes: [{ kind: 'school' }] })
    await students.save(new Student({ ...before.data, status: StudentStatus.Inactive }))
    expect((await repositories.students.findById('student-a'))?.status).toBe(StudentStatus.Inactive)
  })

  test('grade input does not authorize exam creation; exam scopes preserve subject isolation', async () => {
    const exams = schoolService().baseService.entities.assessments
    const before = (await repositories.assessments.findById('assessment-math'))!
    await addGrant(Permission.GRADE_INPUT)
    await expect(exams.save(new Assessment({ ...before.data, id: 'new-exam' }))).rejects.toThrow()
    await addGrant(Permission.EXAM_CONFIG_CREATE, 'exam', { scopes: [{ kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-a' }] })
    await exams.save(new Assessment({ ...before.data, id: 'new-exam' }))
    await expect(exams.save(new Assessment({ ...before.data, id: 'other-exam', classSubjectId: 'french-a' }))).rejects.toThrow()
    await expect(exams.save(new Assessment({ ...before.data, title: 'Changed' }))).rejects.toThrow()
    await addGrant(Permission.EXAM_CONFIG_UPDATE, 'exam', { scopes: [{ kind: 'class_subject', classGroupId: 'class-a', classSubjectId: 'math-a' }] })
    await exams.save(new Assessment({ ...before.data, title: 'Changed' }))
  })

  test('attendance recording cannot correct an existing mark or approve a justification', async () => {
    const records = schoolService().baseService.entities.attendance
    await addGrant(Permission.ATTENDANCE_RECORD)
    const record = new AttendanceRecord({ id: 'absence', studentId: 'student-a', assessmentId: 'assessment-math', date: new Date('2026-05-01'), status: AttendanceStatus.Absent })
    await records.save(record)
    await expect(records.save(record.copyWith({ status: AttendanceStatus.Present }))).rejects.toThrow()
    const reviewed = record.copyWith({ justificationStatus: AttendanceJustificationStatus.Excused, reason: 'Medical', justifiedAt: new Date(), justifiedByStaffId: 'staff-a' })
    await expect(records.save(reviewed)).rejects.toThrow()
    await addGrant(Permission.ATTENDANCE_JUSTIFY, 'justify', { scopes: [{ kind: 'school' }] })
    await records.save(record.copyWith({ justificationStatus: AttendanceJustificationStatus.Pending, reason: 'Medical' }))
    await expect(records.save(reviewed)).rejects.toThrow()
    await addGrant(Permission.ATTENDANCE_VALIDATE, 'validate', { scopes: [{ kind: 'school' }] })
    await records.save(reviewed)
    expect((await repositories.attendance.findById(record.id))?.justificationStatus).toBe(AttendanceJustificationStatus.Excused)
  })

  test('teacher logbook updates change content only within their currently assigned subject', async () => {
    const session = new LessonSession({ id: 'logbook', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', startsAt: new Date('2026-05-01T09:00:00Z'), endsAt: new Date('2026-05-01T10:00:00Z'), displayLabel: 'Math', sessionNote: 'First lesson' })
    await repositories.lessonSessions.save(session)
    const lessons = schoolService(teacher).baseService.entities.lessonSessions
    await lessons.save(session.copyWith({ sessionNote: 'Fractions', displayLabel: 'Math review' }))
    expect((await repositories.lessonSessions.findById(session.id))?.sessionNote).toBe('Fractions')
    await expect(lessons.save(session.copyWith({ startsAt: new Date('2026-05-01T08:00:00Z') }))).rejects.toThrow()
    await expect(lessons.save(session.copyWith({ classSubjectId: 'french-a' }))).rejects.toThrow()
    await db.exec('DELETE FROM teacher_assignments')
    await expect(lessons.save(session.copyWith({ sessionNote: 'Removed teacher' }))).rejects.toThrow()
    expect((await repositories.lessonSessions.findById(session.id))?.sessionNote).toBe('Fractions')
  })

  test('recording logbook progress authorizes the snapshot and both aggregates using the logbook action', async () => {
    await repositories.subjectMatters.save(new SubjectMatter({ id: 'chapter', subjectId: 'math', name: 'Fractions', sequenceOrder: 1 }))
    await repositories.classSubjectMatters.save(new ClassSubjectMatter({ id: 'chapter-a', classSubjectId: 'math-a', subjectMatterId: 'chapter', status: ClassSubjectMatterStatus.NotStarted, completedPercentage: 0 }))
    const lesson = new LessonSession({ id: 'progress-lesson', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', startsAt: new Date('2026-05-01T09:00:00Z'), endsAt: new Date('2026-05-01T10:00:00Z'), displayLabel: 'Math' })
    await repositories.lessonSessions.save(lesson)
    const service = schoolService(teacher)
    const progress = await service.academicsWorkflow.recordLessonSessionProgress({ id: 'snapshot', classSubjectMatterId: 'chapter-a', lessonSessionId: lesson.id, completedPercentage: 40, notes: 'Worked examples' })
    expect(progress.completedPercentage).toBe(40)
    expect((await repositories.classSubjectMatters.findById('chapter-a'))?.completedPercentage).toBe(40)
    expect((await repositories.classSubjects.findById('math-a'))?.completedPercentage).toBe(40)
    await expect(service.academicsWorkflow.recordLessonSessionProgress({ id: 'another-snapshot', classSubjectMatterId: 'chapter-a', lessonSessionId: lesson.id, completedPercentage: 60 })).rejects.toThrow()
    expect(await repositories.classSubjectProgress.count()).toBe(1)
  })

  test('linking uses access-control authority and preserves profile data without granting profile-update authority', async () => {
    const helper = new StaffMember({ id: 'helper', schoolId: 'school-a', firstName: 'Helper', lastName: 'Staff', code: 'HELPER', email: 'helper@example.com' })
    await repositories.staffMembers.save(helper)
    await addGrant(Permission.ACCESS_CONTROL_ASSIGN, 'link', { scopes: [{ kind: 'school' }] })
    const service = schoolService()
    await service.accessControlWorkflow.linkActorSubject({ staffMemberId: helper.id, subjectId: 'helper-person' })
    expect((await repositories.staffMembers.findById(helper.id))?.subjectId).toBe('helper-person')
    expect((await repositories.staffMembers.findById(helper.id))?.code).toBe('HELPER')
    await service.accessControlWorkflow.unlinkActorSubject({ staffMemberId: helper.id })
    expect((await repositories.staffMembers.findById(helper.id))?.subjectId).toBeUndefined()
    await expect(service.accessControlWorkflow.linkActorSubject({ staffMemberId: 'staff-b', subjectId: 'foreign' })).rejects.toThrow()
    await repositories.staffPermissionAssignments.delete(`${Permission.ACCESS_CONTROL_ASSIGN}-link`)
    await expect(service.accessControlWorkflow.linkActorSubject({ staffMemberId: helper.id, subjectId: 'denied' })).rejects.toThrow()
    expect((await repositories.staffMembers.findById(helper.id))?.subjectId).toBeUndefined()
  })

  test('profile updates cannot relink identities or bypass ownership transfer', async () => {
    await addGrant(Permission.STUDENT_UPDATE, 'profile', { scopes: [{ kind: 'school' }] })
    const student = (await repositories.students.findById('student-a'))!
    await expect(schoolService().baseService.entities.students.save(new Student({ ...student.data, subjectId: 'new-person' }))).rejects.toThrow()
    expect((await repositories.students.findById(student.id))?.subjectId).toBeUndefined()
    await db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    await expect(schoolService().accessControlWorkflow.unlinkActorSubject({ staffMemberId: 'staff-a' })).rejects.toMatchObject({ code: 'SCHOOL_OWNER_IDENTITY_LINK_BLOCKED' })
    expect((await repositories.staffMembers.findById('staff-a'))?.subjectId).toBe('person-a')
  })
  async function inheritedCurriculum() {
    const gradeSubject = new GradeLevelSubject({ id: 'grade-math', gradeLevelId: 'level-a', academicYearId: 'year-a', subjectId: 'math', coefficient: 2, periodsPerWeek: 4, minPeriodSpan: 2, maxPeriodSpan: 3 })
    await repositories.gradeLevelSubjects.save(gradeSubject)
    for (const id of ['math-a', 'math-other']) {
      const subject = (await repositories.classSubjects.findById(id))!
      await repositories.classSubjects.save(new ClassSubject({ ...subject.data, gradeLevelSubjectId: gradeSubject.id, coefficient: 2, periodsPerWeek: 4, minPeriodSpan: 2, maxPeriodSpan: 3 }))
    }
    return gradeSubject
  }

  test('curriculum updates authorize every mirrored class and roll back partial changes', async () => {
    await inheritedCurriculum()
    await addGrant(Permission.ACADEMIC_PROGRAM_UPDATE)
    const workflow = schoolService().academicsWorkflow
    await expect(workflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'grade-math', coefficient: 5 })).rejects.toThrow()
    expect((await repositories.gradeLevelSubjects.findById('grade-math'))?.coefficient).toBe(2)
    expect((await repositories.classSubjects.findById('math-a'))?.coefficient).toBe(2)
    await addGrant(Permission.ACADEMIC_PROGRAM_UPDATE, 'class-other')
    await workflow.updateGradeLevelSubject({ gradeLevelSubjectId: 'grade-math', coefficient: 5 })
    for (const id of ['math-a', 'math-other']) {
      const subject = (await repositories.classSubjects.findById(id))!
      expect([subject.coefficient, subject.periodsPerWeek, subject.minPeriodSpan, subject.maxPeriodSpan]).toEqual([5, 4, 2, 3])
    }
    expect((await repositories.gradeLevelSubjects.findById('grade-math'))?.periodsPerWeek).toBe(4)
  })

  test('curriculum removal retains all rows when teaching or assessment dependencies exist', async () => {
    await inheritedCurriculum()
    await addGrant(Permission.ACADEMIC_PROGRAM_DELETE, 'class-a', { scopes: [{ kind: 'school' }] })
    await repositories.subjectMatters.save(new SubjectMatter({ id: 'topic-delete', subjectId: 'math', name: 'Topic', sequenceOrder: 1 }))
    await repositories.classSubjectMatters.save(new ClassSubjectMatter({ id: 'allocation-delete', classSubjectId: 'math-a', subjectMatterId: 'topic-delete', status: ClassSubjectMatterStatus.NotStarted, completedPercentage: 0 }))
    await expect(schoolService().academicsWorkflow.removeSubjectFromGradeLevel({ gradeLevelSubjectId: 'grade-math' })).rejects.toMatchObject({ code: 'CLASS_SUBJECT_HAS_DEPENDENCIES' })
    expect(await repositories.gradeLevelSubjects.findById('grade-math')).toBeDefined()
    expect(await repositories.classSubjectMatters.findById('allocation-delete')).toBeDefined()
    expect(await repositories.classSubjects.findById('math-a')).toBeDefined()
    expect(await repositories.classSubjects.findById('math-other')).toBeDefined()
  })

  test('a curriculum allocation with progress cannot be deleted even by an owner', async () => {
    await db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    await repositories.subjectMatters.save(new SubjectMatter({ id: 'topic-delete', subjectId: 'math', name: 'Topic', sequenceOrder: 1 }))
    await repositories.classSubjectMatters.save(new ClassSubjectMatter({ id: 'allocation-delete', classSubjectId: 'math-a', subjectMatterId: 'topic-delete', status: ClassSubjectMatterStatus.InProgress, completedPercentage: 30 }))
    await repositories.lessonSessions.save(new LessonSession({ id: 'progress-lesson', schoolId: 'school-a', classGroupId: 'class-a', classSubjectId: 'math-a', startsAt: new Date('2026-05-01T09:00:00Z'), endsAt: new Date('2026-05-01T10:00:00Z'), displayLabel: 'Math' }))
    await repositories.classSubjectProgress.save(new ClassSubjectProgress({ id: 'saved-progress', classSubjectMatterId: 'allocation-delete', lessonSessionId: 'progress-lesson', completedPercentage: 30 }))
    await expect(schoolService().baseService.entities.classSubjectMatters.delete('allocation-delete')).rejects.toMatchObject({ code: 'CLASS_SUBJECT_MATTER_HAS_PROGRESS' })
    expect(await repositories.classSubjectProgress.findById('saved-progress')).toBeDefined()
    expect(await repositories.classSubjectMatters.findById('allocation-delete')).toBeDefined()
  })
  async function pendingOwnerInvitation() {
    await repositories.staffMembers.save(new StaffMember({ id: 'pending-owner', schoolId: 'school-a', firstName: 'Pending', lastName: 'Owner', code: 'KEEP', email: 'owner@example.com' }))
    await db.exec('UPDATE schools SET pending_owner_staff_id = \'pending-owner\' WHERE id = \'school-a\'')
    const invitation = new AccountInvitation({ id: 'owner-invitation', schoolId: 'school-a', kind: AccountInvitationKind.Staff, targetId: 'pending-owner', contactChannel: AccountInvitationContactChannel.Email, contactValue: 'owner@example.com', tokenHash: hashInvitationToken('test-owner-token'), expiresAt: new Date('2999-01-01'), createdByStaffId: 'staff-a' })
    await repositories.accountInvitations.save(invitation)
    return invitation
  }

  test('a valid owner invitation claims ownership and links the profile in one transaction', async () => {
    await pendingOwnerInvitation()
    const service = schoolService(createSystemActorMetadata({ schoolId: 'school-a', systemId: 'account-invitation-public', requestId: 'invitation', reason: 'Accept invitation' }))
    const result = await service.accountInvitationWorkflow.acceptAccountInvitation({ token: 'test-owner-token', subjectId: 'new-owner', contactValue: 'owner@example.com' })
    expect(result.entity.subjectId).toBe('new-owner')
    expect((await repositories.staffMembers.findById('pending-owner'))?.code).toBe('KEEP')
    const school = (await repositories.schools.findById('school-a'))!
    expect(school.ownerSubjectId).toBe('new-owner')
    expect(school.pendingOwnerStaffId).toBeUndefined()
    expect((await repositories.accountInvitations.findById('owner-invitation'))?.status).toBe(AccountInvitationStatus.Accepted)
    const foreign = schoolService(createSystemActorMetadata({ schoolId: 'school-b', systemId: 'account-invitation-public', requestId: 'invitation', reason: 'Accept invitation' }))
    await expect(foreign.accountInvitationWorkflow.acceptAccountInvitation({ token: 'test-owner-token', subjectId: 'new-owner', contactValue: 'owner@example.com' })).rejects.toThrow()
    const repeated = await service.accountInvitationWorkflow.acceptAccountInvitation({ token: 'test-owner-token', subjectId: 'new-owner', contactValue: 'owner@example.com' })
    expect(repeated.entity.subjectId).toBe('new-owner')
  })

  test('a stale owner invitation cannot replace an existing owner and rolls back the identity link', async () => {
    await pendingOwnerInvitation()
    await db.exec('UPDATE schools SET owner_subject_id = \'person-a\' WHERE id = \'school-a\'')
    const service = schoolService(createSystemActorMetadata({ schoolId: 'school-a', systemId: 'account-invitation-public', requestId: 'invitation', reason: 'Accept invitation' }))
    await expect(service.accountInvitationWorkflow.acceptAccountInvitation({ token: 'test-owner-token', subjectId: 'new-owner', contactValue: 'owner@example.com' })).rejects.toThrow()
    expect((await repositories.staffMembers.findById('pending-owner'))?.subjectId).toBeUndefined()
    expect((await repositories.schools.findById('school-a'))?.ownerSubjectId).toBe('person-a')
    expect((await repositories.accountInvitations.findById('owner-invitation'))?.status).toBe(AccountInvitationStatus.Pending)
  })

  test('invitation contact, expiry and tenant restrictions are checked before linking', async () => {
    const invitation = await pendingOwnerInvitation()
    const service = schoolService(createSystemActorMetadata({ schoolId: 'school-a', systemId: 'account-invitation-public', requestId: 'invitation', reason: 'Accept invitation' }))
    const input = { token: 'test-owner-token', subjectId: 'new-owner', contactValue: 'owner@example.com' }
    await expect(service.accountInvitationWorkflow.acceptAccountInvitation({ ...input, contactValue: 'unrelated@example.com' })).rejects.toMatchObject({ code: 'INVITATION_EMAIL_MISMATCH' })
    const foreign = schoolService(createSystemActorMetadata({ schoolId: 'school-b', systemId: 'account-invitation-public', requestId: 'invitation', reason: 'Accept invitation' }))
    await expect(foreign.accountInvitationWorkflow.acceptAccountInvitation(input)).rejects.toThrow()
    await repositories.accountInvitations.save(invitation.copyWith({ expiresAt: new Date('2000-01-01') }))
    await expect(service.accountInvitationWorkflow.acceptAccountInvitation(input)).rejects.toMatchObject({ code: 'INVITATION_EXPIRED' })
    expect((await repositories.staffMembers.findById('pending-owner'))?.subjectId).toBeUndefined()
  })

  test('a teacher can update only their own contact profile', async () => {
    const updated = await schoolService(teacher).setupWorkflow.updateTeacherSelfProfile({
      firstName: 'Awa',
      lastName: 'Teacher',
      email: 'awa@example.test',
      phone: null,
    })
    expect(updated.id).toBe('teacher-a')
    expect(updated.firstName).toBe('Awa')
    expect(updated.email).toBe('awa@example.test')
    expect(updated.phone).toBeUndefined()
    expect(updated.subjectId).toBe('person-a')
    expect((await repositories.teachers.findById('teacher-a'))?.email).toBe('awa@example.test')
    await expect(schoolService(staff).setupWorkflow.updateTeacherSelfProfile({
      firstName: 'Staff',
      lastName: 'Override',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
