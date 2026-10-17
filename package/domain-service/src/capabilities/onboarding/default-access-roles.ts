import { ACCOUNTANT_PERMISSIONS, COORDINATOR_PERMISSIONS } from '@edaya/authorization'
import { corePermissionDefinition, Permission } from '@edaya/core'

export interface StaffInvitePermissionPreset {
  id: string
  name: string
  description: string
  permissions: readonly Permission[]
}

const WEBAPP_READ_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.STUDENT_READ,
  Permission.ENROLLMENT_READ,
  Permission.STAFF_READ,
  Permission.GRADE_READ,
  Permission.CLASS_LOGBOOK_READ,
  Permission.TIMETABLE_READ,
  Permission.ATTENDANCE_READ,
  Permission.REPORT_CARD_READ,
]

const EDUCATOR_WEBAPP_READ_PERMISSIONS: readonly Permission[] = WEBAPP_READ_PERMISSIONS.filter(permission =>
  permission !== Permission.TIMETABLE_READ
  && permission !== Permission.STAFF_READ,
)

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
  Permission.SCHOOL_CONFIGURE,
  Permission.ACCESS_CONTROL_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.ACADEMIC_PROGRAM_MANAGE,
  Permission.ASSESSMENT_READ,
  Permission.ASSESSMENT_MANAGE,
  Permission.GRADE_MANAGE,
  Permission.GRADE_VALIDATE,
  Permission.REPORT_CARD_READ,
  Permission.REPORT_CARD_CONFIGURE,
  Permission.REPORT_CARD_GENERATE,
  Permission.REPORT_CARD_EXPORT,
  Permission.TIMETABLE_READ,
  Permission.ENROLLMENT_READ,
  Permission.ENROLLMENT_MANAGE,
  Permission.DISCIPLINE_MANAGE,
  Permission.FAMILY_FEEDBACK_CAMPAIGN_READ,
  Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE,
  Permission.FAMILY_FEEDBACK_PUBLISH,
]

/** Technical administration: accounts, access, structure — not pedagogy write. */
const IT_ADMIN_PERMISSIONS: readonly Permission[] = [
  Permission.ACCESS_CONTROL_READ,
  Permission.ACCESS_CONTROL_MANAGE,
  Permission.STAFF_READ,
  Permission.STAFF_MANAGE,
  Permission.SERVICE_ACCOUNT_READ,
  Permission.SERVICE_ACCOUNT_MANAGE,
  Permission.SCHOOL_STRUCTURE_READ,
  Permission.SCHOOL_CONFIGURE,
  Permission.RESOURCE_READ,
  Permission.RESOURCE_CONFIGURE,
  Permission.ATTACHMENT_READ,
  Permission.ATTACHMENT_CONFIGURE,
]

const IT_ADMIN_READ_PERMISSIONS: readonly Permission[] = [
  Permission.CLASS_READ,
  Permission.ACADEMIC_PROGRAM_READ,
  Permission.STAFF_READ,
  Permission.TIMETABLE_READ,
]

/** Finance workspace reads needed to operate billing without pedagogy write. */
const ACCOUNTANT_READ_PERMISSIONS: readonly Permission[] = [
  Permission.STUDENT_READ,
  Permission.ENROLLMENT_READ,
  Permission.OVERDUE_BALANCE_READ,
  Permission.STAFF_READ,
]

function mergePermissions(...groups: readonly (readonly Permission[])[]): Permission[] {
  return [...new Set(groups.flat())].filter(permission => corePermissionDefinition(permission).staffAssignable)
}

export const STAFF_INVITE_PERMISSION_PRESETS: readonly StaffInvitePermissionPreset[] = [
  {
    id: 'role-coordinator',
    name: 'Coordination',
    description: 'Profil principal, secrétariat et direction adjointe',
    permissions: mergePermissions(COORDINATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS, [
      Permission.ACCESS_CONTROL_READ,
      Permission.SCHOOL_CONFIGURE,
    ]),
  },
  {
    id: 'role-educator',
    name: 'CPE / Vie scolaire',
    description: 'Discipline, absences et suivi des élèves',
    permissions: mergePermissions(EDUCATOR_PERMISSIONS, EDUCATOR_WEBAPP_READ_PERMISSIONS),
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
      Permission.FINANCIAL_REPORT_READ,
    ]),
  },
  {
    id: 'role-director',
    name: 'Direction',
    description: 'Administration complète de l\'établissement',
    permissions: mergePermissions(COORDINATOR_PERMISSIONS, WEBAPP_READ_PERMISSIONS, [
      Permission.ACCESS_CONTROL_READ,
      Permission.ACCESS_CONTROL_MANAGE,
      Permission.FINANCIAL_CONFIG_READ,
      Permission.PAYMENT_READ,
    ]),
  },
]

export function getStaffInvitePermissionPreset(roleId: string): StaffInvitePermissionPreset | undefined {
  return STAFF_INVITE_PERMISSION_PRESETS.find(preset => preset.id === roleId)
}
