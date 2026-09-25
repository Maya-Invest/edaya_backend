import type { FixtureDataset } from '../datasets/types'
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'
import { demoCiDataset } from '../datasets/demo-ci'
import { demoCiSchoolOwnerStaffId } from '../datasets/demo-ci/people'
import { DEMO_CI_SCHOOL_ID } from '../shared/ids'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
  DEV_AUTH_STAFF_ACCOUNTS,
  DEV_AUTH_TEACHER_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from './dev-auth-fixtures'

export type DevSeedDatasetId = 'demo-ci'

export interface DevAuthStaffAccount {
  staffId: string
  email: string
  name: string
}
export interface DevAuthGuardianAccount {
  guardianId: string
  email: string
  name: string
}
export interface DevAuthTeacherAccount {
  teacherId: string
  email: string
  name: string
}
export interface DevSeedContext {
  datasetId: DevSeedDatasetId
  dataset: FixtureDataset
  schoolId: string
  ownerStaffId: string
  minimalStaffId: string
  minimalStaffEmail: string
  authPassword: string
  staffAccounts: readonly DevAuthStaffAccount[]
  teacherAccounts: readonly DevAuthTeacherAccount[]
  guardianAccounts: readonly DevAuthGuardianAccount[]
  staffAccessRoleIds: Record<string, string>
  bootstrapSignInStaffIds: readonly string[]
}

const BOOTSTRAP_SIGN_IN_STAFF_IDS = ['ci-st5', 'ci-st8', 'ci-st3', 'ci-st7'] as const

/** Active seed is always the Abidjan collège dataset. */
export function resolveDevSeedContext(): DevSeedContext {
  return {
    datasetId: 'demo-ci',
    dataset: demoCiDataset,
    schoolId: DEMO_CI_SCHOOL_ID,
    ownerStaffId: demoCiSchoolOwnerStaffId,
    minimalStaffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
    minimalStaffEmail: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
    authPassword: DEV_AUTH_PASSWORD,
    staffAccounts: DEV_AUTH_STAFF_ACCOUNTS,
    teacherAccounts: DEV_AUTH_TEACHER_ACCOUNTS,
    guardianAccounts: DEV_AUTH_GUARDIAN_ACCOUNTS,
    staffAccessRoleIds: DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
    bootstrapSignInStaffIds: BOOTSTRAP_SIGN_IN_STAFF_IDS,
  }
}

/** Active seed school id — honours `SEED_SCHOOL_ID` override, otherwise the collège. */
export function resolveActiveSeedSchoolId(): string {
  const explicit = process.env['SEED_SCHOOL_ID']?.trim()
  if (explicit) {
    return explicit
  }
  return resolveDevSeedContext().schoolId
}
