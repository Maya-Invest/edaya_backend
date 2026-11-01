import { Permission } from './permission'

/** Default teaching-duty seed bundle. Eligibility is defined by catalog assignmentTargets. */
export const ASSIGNMENT_SCOPED_PERMISSIONS: readonly Permission[] = [
  Permission.GRADE_MANAGE,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_MANAGE,
  Permission.DISCIPLINE_CREATE,
]

export const ASSIGNMENT_SCOPED_PERMISSION_SET = new Set(ASSIGNMENT_SCOPED_PERMISSIONS)
