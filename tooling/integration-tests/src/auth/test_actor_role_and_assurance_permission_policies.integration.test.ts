import { ACCOUNTANT_PERMISSIONS, ActorAssuranceLevel, ASSIGNMENT_SCOPED_PERMISSIONS, AuthorizationErrorCode, COORDINATOR_PERMISSIONS, createStaffActorMetadata, Permission } from '@edaya/authorization'
import { AcademicPeriodType, AttendanceStatus, GradeLevel, School, StaffMember, Subject } from '@edaya/core'
import { expect, it } from 'bun:test'
import { describeIntegration } from '../support/suite-runner'
import { createAcademicPeriod, createClassGroup, publishAcademicPeriod, saveClassSubject, saveFee, saveGuardian, saveLessonSession, saveSchool, saveStaffAssignment, saveStaffMember, saveStudent, seedStaffPermissionTemplate, updateSchool, withFixtureDiscipline } from '../utils/core-service-helpers'
import { createTestApp } from '../utils/test-adapter'

const STAFF_TEACHING_WRITE_TEST_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_LOGBOOK_MANAGE,
  Permission.ATTENDANCE_RECORD,
  Permission.DISCIPLINE_CREATE,
  Permission.GRADE_MANAGE,
  Permission.CLASS_LOGBOOK_MANAGE,
]

async function setupBaselineFixture() {
  const { app, repositories, schoolRepositories, forActor } = await createTestApp()

  // Standard Admin setup of tenant school
  await saveSchool(app, { id: 'school', name: 'Authority Academy', timeZone: 'UTC', financeCurrency: 'USD' })
  await app.setupWorkflow.createAcademicYear({
    id: 'acad-year',
    schoolId: 'school',
    name: '2026-2027',
    startDate: new Date('2026-09-01T00:00:00Z'),
    endDate: new Date('2027-06-30T00:00:00Z'),
  })
  await app.baseService.entities.gradeLevels.save(
    new GradeLevel({ id: 'grade-7', schoolId: 'school', name: 'Grade 7', label: 'G7', order: 7 }),
  )
  await createClassGroup(app, {
    id: 'class-7a',
    schoolId: 'school',
    academicYearId: 'acad-year',
    gradeLevelId: 'grade-7',
    name: 'Grade 7 A',
  })

  // Create staff members
  await saveStaffMember(app, {
    id: 'coordinator-staff',
    schoolId: 'school',
    firstName: 'Alice',
    lastName: 'Smith',
  })
  await saveStaffMember(app, {
    id: 'teacher-staff',
    schoolId: 'school',
    firstName: 'Bob',
    lastName: 'Jones',
  })
  await saveStaffMember(app, {
    id: 'accountant-staff',
    schoolId: 'school',
    firstName: 'Charlie',
    lastName: 'Brown',
  })
  await seedStaffPermissionTemplate(schoolRepositories, {
    staffId: 'coordinator-staff',
    schoolId: 'school',
    academicYearId: 'acad-year',
    permissions: COORDINATOR_PERMISSIONS,
    idPrefix: 'spa-coordinator',
  })
  await seedStaffPermissionTemplate(schoolRepositories, {
    staffId: 'teacher-staff',
    schoolId: 'school',
    academicYearId: 'acad-year',
    permissions: STAFF_TEACHING_WRITE_TEST_PERMISSIONS,
    idPrefix: 'spa-teacher',
  })
  await seedStaffPermissionTemplate(schoolRepositories, {
    staffId: 'accountant-staff',
    schoolId: 'school',
    academicYearId: 'acad-year',
    permissions: ACCOUNTANT_PERMISSIONS,
    idPrefix: 'spa-accountant',
  })

  // Create students & guardians
  await saveStudent(app, { id: 'active-student', schoolId: 'school', firstName: 'Daniel', lastName: 'Craig' })
  await saveGuardian(app, { id: 'active-guardian', schoolId: 'school', firstName: 'Eva', lastName: 'Craig' })

  // Academics setup
  await app.baseService.entities.subjects.save(
    new Subject(withFixtureDiscipline({ gradeLevelId: 'grade-7', academicYearId: 'acad-year', id: 'english-lit', schoolId: 'school', name: 'English Literature' })),
  )
  const classSubject = await saveClassSubject(app, {
    id: 'class-subject-english',
    classGroupId: 'class-7a',
    subjectId: 'english-lit',
  })

  await saveStaffAssignment(app, {
    id: 'assignment-1',
    staffId: 'teacher-staff',
    academicYearId: 'acad-year',
    classSubjectId: classSubject.id,
    responsibility: 'teacher',
    permissions: [...ASSIGNMENT_SCOPED_PERMISSIONS],
  })

  await saveStaffAssignment(app, {
    id: 'teacher-class-assign',
    staffId: 'teacher-staff',
    academicYearId: 'acad-year',
    classGroupId: 'class-7a',
    responsibility: 'teacher',
    permissions: [...ASSIGNMENT_SCOPED_PERMISSIONS],
  })

  // Create session
  await app.studentWorkflow.enrollStudent({ id: 'enroll-1', studentId: 'active-student', classGroupId: 'class-7a', enrolledAt: new Date('2026-09-01T00:00:00Z') })

  await app.studentWorkflow.linkGuardianToStudent({ id: 'link-1', guardianId: 'active-guardian', studentId: 'active-student' })

  const session = await saveLessonSession(app, {
    id: 'active-session',
    schoolId: 'school',
    classGroupId: 'class-7a',
    classSubjectId: classSubject.id,
    displayLabel: 'Poetry',
    startsAt: new Date('2026-09-01T08:00:00Z'),
    endsAt: new Date('2026-09-01T09:00:00Z'),
  })

  // Assign teacher to session
  await saveStaffAssignment(app, {
    id: 'staff-session-1',
    staffId: 'teacher-staff',
    academicYearId: 'acad-year',
    lessonSessionId: session.id,
    responsibility: 'teacher',
    permissions: [...ASSIGNMENT_SCOPED_PERMISSIONS],
  })

  for (const [staffMemberId, subjectId] of [['coordinator-staff', 'coord-user'], ['teacher-staff', 'teacher-user'], ['accountant-staff', 'acct-user']])
    await app.accessControlWorkflow.linkActorSubject({ staffMemberId, subjectId })

  return { app, repositories, schoolRepositories, forActor, classSubject, session }
}

describeIntegration('Actor Role and Assurance Permission Policies', () => {
  it('enforces explicit allow and deny actions per staff role', async () => {
    const { app, forActor } = await setupBaselineFixture()

    // 1. Coordinator Actor
    const coordApp = forActor(createStaffActorMetadata({
      subjectId: 'coord-user',
      staffMemberId: 'coordinator-staff',
      schoolId: 'school',
      academicYearId: 'acad-year',
      requestId: 'req-coord',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    // Create an unpublished period using admin app
    const unpub = await createAcademicPeriod(app, {
      id: 'coord-term',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    })

    // Coordinators can publish academic periods
    const period = await publishAcademicPeriod(coordApp, unpub.id)
    expect(period.isPublished).toBe(true)

    // Coordinators are denied registering another school
    await expect(saveSchool(coordApp, {
      id: 'second-school',
      name: 'Second Academy',
      timeZone: 'UTC',
    })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    // Coordinators are denied financial mutations
    await expect(saveFee(coordApp, {
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
      academicYearId: 'acad-year',
      requestId: 'req-acct',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Verified,
    }))

    // Accountants can create catalog services
    const fee = await saveFee(accountantApp, {
      id: 'tuition-fee',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Tuition',
      defaultAmount: 50000,
      currency: 'USD',
    })
    expect(fee.id).toBe('tuition-fee')

    // Accountants are denied schedule or class creations
    await expect(createClassGroup(accountantApp, {
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
      academicYearId: 'acad-year',
      requestId: 'req-teacher',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))

    // Teachers can record attendance for their sessions
    const attendance = await teacherApp.schedulingWorkflow.recordAttendance({
      id: 'attendance-1',
      studentId: 'active-student',
      lessonSessionId: 'active-session',
      status: AttendanceStatus.Present,
    })
    expect(attendance.id).toBe('attendance-1')

    // Teachers are denied managing the academic setup configuration
    await expect(updateSchool(teacherApp, {
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
      academicYearId: 'acad-year',
      requestId: 'req-standard',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))

    const verifiedAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'admin-user',
      staffMemberId: 'admin',
      schoolId: 'school',
      academicYearId: 'acad-year',
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
    }))

    const strongForeignAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'strong-admin-user',
      staffMemberId: 'strong-admin',
      schoolId: 'strong-school',
      requestId: 'req-strong-foreign',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))

    // Create an unpublished period first
    const unpublishedPeriod = await createAcademicPeriod(app, {
      id: 'elevated-term',
      schoolId: 'school',
      academicYearId: 'acad-year',
      name: 'Term 1',
      type: AcademicPeriodType.Trimester,
      startDate: new Date('2026-09-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    })

    // elevated lifecycle setups require Verified or Strong
    await expect(publishAcademicPeriod(standardAdminApp, unpublishedPeriod.id))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })

    const verifiedPeriod = await publishAcademicPeriod(verifiedAdminApp, unpublishedPeriod.id)
    expect(verifiedPeriod.isPublished).toBe(true)

    // school staff never receive platform registration authority from school role grants
    await expect(strongForeignAdminApp.setupWorkflow.registerSchool({ id: 'new-school', name: 'New school', timeZone: 'UTC' })).rejects.toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })

  it('guarantees denied-mutation rollback and holds strict tenant boundaries', async () => {
    const { forActor, schoolRepositories, repositories } = await setupBaselineFixture()

    // 1. Denied Mutation rollback guarantee
    const unauthorizedTeacherApp = forActor(createStaffActorMetadata({
      subjectId: 'teacher-user',
      staffMemberId: 'teacher-staff',
      schoolId: 'school',
      academicYearId: 'acad-year',
      requestId: 'req-unauth',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Standard,
    }))

    const initialAcademicYearCount = await repositories.academicYearRepository.count()

    await expect(unauthorizedTeacherApp.setupWorkflow.createAcademicYear({
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

    await schoolRepositories.schools.save(new School({ id: 'foreign-school', name: 'Foreign', timeZone: 'UTC', ownerSubjectId: 'foreign-admin-user' }))
    await schoolRepositories.staffMembers.save(new StaffMember({ id: 'foreign-admin', schoolId: 'foreign-school', subjectId: 'foreign-admin-user', firstName: 'Foreign', lastName: 'Owner' }))

    // 2. Strict Tenant boundary check
    const foreignAdminApp = forActor(createStaffActorMetadata({
      subjectId: 'foreign-admin-user',
      staffMemberId: 'foreign-admin',
      schoolId: 'foreign-school',
      requestId: 'req-foreign',
      authenticatedAt: new Date(),
      assuranceLevel: ActorAssuranceLevel.Strong,
    }))

    // Scoped ID reads do not retrieve or disclose records from another school.
    await expect(foreignAdminApp.baseService.entities.students.findById('active-student'))
      .resolves
      .toBeUndefined()

    await expect(foreignAdminApp.baseService.entities.classGroups.list({ schoolId: 'school' }))
      .rejects
      .toMatchObject({ code: AuthorizationErrorCode.Forbidden })
  })
})
