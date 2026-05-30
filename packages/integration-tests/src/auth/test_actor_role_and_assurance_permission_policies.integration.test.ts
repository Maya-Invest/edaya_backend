import {
  AcademicPeriodType,
  ActorAssuranceLevel,
  AttendanceStatus,
  AuthorizationErrorCode,
  createStaffActorMetadata,
  SessionKind,
  StaffMember,
  StaffRole,
} from '@edaya/core'
import { expect, it } from 'bun:test'
import { createTestApp } from '../support/in-memory-school-headless-app'
import { describeIntegration } from '../support/suite-runner'

async function setupBaselineFixture() {
  const { app, repositories, forActor } = createTestApp()

  // Standard Admin setup of tenant school
  await app.setup.registerSchool({ id: 'school', name: 'Authority Academy', timeZone: 'UTC' })
  await app.setup.createAcademicYear({
    id: 'acad-year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.setup.createGradeLevel({ id: 'grade-7', schoolId: 'school', name: 'Grade 7', order: 7 })
  await app.setup.createClassGroup({
    id: 'class-7a',
    schoolId: 'school',
    academicYearId: 'acad-year',
    gradeLevelId: 'grade-7',
    name: 'Grade 7 A',
  })

  // Create staff members
  await app.setup.registerStaffMember({
    id: 'coordinator-staff',
    schoolId: 'school',
    firstName: 'Alice',
    lastName: 'Smith',
    roles: [StaffRole.Coordinator],
  })
  await app.setup.registerStaffMember({
    id: 'teacher-staff',
    schoolId: 'school',
    firstName: 'Bob',
    lastName: 'Jones',
    roles: [StaffRole.Teacher],
  })
  await app.setup.registerStaffMember({
    id: 'accountant-staff',
    schoolId: 'school',
    firstName: 'Charlie',
    lastName: 'Brown',
    roles: [StaffRole.Accountant],
  })

  // Create students & guardians
  await app.students.registerStudent({ id: 'active-student', schoolId: 'school', firstName: 'Daniel', lastName: 'Craig' })
  await app.students.enrollStudent({ id: 'enroll-1', studentId: 'active-student', classGroupId: 'class-7a' })
  await app.students.registerGuardian({ id: 'active-guardian', schoolId: 'school', firstName: 'Eva', lastName: 'Craig' })
  await app.students.linkGuardianToStudent({ id: 'link-1', guardianId: 'active-guardian', studentId: 'active-student' })

  // Academics setup
  await app.academics.createSubject({ id: 'english-lit', schoolId: 'school', name: 'English Literature' })
  const classSubject = await app.academics.offerSubjectToClass({
    id: 'class-subject-english',
    classGroupId: 'class-7a',
    subjectId: 'english-lit',
  })

  await app.setup.assignStaffToClassSubject({
    id: 'assignment-1',
    staffId: 'teacher-staff',
    classSubjectId: classSubject.id,
    role: StaffRole.Teacher,
  })

  await app.setup.assignStaffToClass({
    id: 'teacher-class-assign',
    staffId: 'teacher-staff',
    classGroupId: 'class-7a',
    role: StaffRole.Teacher,
  })

  // Create session
  const session = await app.scheduling.createSession({
    id: 'active-session',
    schoolId: 'school',
    classGroupId: 'class-7a',
    classSubjectId: classSubject.id,
    title: 'Poetry',
    kind: SessionKind.Course,
    startsAt: new Date('2026-09-01T08:00:00Z'),
    endsAt: new Date('2026-09-01T09:00:00Z'),
  })

  // Assign teacher to session
  await app.setup.assignStaffToSession({
    id: 'staff-session-1',
    staffId: 'teacher-staff',
    sessionId: session.id,
    role: StaffRole.Teacher,
  })

  return { app, repositories, forActor, classSubject, session }
}

describeIntegration('Actor Role and Assurance Permission Policies', () => {
  it('enforces explicit allow and deny actions per staff role', async () => {
    const { app, forActor } = await setupBaselineFixture()

    // 1. Coordinator Actor
    const coordApp = forActor(createStaffActorMetadata({
      subjectId: 'coord-user',
      staffMemberId: 'coordinator-staff',
      schoolId: 'school',
      roles: [StaffRole.Coordinator],
      requestId: 'req-coord',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    // Create an unpublished period using admin app
    const unpub = await app.setup.createAcademicPeriod({
      id: 'coord-term',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    })

    // Coordinators can publish academic periods
    const period = await coordApp.setup.publishAcademicPeriod({
      academicPeriodId: unpub.id,
    })
    expect(period.isPublished).toBe(true)

    // Coordinators are denied registering another school
    await expect(coordApp.setup.registerSchool({
      id: 'second-school',
      name: 'Second Academy',
      timeZone: 'UTC',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    // Coordinators are denied financial mutations
    await expect(coordApp.finance.createFee({
      id: 'tuition-fee',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Tuition',
      defaultAmount: 50000,
      currency: 'USD',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    // 2. Accountant Actor
    const accountantApp = forActor(createStaffActorMetadata({
      subjectId: 'acct-user',
      staffMemberId: 'accountant-staff',
      schoolId: 'school',
      roles: [StaffRole.Accountant],
      requestId: 'req-acct',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    // Accountants can create fees
    const fee = await accountantApp.finance.createFee({
      id: 'tuition-fee',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Tuition',
      defaultAmount: 50000,
      currency: 'USD',
    })
    expect(fee.id).toBe('tuition-fee')

    // Accountants are denied schedule or class creations
    await expect(accountantApp.setup.createClassGroup({
      id: 'another-class',
      schoolId: 'school',
      academicYearId: 'acad-year',
      gradeLevelId: 'grade-7',
      name: 'Grade 7 B',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    // 3. Teacher Actor
    const teacherApp = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-staff',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'req-teacher',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))

    // Teachers can record attendance for their sessions
    const attendance = await teacherApp.scheduling.recordAttendance({
      id: 'attendance-1',
      studentId: 'active-student',
      sessionId: 'active-session',
      status: AttendanceStatus.Present,
    })
    expect(attendance.id).toBe('attendance-1')

    // Teachers are denied managing the academic setup configuration
    await expect(teacherApp.setup.updateSchoolConfiguration({
      schoolId: 'school',
      name: 'Malicious Rename',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })

  it('enforces ActorAssuranceLevel criteria for elevated operations', async () => {
    const { app, forActor, repositories } = await setupBaselineFixture()

    const standardAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'admin-user',
      staffMemberId: 'admin',
      schoolId: 'school',
      roles: [StaffRole.Admin],
      requestId: 'req-standard',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))

    const verifiedAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'admin-user',
      staffMemberId: 'admin',
      schoolId: 'school',
      roles: [StaffRole.Admin],
      requestId: 'req-verified',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    // Create strong-admin staff member in the staff repository
    await repositories.staffMemberRepository.save(new StaffMember({
      id: 'strong-admin',
      schoolId: 'strong-school',
      firstName: 'Strong',
      lastName: 'Admin',
      roles: [StaffRole.Admin],
    }))

    const verifiedForeignAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'strong-admin-user',
      staffMemberId: 'strong-admin',
      schoolId: 'strong-school',
      roles: [StaffRole.Admin],
      requestId: 'req-verified-foreign',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    const strongForeignAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'strong-admin-user',
      staffMemberId: 'strong-admin',
      schoolId: 'strong-school',
      roles: [StaffRole.Admin],
      requestId: 'req-strong-foreign',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))

    // Create an unpublished period first
    const unpublishedPeriod = await app.setup.createAcademicPeriod({
      id: 'elevated-term',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    })

    // elevated lifecycle setups require Verified or Strong
    await expect(standardAdminApp.setup.publishAcademicPeriod({
      academicPeriodId: unpublishedPeriod.id,
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    const verifiedPeriod = await verifiedAdminApp.setup.publishAcademicPeriod({
      academicPeriodId: unpublishedPeriod.id,
    })
    expect(verifiedPeriod.isPublished).toBe(true)

    // school registration requires Strong assurance
    await expect(verifiedForeignAdminApp.setup.registerSchool({
      id: 'strong-school',
      name: 'Strong school',
      timeZone: 'UTC',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    const strongSchool = await strongForeignAdminApp.setup.registerSchool({
      id: 'strong-school',
      name: 'Strong school',
      timeZone: 'UTC',
    })
    expect(strongSchool.id).toBe('strong-school')
  })

  it('guarantees denied-mutation rollback and holds strict tenant boundaries', async () => {
    const { forActor, repositories } = await setupBaselineFixture()

    // 1. Denied Mutation rollback guarantee
    const unauthorizedTeacherApp = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-staff',
      schoolId: 'school',
      roles: [StaffRole.Teacher],
      requestId: 'req-unauth',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))

    const initialAcademicYearCount = await repositories.academicYearRepository.count()

    await expect(unauthorizedTeacherApp.setup.createAcademicYear({
      id: 'illegal-year',
      schoolId: 'school',
      name: '2028-2029',
      startDate: new Date('2028-09-01T00:00:00Z'),
      endDate: new Date('2029-06-30T00:00:00Z'),
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    // Verify no mutation occurred in the repository
    const postAcademicYearCount = await repositories.academicYearRepository.count()
    expect(postAcademicYearCount).toBe(initialAcademicYearCount)
    const checkYear = await repositories.academicYearRepository.findById('illegal-year')
    expect(checkYear).toBeUndefined()

    // 2. Strict Tenant boundary check
    const foreignAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'foreign-admin-user',
      staffMemberId: 'foreign-admin',
      schoolId: 'foreign-school',
      roles: [StaffRole.Admin],
      requestId: 'req-foreign',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))

    // Foreign actor attempting to query local school data gets Forbidden
    await expect(foreignAdminApp.queries.students.findById('active-student'))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    await expect(foreignAdminApp.queries.classGroups.list({ schoolId: 'school' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })
})
