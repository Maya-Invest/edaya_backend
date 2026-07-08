import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { ENROLLMENT_ACCESS_PERMISSIONS } from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

const studentRosterTeacherRead = {
  anyOf: [
    { capability: TeachingCapability.ReadSubjectRoster, target: 'classSubject' as const },
    { capability: HomeroomCapability.ReadClassRoster, target: 'classGroup' as const },
  ],
}

const enrollmentTeacherRead = {
  anyOf: [
    ...studentRosterTeacherRead.anyOf,
    { capability: TeachingCapability.InputGrade, target: 'classSubject' as const },
    { capability: TeachingCapability.RecordSessionAttendance, target: 'classSubject' as const },
    { capability: TeachingCapability.CreateLogbookEntry, target: 'classSubject' as const },
    { capability: TeachingCapability.UpdateLogbookEntry, target: 'classSubject' as const },
    { capability: TeachingCapability.CreateSubjectDisciplineIncident, target: 'classSubject' as const },
    { capability: HomeroomCapability.RecordDailyAttendance, target: 'classGroup' as const },
  ],
}

export const StudentOperations = defineOperationFamily({
  directoryRead: {
    id: 'students.directory.read',
    staff: {
      anyOf: [
        { permission: Permission.QUERY_STUDENT_DIRECTORY_READ },
        { permission: Permission.QUERY_STUDENT_DETAIL_READ },
      ],
    },
    teacher: studentRosterTeacherRead,
    guardian: { capability: GuardianCapability.ReadStudentDetail, target: 'student' },
    student: { capability: StudentCapability.ReadStudentDetail },
  },
  update: {
    id: 'students.update',
    global: true,
    staff: { permission: Permission.STUDENT_UPDATE },
  },
})

export const GuardianOperations = defineOperationFamily({
  read: {
    id: 'guardians.read',
    staff: { permission: Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ },
    guardian: { capability: GuardianCapability.ReadSelfProfile },
  },
  update: {
    id: 'guardians.update',
    global: true,
    staff: { permission: Permission.PARENT_UPDATE },
  },
})

export const EnrollmentOperations = defineOperationFamily({
  read: {
    id: 'students.enrollment.read',
    staff: {
      anyOf: ENROLLMENT_ACCESS_PERMISSIONS.map(permission => ({ permission })),
    },
    teacher: enrollmentTeacherRead,
    guardian: { capability: GuardianCapability.ReadEnrollmentHistory, target: 'student' },
    student: { capability: StudentCapability.ReadEnrollmentHistory },
  },
  create: {
    id: 'students.enrollment.create',
    global: true,
    staff: { permission: Permission.ENROLLMENT_CREATE },
  },
})

export const StudentHealthOperations = defineOperationFamily({
  read: {
    id: 'students.health.read',
    global: true,
    staff: { permission: Permission.STUDENT_HEALTH_READ },
  },
  update: {
    id: 'students.health.update',
    global: true,
    staff: { permission: Permission.STUDENT_HEALTH_UPDATE },
  },
})
