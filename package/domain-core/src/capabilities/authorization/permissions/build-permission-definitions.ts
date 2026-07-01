import type { PermissionDefinition, PermissionDefinitionOverride } from './permission-definition'
import type { ScopeType } from './scope-type'
import { Permission } from './permission'

const SCHOOL_ONLY: readonly ScopeType[] = ['school']
const SCHOOL_AND_YEAR: readonly ScopeType[] = ['school', 'academic_year']
const CLASS_SCOPED: readonly ScopeType[] = ['school', 'class_group', 'course_assignment', 'session']
const TEACHING_SCOPED: readonly ScopeType[] = ['school', 'class_group', 'course_assignment']

function humanizePermission(permission: Permission): string {
  return permission
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildDefinition(
  permission: Permission,
  override: PermissionDefinitionOverride = {},
): PermissionDefinition {
  const label = override.label ?? humanizePermission(permission)
  const allowedScopes = override.allowedScopes ?? SCHOOL_ONLY
  const defaultScope = override.defaultScope ?? allowedScopes[allowedScopes.length - 1] ?? 'school'

  return {
    permission,
    label,
    description: override.description ?? label,
    allowedScopes,
    defaultScope,
  }
}

const OVERRIDES: Partial<Record<Permission, PermissionDefinitionOverride>> = {
  [Permission.GRADE_INPUT]: {
    label: 'Saisir les notes',
    description: 'Permet de saisir les notes des élèves pour les évaluations autorisées.',
    allowedScopes: TEACHING_SCOPED,
    defaultScope: 'course_assignment',
  },
  [Permission.ATTENDANCE_RECORD]: {
    label: 'Faire l’appel',
    description: 'Permet d’enregistrer les présences, absences et retards.',
    allowedScopes: [...TEACHING_SCOPED, 'session'],
    defaultScope: 'course_assignment',
  },
  [Permission.PAYMENT_RECORD]: {
    label: 'Encaisser les paiements',
    description: 'Permet d’enregistrer les versements des parents et d’émettre les reçus.',
    allowedScopes: SCHOOL_ONLY,
    defaultScope: 'school',
  },
  [Permission.COMMUNICATION_SEND]: {
    label: 'Envoyer des communications',
    description: 'Permet d’envoyer des messages aux classes ou groupes autorisés.',
    allowedScopes: ['school', 'class_group', 'student_group'],
    defaultScope: 'class_group',
  },
  [Permission.ACADEMIC_PROGRAM_READ]: {
    allowedScopes: ['school', 'academic_year', 'class_group'],
    defaultScope: 'school',
  },
  [Permission.ACADEMIC_PROGRAM_UPDATE]: {
    allowedScopes: ['school', 'academic_year', 'class_group'],
    defaultScope: 'school',
  },
  [Permission.ENROLLMENT_CREATE]: {
    allowedScopes: SCHOOL_AND_YEAR,
    defaultScope: 'school',
  },
  [Permission.STUDENT_READ]: {
    allowedScopes: ['school', 'class_group', 'student'],
    defaultScope: 'school',
  },
  [Permission.ATTENDANCE_READ]: {
    allowedScopes: CLASS_SCOPED,
    defaultScope: 'class_group',
  },
  [Permission.GRADE_READ]: {
    allowedScopes: CLASS_SCOPED,
    defaultScope: 'class_group',
  },
  [Permission.TIMETABLE_READ]: {
    allowedScopes: CLASS_SCOPED,
    defaultScope: 'school',
  },
  [Permission.TIMETABLE_CREATE]: {
    allowedScopes: CLASS_SCOPED,
    defaultScope: 'class_group',
  },
  [Permission.TIMETABLE_UPDATE]: {
    allowedScopes: CLASS_SCOPED,
    defaultScope: 'class_group',
  },
  [Permission.QUERY_STUDENT_DETAIL_READ]: {
    allowedScopes: ['school', 'student'],
    defaultScope: 'student',
  },
}

export function buildPermissionDefinitions(): Record<Permission, PermissionDefinition> {
  const definitions = {} as Record<Permission, PermissionDefinition>
  for (const permission of Object.values(Permission)) {
    definitions[permission] = buildDefinition(permission, OVERRIDES[permission])
  }
  return definitions
}
