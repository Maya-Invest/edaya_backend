import { Permission } from './permission'

/** Permissions derived from `StaffAssignment` rows (class / course / session). */
export const ASSIGNMENT_SCOPED_PERMISSIONS: readonly Permission[] = [
  Permission.GRADE_INPUT,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.DISCIPLINE_CREATE,
]

export const ASSIGNMENT_SCOPED_PERMISSION_SET = new Set(ASSIGNMENT_SCOPED_PERMISSIONS)
