import type { GrantScope, StaffPermissionAssignmentInput } from '@edaya/core'
import { corePermissionDefinition, Permission, validatePermissionScopes } from '@edaya/core'

export const COORDINATOR_PERMISSIONS: readonly Permission[] = [
  Permission.ACADEMIC_CATALOG_READ,
  Permission.ACTIVITY_READ,
  Permission.ACTIVITY_CREATE,
  Permission.ACTIVITY_MANAGE,
  Permission.ACTIVITY_ENROLLMENT_MANAGE,
  Permission.REPORT_CARD_COMMENT,
  Permission.REPORT_CARD_REVIEW_COMMENTS,
  Permission.REPORT_CARD_EXPORT,
  Permission.RESOURCE_ASSIGNMENT_READ,
  Permission.RESOURCE_ASSIGNMENT_MANAGE,
  Permission.ACADEMIC_PROGRAM_MANAGE,
  Permission.SCHOOL_LIFECYCLE_MANAGE,
  Permission.CLASS_LOGBOOK_MANAGE,
  Permission.CLASS_LOGBOOK_READ,
  Permission.TIMETABLE_MANAGE,
  Permission.ATTENDANCE_RECORD,
  Permission.ATTENDANCE_MANAGE,
  Permission.ATTENDANCE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.DISCIPLINE_VALIDATE,
  Permission.DISCIPLINE_READ,
  Permission.RESOURCE_CONFIGURE,
  Permission.RESOURCE_READ,
  Permission.ATTACHMENT_CONFIGURE,
  Permission.ATTACHMENT_READ,
  Permission.ASSESSMENT_MANAGE,
  Permission.GRADE_MANAGE,
  Permission.GRADE_READ,
  Permission.REPORT_CARD_PUBLISH,
  Permission.DOCUMENT_VOID,
  Permission.ENROLLMENT_MANAGE,
  Permission.PARENT_MANAGE,
  Permission.STUDENT_MANAGE,
  Permission.STUDENT_HEALTH_READ,
  Permission.STUDENT_HEALTH_UPDATE,
  Permission.COMMUNICATION_DRAFT_MANAGE,
  Permission.STUDENT_READ,
  Permission.ENROLLMENT_READ,
  Permission.REPORT_CARD_READ,
  Permission.TIMETABLE_READ,
  Permission.CLASS_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.PARENT_READ,
]

export const ACCOUNTANT_PERMISSIONS: readonly Permission[] = [
  Permission.PAYMENT_RECORD,
  Permission.PAYMENT_ALLOCATE,
  Permission.PAYMENT_READ,
  Permission.FINANCIAL_CONFIG_READ,
  Permission.FINANCIAL_CATALOG_MANAGE,
  Permission.PAYMENT_CANCEL,
  Permission.PAYMENT_REVERSE,
  Permission.FINANCIAL_REPORT_READ,
]

/** Presets populate ordinary grants; a preset name is never stored as authority. */
export function permissionRowsFromPreset(staffId: string, schoolId: string, academicYearId: string, permissions: readonly Permission[], selections: Readonly<Partial<Record<Permission, readonly GrantScope[]>>> = {}): Omit<StaffPermissionAssignmentInput, 'id'>[] {
  return [...new Set(permissions)].flatMap((permission) => {
    const definition = corePermissionDefinition(permission)
    if (!definition.staffAssignable)
      return []
    const scopes = selections[permission] ?? (definition.scopePolicy.mode === 'none' ? [{ kind: 'school' as const }] : undefined)
    if (!scopes)
      return []
    validatePermissionScopes(permission, scopes)
    return [{ staffId, schoolId, academicYearId, permission, scopes: [...scopes], status: 'active' as const }]
  })
}
