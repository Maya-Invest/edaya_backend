import { Permission } from '../permissions/permission'

export type PortalActorKind = 'guardian' | 'student'

export interface PortalPermissionPolicy {
  readonly actorKind: PortalActorKind
  readonly permissions: ReadonlySet<Permission>
}

/** Read-only portal permissions for guardians. */
export const GUARDIAN_PORTAL_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.QUERY_GUARDIAN_SELF_READ,
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.ATTENDANCE_READ,
  Permission.PAYMENT_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.GRADE_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_CALENDAR_READ,
  Permission.QUERY_COMMUNICATIONS_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
])

/** Read-only portal permissions for students. Kept explicit so student policy can diverge safely. */
export const STUDENT_PORTAL_PERMISSIONS: ReadonlySet<Permission> = new Set([
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.ATTENDANCE_READ,
  Permission.PAYMENT_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.GRADE_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_CALENDAR_READ,
  Permission.QUERY_COMMUNICATIONS_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
])

export const PORTAL_PERMISSION_POLICIES: Readonly<Record<PortalActorKind, PortalPermissionPolicy>> = {
  guardian: {
    actorKind: 'guardian',
    permissions: GUARDIAN_PORTAL_PERMISSIONS,
  },
  student: {
    actorKind: 'student',
    permissions: STUDENT_PORTAL_PERMISSIONS,
  },
}
