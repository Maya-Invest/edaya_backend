import { ACCOUNTANT_PERMISSIONS, COORDINATOR_PERMISSIONS } from '@edaya/authorization'
import { Permission } from '@edaya/core'

export interface StaffInvitePermissionPreset {
  id: string
  name: string
  description: string
  permissions: readonly Permission[]
}

const WEBAPP_READ_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.QUERY_STUDENT_DIRECTORY_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_OVERVIEW_READ,
  Permission.STAFF_READ,
  Permission.GRADE_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_CALENDAR_READ,
  Permission.QUERY_ATTENDANCE_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_REPORT_CARD_DETAIL_READ,
]

const EDUCATOR_PERMISSIONS: readonly Permission[] = [
  Permission.DISCIPLINE_READ,
  Permission.DISCIPLINE_CREATE,
  Permission.ATTENDANCE_READ,
  Permission.ATTENDANCE_RECORD,
  Permission.CLASS_LOGBOOK_READ,
  Permission.GRADE_READ,
  Permission.STUDENT_READ,
]

/** Pedagogical leadership beyond base coordinator (no access-admin, no finance). */
const STUDIES_DIRECTOR_EXTRA_PERMISSIONS: readonly Permission[] = [
  Permission.SCHOOL_STRUCTURE_READ,
  Permission.SCHOOL_STRUCTURE_CONFIGURE,
  Permission.ACCESS_CONTROL_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.ACADEMIC_PROGRAM_CREATE,
  Permission.ACADEMIC_PROGRAM_DELETE,
  Permission.ACADEMIC_PROGRAM_ASSIGN,
  Permission.EXAM_CONFIG_READ,
  Permission.EXAM_CONFIG_CREATE,
  Permission.EXAM_CONFIG_UPDATE,
  Permission.EXAM_CONFIG_LOCK,
  Permission.EXAM_CONFIG_UNLOCK,
  Permission.GRADE_UPDATE,
  Permission.GRADE_VALIDATE,
  Permission.GRADE_LOCK,
  Permission.GRADE_UNLOCK,
  Permission.GRADE_PUBLISH,
  Permission.REPORT_CARD_READ,
  Permission.REPORT_CARD_CONFIGURE,
  Permission.REPORT_CARD_GENERATE,
  Permission.REPORT_CARD_LOCK,
  Permission.REPORT_CARD_UNLOCK,
  Permission.REPORT_CARD_SIGN,
  Permission.REPORT_CARD_EXPORT,
  Permission.TIMETABLE_READ,
  Permission.TIMETABLE_PUBLISH,
  Permission.TIMETABLE_LOCK,
  Permission.TIMETABLE_UNLOCK,
  Permission.ENROLLMENT_READ,
  Permission.ENROLLMENT_UPDATE,
  Permission.DISCIPLINE_UPDATE,
  Permission.FAMILY_FEEDBACK_CAMPAIGN_READ,
  Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE,
  Permission.FAMILY_FEEDBACK_PUBLISH,
]

/** Technical administration: accounts, access, structure — not pedagogy write. */
const IT_ADMIN_PERMISSIONS: readonly Permission[] = [
  Permission.ACCESS_CONTROL_READ,
  Permission.ACCESS_CONTROL_CONFIGURE,
  Permission.ACCESS_CONTROL_ASSIGN,
  Permission.STAFF_READ,
  Permission.STAFF_CREATE,
  Permission.STAFF_UPDATE,
  Permission.STAFF_ARCHIVE,
  Permission.SERVICE_ACCOUNT_READ,
  Permission.SERVICE_ACCOUNT_CREATE,
  Permission.SERVICE_ACCOUNT_UPDATE,
  Permission.SERVICE_ACCOUNT_REVOKE,
  Permission.SERVICE_ACCOUNT_ROTATE_KEY,
  Permission.SCHOOL_STRUCTURE_READ,
  Permission.SCHOOL_STRUCTURE_CONFIGURE,
  Permission.RESOURCE_READ,
  Permission.RESOURCE_CONFIGURE,
  Permission.ATTACHMENT_READ,
  Permission.ATTACHMENT_CONFIGURE,
]

const IT_ADMIN_READ_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_OVERVIEW_READ,
  Permission.QUERY_CLASS_DIRECTORY_READ,
  Permission.QUERY_CLASS_CURRICULUM_READ,
  Permission.STAFF_READ,
  Permission.QUERY_TIMETABLE_READ,
  Permission.QUERY_CALENDAR_READ,
]

/** Finance workspace reads needed to operate billing without pedagogy write. */
const ACCOUNTANT_READ_PERMISSIONS: readonly Permission[] = [
  Permission.QUERY_WORKSPACE_READ,
  Permission.QUERY_OVERVIEW_READ,
  Permission.QUERY_STUDENT_DIRECTORY_READ,
  Permission.QUERY_STUDENT_DETAIL_READ,
  Permission.QUERY_ENROLLMENT_HISTORY_READ,
  Permission.QUERY_OVERDUE_FEES_READ,
  Permission.STUDENT_READ,
  Permission.ENROLLMENT_READ,
  Permission.STAFF_READ,
]

function mergePermissions(...groups: readonly (readonly Permission[])[]): Permission[] {
  return [...new Set(groups.flat())]
}

export const STAFF_INVITE_PERMISSION_PRESETS: readonly StaffInvitePermissionPreset[] = [
  {
    id: 'role-coordinator',
    name: 'Coordination',
    description: 'Profil principal, secrétariat et direction adjointe',
    permissions: mergePermissions(COORDINATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS, [
      Permission.ACCESS_CONTROL_READ,
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
    ]),
  },
  {
    id: 'role-educator',
    name: 'CPE / Vie scolaire',
    description: 'Discipline, absences et suivi des élèves',
    permissions: mergePermissions(EDUCATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS),
  },
  {
    id: 'role-studies-director',
    name: 'Direction des études',
    description: 'Pilotage pédagogique : programme, examens, notes, bulletins, EDT, structure',
    permissions: mergePermissions(
      COORDINATOR_PERMISSIONS,
      WEBAPP_READ_PERMISSIONS,
      STUDIES_DIRECTOR_EXTRA_PERMISSIONS,
    ),
  },
  {
    id: 'role-it-admin',
    name: 'Informatique',
    description: 'Comptes, droits d\'accès, comptes de service et structure technique',
    permissions: mergePermissions(IT_ADMIN_PERMISSIONS, IT_ADMIN_READ_PERMISSIONS),
  },
  {
    id: 'role-accountant',
    name: 'Comptabilité',
    description: 'Configuration financière, paiements et rapports — sans droits pédagogiques',
    permissions: mergePermissions(ACCOUNTANT_PERMISSIONS, ACCOUNTANT_READ_PERMISSIONS, [
      Permission.PAYMENT_EXPORT,
      Permission.FINANCIAL_REPORT_READ,
      Permission.FINANCIAL_REPORT_EXPORT,
    ]),
  },
  {
    id: 'role-director',
    name: 'Direction',
    description: 'Administration complète de l\'établissement',
    permissions: mergePermissions(COORDINATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS, [
      Permission.ACCESS_CONTROL_READ,
      Permission.ACCESS_CONTROL_CONFIGURE,
      Permission.ACCESS_CONTROL_ASSIGN,
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
    ]),
  },
]

export function getStaffInvitePermissionPreset(roleId: string): StaffInvitePermissionPreset | undefined {
  return STAFF_INVITE_PERMISSION_PRESETS.find(preset => preset.id === roleId)
}
