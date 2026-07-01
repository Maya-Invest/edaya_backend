import { DEV_AUTH_GUARDIAN_ACCOUNTS } from '../../meta/dev-auth-fixtures'
import {
  integrationClassGroupIdForStudent,
  integrationGuardianLinks,
  integrationGuardians,
  integrationStudents,
} from './people'

/** Narrative student shape consumed by `@edaya/seeding` population workflow. */
export interface IntegrationLightStudent {
  id: string
  classId: string
  name: string
  birthDate: string
}

/** Narrative guardian shape consumed by `@edaya/seeding` population workflow. */
export interface IntegrationLightGuardian {
  id: string
  name: string
  email: string
  phone: string
  studentIds: readonly string[]
  relationship: string
}

/** Guardian ids linked in the integration light fixture (core auth accounts only). */
export const INTEGRATION_LIGHT_GUARDIAN_IDS = [
  'g1',
  'g2',
  'g3',
  'g4',
  'g5',
  'g6',
] as const

const integrationLightGuardianIdSet = new Set<string>(INTEGRATION_LIGHT_GUARDIAN_IDS)

const integrationLightStudentIdSet = new Set(
  integrationGuardianLinks
    .filter(link => integrationLightGuardianIdSet.has(link.guardianId))
    .map(link => link.studentId),
)

function studentToNarrativeRecord(student: (typeof integrationStudents)[number]): IntegrationLightStudent {
  return {
    id: student.id,
    classId: integrationClassGroupIdForStudent(student.id),
    name: `${student.firstName} ${student.lastName}`,
    birthDate: student.birthDate as string,
  }
}

function guardianToNarrativeRecord(guardian: (typeof integrationGuardians)[number]): IntegrationLightGuardian {
  const links = integrationGuardianLinks.filter(link => link.guardianId === guardian.id)
  return {
    id: guardian.id,
    name: `${guardian.firstName} ${guardian.lastName}`,
    email: guardian.email ?? '',
    phone: guardian.phone ?? '',
    studentIds: links.map(link => link.studentId),
    relationship: links[0]?.relationship ?? 'parent',
  }
}

/** Guardians seeded by the integration light fixture. */
export const INTEGRATION_LIGHT_GUARDIANS = integrationGuardians
  .filter(guardian => integrationLightGuardianIdSet.has(guardian.id))
  .map(guardianToNarrativeRecord)

/** Students seeded by the integration light fixture. */
export const INTEGRATION_LIGHT_STUDENTS = integrationStudents
  .filter(student => integrationLightStudentIdSet.has(student.id))
  .map(studentToNarrativeRecord)

/** Auth-linked guardian accounts covered by the integration light fixture. */
export const INTEGRATION_LIGHT_AUTH_GUARDIAN_ACCOUNTS = DEV_AUTH_GUARDIAN_ACCOUNTS.filter(account =>
  integrationLightGuardianIdSet.has(account.guardianId),
)
