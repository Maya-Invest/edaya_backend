import type { DocumentRendererPort, NotificationGatewayPort } from '@edaya/core'
import { AcademicYear, ClassGroup, createInMemoryFileStorage, EnrollmentEndReason, GradeLevel, Guardian, GuardianStudentLink, noOpNotificationGateway, School, Student, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentStatus, withShortName } from '@edaya/core'
import { SchoolService } from '@edaya/service'
import { PostgresCommandJournal } from '../../../../adaptor-postgres/src/stores/command-journal-store'
import { createCurriculumTestApp as createTestApp } from '../../support/create-test-app'
import { createTestStaffActor } from '../../support/test-actor'
import { testFileStorage } from '../../support/test-file-storage'

export async function createStudentTransitionContext({ activeEnrollmentId = 'enr1', existingEnrollmentClassGroupId = 'cg1', studentStatus = StudentStatus.Active, nextClassGroupId = 'cg2', sourceGradeOrder = 1, nextGradeOrder = 2, targetCapacity = 30, targetActiveEnrollmentCount = 0, existingSuccessor = false, notificationGateway = noOpNotificationGateway, documentRenderer }: { documentRenderer?: DocumentRendererPort, notificationGateway?: NotificationGatewayPort, activeEnrollmentId?: string, existingEnrollmentClassGroupId?: string, studentStatus?: StudentStatus, nextClassGroupId?: string, sourceGradeOrder?: number, nextGradeOrder?: number, targetCapacity?: number, targetActiveEnrollmentCount?: number, existingSuccessor?: boolean } = {}) {
  const actor = createTestStaffActor('sch1', 'user1')
  const fixture = await createTestApp(actor, { owner: true, notificationGateway, documentRenderer, ...(documentRenderer ? { fileStorage: createInMemoryFileStorage() } : {}) })
  const repositories = fixture.schoolRepositories
  await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay1', schoolId: 'sch1', name: 'Current', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), status: 'published' })))
  await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay2', schoolId: 'sch1', name: 'Next', startDate: new Date('2026-07-01'), endDate: new Date('2027-06-30') })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'grade1', schoolId: 'sch1', name: 'Grade 1', shortName: '1', order: sourceGradeOrder })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'grade2', schoolId: 'sch1', name: 'Grade 2', shortName: '2', order: nextGradeOrder })))
  await repositories.classGroups.save(new ClassGroup(withShortName({ id: 'cg1', schoolId: 'sch1', academicYearId: 'ay1', gradeLevelId: 'grade1', name: 'Class 1', capacity: 30 })))
  await repositories.classGroups.save(new ClassGroup(withShortName({ id: 'cg2', schoolId: 'sch1', academicYearId: 'ay2', gradeLevelId: 'grade2', name: 'Class 2', capacity: targetCapacity })))
  await repositories.students.save(new Student({ id: 'stu1', schoolId: 'sch1', firstName: 'Ada', lastName: 'Lovelace', birthDate: new Date('2010-01-01'), status: studentStatus }))
  if (activeEnrollmentId) {
    if (activeEnrollmentId !== 'enr1')
      await repositories.enrollments.save(new StudentClassEnrollment({ id: 'enr1', studentId: 'stu1', classGroupId: 'cg1', academicYearId: 'ay1', enrollmentIndex: 1, status: StudentClassEnrollmentStatus.Closed, enrolledAt: new Date('2025-09-01'), endedAt: new Date('2026-01-01'), endReason: EnrollmentEndReason.Transferred, closedBy: 'user1' }))
    await repositories.enrollments.save(new StudentClassEnrollment({ id: activeEnrollmentId, studentId: 'stu1', classGroupId: existingEnrollmentClassGroupId, academicYearId: existingEnrollmentClassGroupId === 'cg2' ? 'ay2' : 'ay1', enrollmentIndex: activeEnrollmentId === 'enr1' ? 1 : 2, enrolledAt: new Date('2025-09-01') }))
  }
  for (let index = 0; index < targetActiveEnrollmentCount; index++) {
    const studentId = `other-student-${index}`
    await repositories.students.save(new Student({ id: studentId, schoolId: 'sch1', firstName: 'Other', lastName: String(index) }))
    await repositories.enrollments.save(new StudentClassEnrollment({ id: `target-enrollment-${index}`, studentId, classGroupId: 'cg2', academicYearId: 'ay2', enrollmentIndex: 1 }))
  }
  if (existingSuccessor)
    await repositories.enrollments.save(new StudentClassEnrollment({ id: 'enr2', studentId: 'stu1', classGroupId: nextClassGroupId, academicYearId: nextClassGroupId === 'cg1' ? 'ay1' : 'ay2', enrollmentIndex: 2, previousEnrollmentId: 'enr1' }))
  return { ...fixture, repositories, service: fixture.app }
}

export async function createStudentAdminContext({ inviteBaseUrl, accountInvitationsEnabled = true }: { inviteBaseUrl?: string, accountInvitationsEnabled?: boolean } = {}) {
  const fixture = await createStudentTransitionContext()
  const { repositories } = fixture
  await repositories.guardians.save(new Guardian({ id: 'gua1', schoolId: 'sch1', firstName: 'Grace', lastName: 'Hopper', subjectId: 'subject-gua1' }))
  await repositories.schools.save(new School(withShortName({ id: 'other-school', name: 'Other', timeZone: 'UTC' })))
  await repositories.academicYears.save(new AcademicYear(withShortName({ id: 'ay-other', schoolId: 'other-school', name: 'Foreign', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), status: 'published' })))
  await repositories.gradeLevels.save(new GradeLevel(withShortName({ id: 'grade-other', schoolId: 'other-school', name: 'Foreign', shortName: 'F', order: 1 })))
  await repositories.classGroups.save(new ClassGroup(withShortName({ id: 'cg-other', schoolId: 'other-school', academicYearId: 'ay-other', gradeLevelId: 'grade-other', name: 'Foreign' })))
  const service = new SchoolService({ commandJournal: new PostgresCommandJournal(), repositories, actor: createTestStaffActor('sch1', 'user1'), atomicExecution: fixture.atomicExecution, notificationGateway: noOpNotificationGateway, fileStorage: testFileStorage, inviteBaseUrl, accountInvitationsEnabled })
  return { ...repositories, service }
}

export async function createGuardianLinkContext({ existingLink = false, enrolledInSchool = true, guardianSchoolId = 'sch1', studentSchoolId = 'sch1' }: { existingLink?: boolean, enrolledInSchool?: boolean, guardianSchoolId?: string, studentSchoolId?: string } = {}) {
  const fixture = await createStudentAdminContext()
  const existingCreatedAt = new Date('2026-01-01T00:00:00Z')
  const guardian = (await fixture.guardians.findById('gua1'))!
  await fixture.guardians.save(new Guardian({ ...guardian.data, schoolId: guardianSchoolId }))
  const student = (await fixture.students.findById('stu1'))!
  await fixture.students.save(new Student({ ...student.data, schoolId: studentSchoolId }))
  if (!enrolledInSchool)
    await fixture.enrollments.delete('enr1')
  if (existingLink)
    await fixture.guardianLinks.save(new GuardianStudentLink({ id: 'link-existing', schoolId: guardianSchoolId, guardianId: 'gua1', studentId: 'stu1', relationship: 'parent', createdAt: existingCreatedAt }))
  return { repositories: fixture, service: fixture.service, existingCreatedAt }
}
