import { GuardianCapability } from '../capabilities/guardian-capability'
import { HomeroomCapability } from '../capabilities/homeroom-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { TeachingCapability } from '../capabilities/teaching-capability'
import { Permission } from '../permissions/permission'
import { TIMETABLE_ACCESS_PERMISSIONS } from '../policy/resolvers/permission-sets'
import { defineOperationFamily } from './define-operation'

export const SchedulingOperations = defineOperationFamily({
  calendarRead: {
    id: 'scheduling.calendar.read',
    staff: { permission: Permission.QUERY_CALENDAR_READ },
    guardian: { capability: GuardianCapability.ReadCalendar, target: 'student' },
    student: { capability: StudentCapability.ReadCalendar },
  },
  calendarManage: {
    id: 'scheduling.calendar.manage',
    global: true,
    staff: { permission: Permission.TIMETABLE_UPDATE },
  },
  timetableRead: {
    id: 'scheduling.timetable.read',
    staff: {
      anyOf: TIMETABLE_ACCESS_PERMISSIONS.map(permission => ({ permission })),
    },
    guardian: { capability: GuardianCapability.ReadTimetable, target: 'student' },
    student: { capability: StudentCapability.ReadTimetable },
    teacher: {
      anyOf: [
        { capability: TeachingCapability.ReadSubjectTimetable, target: 'classSubject' },
        { capability: HomeroomCapability.ReadClassTimetable, target: 'classGroup' },
      ],
    },
  },
  timetableManage: {
    id: 'scheduling.timetable.manage',
    requiresContext: ['classGroupId'],
    staff: { permission: Permission.TIMETABLE_UPDATE, scopeFrom: 'classGroup' },
  },
  timetableCreate: {
    id: 'scheduling.timetable.create',
    requiresContext: ['classGroupId'],
    staff: { permission: Permission.TIMETABLE_CREATE, scopeFrom: 'classGroup' },
  },
  timetablePublish: {
    id: 'scheduling.timetable.publish',
    requiresContext: ['classGroupId'],
    staff: { permission: Permission.TIMETABLE_UPDATE, scopeFrom: 'classGroup' },
  },
})
