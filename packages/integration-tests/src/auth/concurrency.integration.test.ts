import {
  AccessRole,
  ActorAssuranceLevel,
  AttendanceStatus,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  GradeLevel,
  PaymentMethod,
  Permission,
  SessionKind,
  StaffRoleAssignment,
  StaffRole,
  Subject,
} from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import {
  buildFeeSummary,
  createClassGroup,
  saveClassSubject,
  saveFee,
  saveGuardian,
  saveSchool,
  saveSession,
  saveStaffAssignment,
  saveStaffMember,
  saveStudent,
} from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

async function createConcurrencyFixture() {
  const { app, repositories, forActor } = createTestApp()

  // Setup standard tenant school context using 'school' matching the default actor
  await saveSchool(app, { id: 'school', name: 'Concurrent Academy', timeZone: 'UTC' })
  await app.createAcademicYear({
    id: 'year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.baseService.gradeLevels.save(
    new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 7', order: 7 }),
  )
  await createClassGroup(app, {
    id: 'class',
    schoolId: 'school',
    academicYearId: 'year',
    gradeLevelId: 'level',
    name: 'Grade 7 A',
  })

  // Register staff members
  await saveStaffMember(app, {
    id: 'teacher',
    schoolId: 'school',
    firstName: 'Binta',
    lastName: 'Sow',
  })
  await saveStaffMember(app, {
    id: 'accountant',
    schoolId: 'school',
    firstName: 'Mariama',
    lastName: 'Ba',
  })
  await app.baseService.repositories.accessRoles.save(new AccessRole({
    id: 'teacher-access',
    schoolId: 'school',
    name: 'Teacher access',
    isSystemRole: false,
    permissions: [
      Permission.ATTENDANCE_RECORD,
      Permission.CLASS_LOGBOOK_CREATE,
      Permission.CLASS_LOGBOOK_UPDATE,
      Permission.DISCIPLINE_CREATE,
      Permission.GRADE_INPUT,
    ],
  }))
  await app.baseService.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'teacher-access-assignment',
    staffId: 'teacher',
    schoolId: 'school',
    roleIds: ['teacher-access'],
  }))
  await app.baseService.repositories.accessRoles.save(new AccessRole({
    id: 'accountant-access',
    schoolId: 'school',
    name: 'Accountant access',
    isSystemRole: false,
    permissions: [
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
      Permission.PAYMENT_RECORD,
    ],
  }))
  await app.baseService.repositories.staffRoleAssignments.save(new StaffRoleAssignment({
    id: 'accountant-access-assignment',
    staffId: 'accountant',
    schoolId: 'school',
    roleIds: ['accountant-access'],
    scopeGrants: [
      {
        permission: Permission.FINANCIAL_CONFIG_READ,
        scopeType: 'school',
        scopeEntityIds: ['school'],
      },
      {
        permission: Permission.PAYMENT_READ,
        scopeType: 'school',
        scopeEntityIds: ['school'],
      },
      {
        permission: Permission.PAYMENT_RECORD,
        scopeType: 'school',
        scopeEntityIds: ['school'],
      },
    ],
  }))

  // Register student and guardian
  await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
  await app.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
  await saveGuardian(app, { id: 'guardian', schoolId: 'school', firstName: 'Nadia', lastName: 'Diallo' })
  await app.linkGuardianToStudent({ id: 'guardian-link', guardianId: 'guardian', studentId: 'student' })

  // Offer subject and class details
  await app.baseService.subjects.save(
    new Subject({ id: 'math', schoolId: 'school', name: 'Mathematics' }),
  )
  const classSubject = await saveClassSubject(app, {
    id: 'class-math',
    classGroupId: 'class',
    subjectId: 'math',
  })

  const session = await saveSession(app, {
    id: 'lesson',
    schoolId: 'school',
    classGroupId: 'class',
    classSubjectId: classSubject.id,
    title: 'Fractions',
    kind: SessionKind.Course,
    startsAt: new Date('2026-09-01T08:00:00Z'),
    endsAt: new Date('2026-09-01T09:00:00Z'),
  })

  // Assign staff to session and subject load
  await saveStaffAssignment(app, {
    id: 'teacher-subject',
    staffId: 'teacher',
    classSubjectId: classSubject.id,
    responsibility: 'teacher',
  })
  await saveStaffAssignment(app, {
    id: 'teacher-class',
    staffId: 'teacher',
    classGroupId: 'class',
    responsibility: 'teacher',
  })
  await saveStaffAssignment(app, {
    id: 'teacher-session',
    staffId: 'teacher',
    sessionId: session.id,
    responsibility: 'teacher',
  })

  await saveFee(app, {
    id: 'tuition',
    schoolId: 'school',
    academicYearId: 'year',
    name: 'Tuition',
    defaultAmount: 90000,
    currency: 'XAF',
  })
  const studentFee = await app.assignFeeToStudent({
    id: 'student-fee',
    studentId: 'student',
    feeId: 'tuition',
  })

  return { app, repositories, forActor, session, studentFee }
}

describeIntegration('Shared-repository multi-actor concurrency safeguards', () => {
  it('correctly isolates attributions and validates permissions for overlapping concurrent operations', async () => {
    const { repositories, forActor, session, studentFee } = await createConcurrencyFixture()

    // Instantiate concurrent actor-bound facades
    const teacherApp = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'teacher-request-101',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    const accountantApp = forActor(createStaffActorMetadata({
      subjectId: 'accountant-user',
      staffMemberId: 'accountant',
      schoolId: 'school',
      roles: [StaffRole.Accountant],
      requestId: 'accountant-request-202',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    const guardianApp = forActor(createGuardianActorMetadata({
      subjectId: 'guardian-user',
      guardianId: 'guardian',
      schoolId: 'school',
      requestId: 'guardian-request-303',
      authenticatedAt: new Date(),
    }))

    const studentApp = forActor(createStudentActorMetadata({
      subjectId: 'student-user',
      studentId: 'student',
      schoolId: 'school',
      requestId: 'student-request-404',
      authenticatedAt: new Date(),
    }))

    // Execute multiple overlapping read & write actions concurrently
    const label = async <T>(name: string, operation: Promise<T>): Promise<T> => {
      try {
        return await operation
      }
      catch (error) {
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    const [attendanceRecord, paymentRecord, _studentDetailResult, feeSummaryResult] = await Promise.all([
      label('teacher attendance',
      teacherApp.recordAttendance({
        id: 'concurrent-attendance',
        studentId: 'student',
        sessionId: session.id,
        status: AttendanceStatus.Present,
      })),
      label('accountant payment',
      accountantApp.recordPayment({
        id: 'concurrent-payment',
        studentFeeId: studentFee.id,
        amount: 5000,
        paymentDate: new Date(),
        method: PaymentMethod.Cash,
      })),
      label('student attendance list', studentApp.baseService.attendance.list({ studentId: 'student' })),
      label('guardian fee summary', buildFeeSummary(guardianApp, 'student')),
    ])

    // Verify attributions are perfectly isolated to their respective actors
    expect(attendanceRecord.createdBy).toBe('teacher')
    expect(paymentRecord.recordedById).toBe('accountant')

    // Verify results are accurate and not mixed or leaked
    expect(feeSummaryResult.totalExpected.amount).toBe(90000)

    // Verify repository persisted states
    const attendanceRepoRecords = await repositories.attendanceRepository.list({ sessionId: session.id })
    const paymentRepoRecords = await repositories.paymentRepository.list({ studentFeeId: studentFee.id })

    expect(attendanceRepoRecords).toHaveLength(1)
    expect(attendanceRepoRecords[0]?.createdBy).toBe('teacher')
    expect(paymentRepoRecords).toHaveLength(1)
    expect(paymentRepoRecords[0]?.recordedById).toBe('accountant')
  })
})
