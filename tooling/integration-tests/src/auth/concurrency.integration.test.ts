import { ActorAssuranceLevel, ASSIGNMENT_SCOPED_PERMISSIONS, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, Permission } from '@edaya/authorization'
import { AttendanceStatus, GradeLevel, PaymentMethod, Subject } from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { buildFeeSummary, createClassGroup, createFixtureSubjectCategory, saveClassSubject, saveFee, saveGuardian, saveLessonSession, saveSchool, saveStaffAssignment, saveStaffMember, saveStudent, seedStaffPermissionTemplate, withFixtureDiscipline } from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

async function createConcurrencyFixture() {
  const { app, repositories, schoolRepositories, forActor } = await createTestApp()

  // Setup standard tenant school context using 'school' matching the default actor
  await saveSchool(app, { id: 'school', name: 'Concurrent Academy', timeZone: 'UTC', financeCurrency: 'XAF' })
  await app.setupWorkflow.createAcademicYear({
    id: 'year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.baseService.entities.gradeLevels.save(
    new GradeLevel({ id: 'level', schoolId: 'school', name: 'Grade 7', label: 'G7', order: 7 }),
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
  await seedStaffPermissionTemplate(schoolRepositories, {
    staffId: 'accountant',
    schoolId: 'school',
    academicYearId: 'year',
    permissions: [
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
      Permission.PAYMENT_RECORD,
    ],
    idPrefix: 'spa-accountant',
  })

  // Register student and guardian
  await saveStudent(app, { id: 'student', schoolId: 'school', firstName: 'Amira', lastName: 'Diallo' })
  await saveGuardian(app, { id: 'guardian', schoolId: 'school', firstName: 'Nadia', lastName: 'Diallo' })

  // Offer subject and class details
  await app.baseService.entities.subjects.save(
    new Subject(withFixtureDiscipline({ categoryId: (await createFixtureSubjectCategory(app, 'school')).id, gradeLevelId: 'level', academicYearId: 'year', id: 'math', schoolId: 'school', name: 'Mathematics' })),
  )
  const classSubject = await saveClassSubject(app, {
    id: 'class-math',
    classGroupId: 'class',
    subjectId: 'math',
  })

  await app.studentWorkflow.enrollStudent({ id: 'enrollment', studentId: 'student', classGroupId: 'class', enrolledAt: new Date('2026-09-01T00:00:00Z') })

  await app.studentWorkflow.linkGuardianToStudent({ id: 'guardian-link', guardianId: 'guardian', studentId: 'student' })

  const session = await saveLessonSession(app, {
    id: 'lesson',
    schoolId: 'school',
    classGroupId: 'class',
    classSubjectId: classSubject.id,
    displayLabel: 'Fractions',
    startsAt: new Date('2026-09-01T08:00:00Z'),
    endsAt: new Date('2026-09-01T09:00:00Z'),
  })

  // Assign staff to session and subject load
  await saveStaffAssignment(app, {
    id: 'teacher-subject',
    staffId: 'teacher',
    academicYearId: 'year',
    classSubjectId: classSubject.id,
    responsibility: 'teacher',
    permissions: [...ASSIGNMENT_SCOPED_PERMISSIONS],
  })
  await saveStaffAssignment(app, {
    id: 'teacher-class',
    staffId: 'teacher',
    academicYearId: 'year',
    classGroupId: 'class',
    responsibility: 'teacher',
    permissions: [...ASSIGNMENT_SCOPED_PERMISSIONS],
  })
  await saveStaffAssignment(app, {
    id: 'teacher-session',
    staffId: 'teacher',
    academicYearId: 'year',
    lessonSessionId: session.id,
    responsibility: 'teacher',
    permissions: [...ASSIGNMENT_SCOPED_PERMISSIONS],
  })

  await saveFee(app, {
    id: 'tuition',
    schoolId: 'school',
    academicYearId: 'year',
    name: 'Tuition',
    defaultAmount: 90000,
    currency: 'XAF',
  })
  const enrollment = await app.financeWorkflow.enrollStudentInService({
    id: 'student-fee',
    studentId: 'student',
    catalogServiceId: 'tuition',
  })

  await app.accessControlWorkflow.linkActorSubject({ staffMemberId: 'teacher', subjectId: 'teacher-user' })
  await app.accessControlWorkflow.linkActorSubject({ staffMemberId: 'accountant', subjectId: 'accountant-user' })
  await app.accessControlWorkflow.linkActorSubject({ guardianId: 'guardian', subjectId: 'guardian-user' })
  await app.accessControlWorkflow.linkActorSubject({ studentId: 'student', subjectId: 'student-user' })

  return { app, repositories, schoolRepositories, forActor, session, enrollment }
}

describeIntegration('Shared-repository multi-actor concurrency safeguards', () => {
  it('correctly isolates attributions and validates permissions for overlapping concurrent operations', async () => {
    const { repositories, forActor, session } = await createConcurrencyFixture()

    // Instantiate concurrent actor-bound facades
    const teacherApp = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher',
      schoolId: 'school',
      academicYearId: 'year',
      requestId: 'teacher-request-101',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    const accountantApp = forActor(createStaffActorMetadata({
      subjectId: 'accountant-user',
      staffMemberId: 'accountant',
      schoolId: 'school',
      academicYearId: 'year',
      requestId: 'accountant-request-202',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    const guardianApp = forActor(createGuardianActorMetadata({
      subjectId: 'guardian-user',
      guardianId: 'guardian',
      schoolId: 'school',
      academicYearId: 'year',
      requestId: 'guardian-request-303',
      authenticatedAt: new Date(),
    }))

    const studentApp = forActor(createStudentActorMetadata({
      subjectId: 'student-user',
      studentId: 'student',
      schoolId: 'school',
      academicYearId: 'year',
      requestId: 'student-request-404',
      authenticatedAt: new Date(),
    }))

    // Execute multiple overlapping read & write actions concurrently
    const label = async <T>(name: string, operation: Promise<T>): Promise<T> => {
      try {
        return await operation
      }
      catch (error) {
        throw new Error(`${name}: ${error instanceof Error ? error.message : String(error)}`, { cause: error })
      }
    }
    const [attendanceRecord, paymentRecord, _studentDetailResult, feeSummaryResult] = await Promise.all([
      label('teacher attendance', teacherApp.schedulingWorkflow.recordAttendance({
        id: 'concurrent-attendance',
        studentId: 'student',
        lessonSessionId: session.id,
        status: AttendanceStatus.Present,
      })),
      label('accountant payment', accountantApp.financeWorkflow.recordPayment({
        id: 'concurrent-payment',
        studentId: 'student',
        academicYearId: 'year',
        amount: 5000,
        paymentDate: new Date(),
        method: PaymentMethod.Cash,
        allocation: { mode: 'account_only' },
      })),
      label('student attendance list', studentApp.baseService.entities.attendance.list({ studentId: 'student' })),
      label('guardian fee summary', buildFeeSummary(guardianApp, 'student', 'year')),
    ])

    // Verify attributions are perfectly isolated to their respective actors
    expect(attendanceRecord.createdBy).toBe('teacher')
    expect(paymentRecord.recordedById).toBe('accountant')

    // Verify results are accurate and not mixed or leaked
    expect(feeSummaryResult.outstanding.amount).toBe(90000)

    // Verify repository persisted states
    const attendanceRepoRecords = await repositories.attendanceRepository.list({ lessonSessionId: session.id })
    const paymentRepoRecords = await repositories.paymentRepository.list({ academicYearId: 'year' })

    expect(attendanceRepoRecords).toHaveLength(1)
    expect(attendanceRepoRecords[0]?.createdBy).toBe('teacher')
    expect(paymentRepoRecords).toHaveLength(1)
    expect(paymentRepoRecords[0]?.recordedById).toBe('accountant')
  })
})
