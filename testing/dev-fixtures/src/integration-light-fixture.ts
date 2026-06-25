import { DEV_AUTH_GUARDIAN_ACCOUNTS, SEED_GUARDIANS, SEED_STUDENTS } from './dataset'

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

/** Guardians seeded by the integration light fixture. */
export const INTEGRATION_LIGHT_GUARDIANS = SEED_GUARDIANS.filter(guardian =>
  integrationLightGuardianIdSet.has(guardian.id),
)

const integrationLightStudentIdSet = new Set(
  INTEGRATION_LIGHT_GUARDIANS.flatMap(guardian => guardian.studentIds),
)

/** Students seeded by the integration light fixture. */
export const INTEGRATION_LIGHT_STUDENTS = SEED_STUDENTS.filter(student =>
  integrationLightStudentIdSet.has(student.id),
)

/** Auth-linked guardian accounts covered by the integration light fixture. */
export const INTEGRATION_LIGHT_AUTH_GUARDIAN_ACCOUNTS = DEV_AUTH_GUARDIAN_ACCOUNTS.filter(account =>
  integrationLightGuardianIdSet.has(account.guardianId),
)
