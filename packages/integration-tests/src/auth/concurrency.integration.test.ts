import {
  AttendanceStatus,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  GradeLevel,
  PaymentMethod,
  SessionKind,
  StaffRole,
  Subject,
} from '@edaya/core'
import { expect, it } from 'bun:test'
import { createTestApp } from '../support/in-memory-school-headless-app'
import { describeIntegration } from '../support/suite-runner'

async function createConcurrencyFixture() {
  const { app, repositories, forActor } = createTestApp()

  // Setup standard tenant school context using 'school' matching the default actor
  await app.setup.registerSchool({ id: 'school', name: 'Concurrent Academy', timeZone: 'UTC' })
  await app.setup.createAcademicYear({
    id: 'year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.config.gradeLevels.save(
    new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 7', order: 7 }),
  )
  await app.setup.createClassGroup({
    id: 'class',
    schoolId: 'school',
    academicYearId: 'year',
    gradeLevelId: 'level',
    name: 'Grade 7 A',
  })

  // Register staff members
  await app.setup.registerStaffMember({
    id: 'teacher',
    schoolId: 'school',
    firstName: 'Binta',
    lastName: 'Sow',
    roles: [StaffRole.Teacher],
  })
  await app.setup.registerStaffMember({
    id: 'accountant',
    schoolId: 'school',
    firstName: 'Mariama',
    lastName: 'Ba',
    roles: [StaffRole.Accountant],
  })

  // Register student and guardian
  await app.students.registerStudent({ id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
  await app.students.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class' })
  await app.students.registerGuardian({ id: 'guardian', schoolId: 'school', firstName: 'Nadia', lastName: 'Diallo' })
  await app.students.linkGuardianToStudent({ id: 'guardian-link', guardianId: 'guardian', studentId: 'student' })

  // Offer subject and class details
  await app.config.subjects.save(
    new Subject({ id: 'math', schoolId: 'school', name: 'Mathematics' }),
  )
  const classSubject = await app.academics.offerSubjectToClass({
    id: 'class-math',
    classGroupId: 'class',
    subjectId: 'math',
  })

  const session = await app.scheduling.createSession({
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
  await app.setup.assignStaffToClassSubject({
    id: 'teacher-subject',
    staffId: 'teacher',
    classSubjectId: classSubject.id,
    role: StaffRole.Teacher,
  })
  await app.setup.assignStaffToClass({
    id: 'teacher-class',
    staffId: 'teacher',
    classGroupId: 'class',
    role: StaffRole.Teacher,
  })
  await app.setup.assignStaffToSession({
    id: 'teacher-session',
    staffId: 'teacher',
    sessionId: session.id,
    role: StaffRole.Teacher,
  })

  await app.finance.createFee({
    id: 'tuition',
    schoolId: 'school',
    academicYearId: 'year',
    name: 'Tuition',
    defaultAmount: 90000,
    currency: 'XAF',
  })
  const studentFee = await app.finance.assignFeeToStudent({
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
    }))

    const accountantApp = forActor(createStaffActorMetadata({
      subjectId: 'accountant-user',
      staffMemberId: 'accountant',
      schoolId: 'school',
      roles: [StaffRole.Accountant],
      requestId: 'accountant-request-202',
      authenticatedAt: new Date(),
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
    const [attendanceRecord, paymentRecord, _studentDetailResult, feeSummaryResult] = await Promise.all([
      teacherApp.scheduling.recordAttendance({
        id: 'concurrent-attendance',
        studentId: 'student',
        sessionId: session.id,
        status: AttendanceStatus.Present,
      }),
      accountantApp.finance.recordPayment({
        id: 'concurrent-payment',
        studentFeeId: studentFee.id,
        amount: 5000,
        paymentDate: new Date(),
        method: PaymentMethod.Cash,
      }),
      studentApp.queries.attendance.list({ studentId: 'student' }),
      guardianApp.finance.buildFeeSummary('student'),
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
