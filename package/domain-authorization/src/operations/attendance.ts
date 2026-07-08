import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { ATTENDANCE_ACCESS_PERMISSIONS } from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

export const AttendanceOperations = defineOperationFamily({
  read: {
    id: 'attendance.read',
    staff: {
      anyOf: ATTENDANCE_ACCESS_PERMISSIONS.map(permission => ({ permission })),
    },
    guardian: { capability: GuardianCapability.ReadAttendance, target: 'student' },
    student: { capability: StudentCapability.ReadAttendance },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.ReadSubjectAttendance, target: 'classSubject' },
        { capability: HomeroomCapability.ReadClassAttendance, target: 'classGroup' },
      ],
    },
  },
  record: {
    id: 'attendance.record',
    staff: { permission: Permission.ATTENDANCE_RECORD, scopeFrom: 'classGroup' },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.RecordSessionAttendance, target: 'classSubject' },
        { capability: HomeroomCapability.RecordDailyAttendance, target: 'classGroup' },
      ],
    },
  },
})
