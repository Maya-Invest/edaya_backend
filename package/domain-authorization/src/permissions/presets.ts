import type { GrantScope, StaffPermissionAssignmentInput } from '@edaya/core'
import { Permission, permissionScope, validatePermissionScopes } from '@edaya/core'

export const COORDINATOR_PERMISSIONS: readonly Permission[] = [
  Permission.ACADEMIC_PROGRAM_UPDATE,
  Permission.SCHOOL_LIFECYCLE_MANAGE,
  Permission.CLASS_LOGBOOK_CREATE,
  Permission.CLASS_LOGBOOK_READ,
  Permission.TIMETABLE_UPDATE,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_JUSTIFY,
  Permission.ATTENDANCE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.DISCIPLINE_VALIDATE,
  Permission.DISCIPLINE_READ,
  Permission.RESOURCE_CONFIGURE,
  Permission.RESOURCE_READ,
  Permission.ATTACHMENT_CONFIGURE,
  Permission.ATTACHMENT_READ,
  Permission.EXAM_CONFIG_CONFIGURE,
  Permission.GRADE_INPUT,
  Permission.GRADE_READ,
  Permission.REPORT_CARD_PUBLISH,
  Permission.ENROLLMENT_CREATE,
  Permission.PARENT_UPDATE,
  Permission.STUDENT_UPDATE,
  Permission.STUDENT_HEALTH_READ,
  Permission.STUDENT_HEALTH_UPDATE,
  Permission.CLASS_LOGBOOK_UPDATE,
  Permission.COMMUNICATION_CREATE,
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
  Permission.QUERY_COMMUNICATIONS_READ,
  Permission.QUERY_CALENDAR_READ,
  Permission.QUERY_CURRICULUM_PROGRESS_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_ATTENDANCE_READ,
  Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
  Permission.TIMETABLE_CREATE,
]

export const ACCOUNTANT_PERMISSIONS: readonly Permission[] = [
  Permission.PAYMENT_RECORD,
  Permission.PAYMENT_ALLOCATE,
  Permission.PAYMENT_READ,
  Permission.FINANCIAL_CONFIG_READ,
  Permission.FINANCIAL_CONFIG_CONFIGURE,
  Permission.FINANCIAL_CONFIG_UPDATE,
  Permission.PAYMENT_CANCEL,
  Permission.PAYMENT_REVERSE,
  Permission.FINANCIAL_REPORT_READ,
]

/** Presets populate ordinary grants; a preset name is never stored as authority. */
export function permissionRowsFromPreset(staffId: string, schoolId: string, academicYearId: string, permissions: readonly Permission[], selections: Readonly<Partial<Record<Permission, readonly GrantScope[]>>> = {}): Omit<StaffPermissionAssignmentInput, 'id'>[] {
  return [...new Set(permissions)].flatMap((permission) => {
    const scopes = selections[permission] ?? (permissionScope(permission) === undefined ? [{ kind: 'school' as const }] : undefined)
    if (!scopes)
      return []
    validatePermissionScopes(permission, scopes)
    return [{ staffId, schoolId, academicYearId, permission, scopes: [...scopes], status: 'active' as const }]
  })
}
