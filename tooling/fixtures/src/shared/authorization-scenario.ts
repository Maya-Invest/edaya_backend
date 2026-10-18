import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { AcademicYear, ClassGroup, ClassSubject, GradeLevel, Guardian, GuardianStudentLink, Permission, School, StaffMember, StaffPermissionAssignment, Student, StudentClassEnrollment, Subject, Teacher, TeacherAssignment, TeacherAssignmentKind } from '@edaya/core'

/** Fresh synthetic data only; persistence belongs to the consuming harness or admitted seed workflow. */
export function createAuthorizationScenario() {
  const createdAt = new Date('2026-01-01T00:00:00Z')
  const ids = {
    school: 'v1-school-a',
    foreignSchool: 'v1-school-b',
    year: 'v1-year-a',
    foreignYear: 'v1-year-b',
    class: 'v1-class-a',
    unrelatedClass: 'v1-class-other',
    foreignClass: 'v1-class-b',
    child: 'v1-child-a',
    sibling: 'v1-child-sibling',
    unrelatedChild: 'v1-child-other',
    foreignChild: 'v1-child-b',
    guardian: 'v1-guardian-a',
    coGuardian: 'v1-guardian-co',
    unrelatedGuardian: 'v1-guardian-other',
    disabledGuardian: 'v1-guardian-disabled',
    foreignGuardian: 'v1-guardian-b',
    owner: 'v1-owner',
    staff: 'v1-scoped-staff',
    teacher: 'v1-teacher',
    unassignedTeacher: 'v1-teacher-unassigned',
    sharedSubject: 'v1-multiple-profile-subject',
  }
  const schools = [new School({ id: ids.school, name: 'Synthetic school A', timeZone: 'UTC', ownerSubjectId: ids.sharedSubject, createdAt }), new School({ id: ids.foreignSchool, name: 'Synthetic school B', timeZone: 'UTC', createdAt })]
  const academicYears = schools.map((school, index) => new AcademicYear({ id: index ? ids.foreignYear : ids.year, schoolId: school.id, name: '2026 fixture', startDate: createdAt, endDate: new Date('2026-12-31T23:59:59Z'), status: 'published', createdAt }))
  const gradeLevels = schools.map(school => new GradeLevel({ id: `${school.id}-level`, schoolId: school.id, name: 'Fixture level', label: 'F', order: 1, createdAt }))
  const classGroups = [ids.class, ids.unrelatedClass, ids.foreignClass].map((id, index) => new ClassGroup({ id, schoolId: index === 2 ? ids.foreignSchool : ids.school, academicYearId: index === 2 ? ids.foreignYear : ids.year, gradeLevelId: gradeLevels[index === 2 ? 1 : 0]!.id, name: id, createdAt }))
  const staffMembers = [new StaffMember({ id: ids.owner, schoolId: ids.school, firstName: 'Owner', lastName: 'Fixture', subjectId: ids.sharedSubject, createdAt }), new StaffMember({ id: ids.staff, schoolId: ids.school, firstName: 'Scoped', lastName: 'Fixture', subjectId: `${ids.staff}-subject`, createdAt })]
  const students = [ids.child, ids.sibling, ids.unrelatedChild, ids.foreignChild].map((id, index) => new Student({ id, schoolId: index === 3 ? ids.foreignSchool : ids.school, firstName: id, lastName: 'Fixture', subjectId: index === 0 ? ids.sharedSubject : `${id}-subject`, createdAt }))
  const enrollments = students.map((student, index) => new StudentClassEnrollment({ id: `${student.id}-enrollment`, studentId: student.id, classGroupId: index < 2 ? ids.class : index === 2 ? ids.unrelatedClass : ids.foreignClass, academicYearId: index === 3 ? ids.foreignYear : ids.year, enrollmentIndex: 1, enrolledAt: createdAt, createdAt }))
  const guardians = [ids.guardian, ids.coGuardian, ids.unrelatedGuardian, ids.disabledGuardian, ids.foreignGuardian].map((id, index) => new Guardian({ id, schoolId: index === 4 ? ids.foreignSchool : ids.school, firstName: id, lastName: 'Fixture', subjectId: index === 0 ? ids.sharedSubject : `${id}-subject`, hasAccess: id !== ids.disabledGuardian, createdAt }))
  const guardianLinks = [[ids.guardian, ids.child], [ids.guardian, ids.sibling], [ids.coGuardian, ids.child], [ids.disabledGuardian, ids.child], [ids.unrelatedGuardian, ids.unrelatedChild], [ids.foreignGuardian, ids.foreignChild]].map(([guardianId, studentId]) => new GuardianStudentLink({ id: `${guardianId}-${studentId}`, guardianId: guardianId!, studentId: studentId!, schoolId: guardianId === ids.foreignGuardian ? ids.foreignSchool : ids.school, createdAt }))
  const teachers = [new Teacher({ id: ids.teacher, schoolId: ids.school, firstName: 'Assigned', lastName: 'Fixture', subjectId: ids.sharedSubject, createdAt }), new Teacher({ id: ids.unassignedTeacher, schoolId: ids.school, firstName: 'Unassigned', lastName: 'Fixture', subjectId: `${ids.unassignedTeacher}-subject`, createdAt })]
  const subjects = [new Subject({ gradeLevelId: gradeLevels[0]!.id, academicYearId: ids.year, id: 'v1-math', schoolId: ids.school, name: 'Fixture math', createdAt })]
  const classSubjects = [new ClassSubject({ id: 'v1-class-math', classGroupId: ids.class, subjectId: subjects[0]!.id, createdAt })]
  const teacherAssignments = [new TeacherAssignment({ id: 'v1-teaching', teacherId: ids.teacher, academicYearId: ids.year, kind: TeacherAssignmentKind.Subject, classSubjectId: classSubjects[0]!.id, createdAt })]
  const staffPermissionAssignments = [new StaffPermissionAssignment({ id: 'v1-student-read', staffId: ids.staff, schoolId: ids.school, academicYearId: ids.year, permission: Permission.STUDENT_READ, scopes: [{ kind: 'student', studentId: ids.child }, { kind: 'student', studentId: ids.sibling }], createdAt })]
  const context = { schoolId: ids.school, academicYearId: ids.year, requestId: 'v1-authorization-fixture', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Strong }
  const actors = {
    owner: createStaffActorMetadata({ ...context, staffMemberId: ids.owner, subjectId: ids.sharedSubject }),
    scopedStaff: createStaffActorMetadata({ ...context, staffMemberId: ids.staff, subjectId: `${ids.staff}-subject` }),
    teacher: createTeacherActorMetadata({ ...context, teacherId: ids.teacher, subjectId: ids.sharedSubject }),
    unassignedTeacher: createTeacherActorMetadata({ ...context, teacherId: ids.unassignedTeacher, subjectId: `${ids.unassignedTeacher}-subject` }),
    guardian: createGuardianActorMetadata({ ...context, guardianId: ids.guardian, subjectId: ids.sharedSubject }),
    coGuardian: createGuardianActorMetadata({ ...context, guardianId: ids.coGuardian, subjectId: `${ids.coGuardian}-subject` }),
    unrelatedGuardian: createGuardianActorMetadata({ ...context, guardianId: ids.unrelatedGuardian, subjectId: `${ids.unrelatedGuardian}-subject` }),
    disabledGuardian: createGuardianActorMetadata({ ...context, guardianId: ids.disabledGuardian, subjectId: `${ids.disabledGuardian}-subject` }),
    foreignGuardian: createGuardianActorMetadata({ ...context, schoolId: ids.foreignSchool, academicYearId: ids.foreignYear, guardianId: ids.foreignGuardian, subjectId: `${ids.foreignGuardian}-subject` }),
    student: createStudentActorMetadata({ ...context, studentId: ids.child, subjectId: ids.sharedSubject }),
  }
  return { ids, actors, schools, academicYears, gradeLevels, classGroups, staffMembers, students, enrollments, guardians, guardianLinks, teachers, subjects, classSubjects, teacherAssignments, staffPermissionAssignments }
}
