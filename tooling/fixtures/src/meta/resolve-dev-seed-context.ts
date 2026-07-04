import type { FixtureDataset } from '../datasets/types'
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'
import { bulkDataset } from '../datasets/bulk'
import { bulkCiDataset } from '../datasets/bulk/index-ci'
import { demoDataset } from '../datasets/demo'
import { demoCiDataset } from '../datasets/demo-ci'
import { demoCiSchoolOwnerStaffId } from '../datasets/demo-ci/people'
import { demoSchoolOwnerStaffId } from '../datasets/demo/people'
import { DEMO_CI_SCHOOL_ID, DEMO_CENTRAL_SCHOOL_ID } from '../shared/ids'
import {
  DEV_AUTH_GUARDIAN_ACCOUNTS,
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
} from './dev-auth-fixtures'
import {
  DEV_CI_AUTH_GUARDIAN_ACCOUNTS,
  DEV_CI_AUTH_PASSWORD,
  DEV_CI_AUTH_STAFF_ACCESS_ROLE_IDS,
  DEV_CI_AUTH_STAFF_ACCOUNTS,
  MINIMAL_CI_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_CI_AUTH_FIXTURE_STAFF_ID,
} from './dev-auth-fixtures-ci'
import {
  syncGuardianAuthDisplayNames,
  syncStaffAuthDisplayNames,
} from './sync-auth-display-names'

export type DevSeedDatasetId = 'ci' | 'central' | 'demo' | 'demo-ci'
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
export interface DevSeedContext {
  datasetId: DevSeedDatasetId
  dataset: FixtureDataset
  schoolId: string
  ownerStaffId: string
  minimalStaffId: string
  minimalStaffEmail: string
  authPassword: string
  staffAccounts: readonly DevAuthStaffAccount[]
  guardianAccounts: readonly DevAuthGuardianAccount[]
  staffAccessRoleIds: Record<string, string>
  bootstrapSignInStaffIds: readonly string[]
}
const CENTRAL_BOOTSTRAP_SIGN_IN_STAFF_IDS = ['st5', 'st8', 'st1', 'st3', 'st7'] as const
const DEMO_CI_BOOTSTRAP_SIGN_IN_STAFF_IDS = ['ci-st5', 'ci-st8', 'ci-st1', 'ci-st3', 'ci-st7'] as const
/** Reads `SEED_DATASET` (`demo-ci` | `ci` | `central` | `demo`). Defaults to `demo-ci` (compact Abidjan collège). */
export function resolveDevSeedDatasetId(): DevSeedDatasetId {
  const raw = process.env['SEED_DATASET']?.trim().toLowerCase()
  if (raw === 'demo' || raw === 'integration') {
    return 'demo'
  }
  if (!raw || raw === 'demo-ci' || raw === 'default' || raw === 'local') {
    return 'demo-ci'
  }
  if (raw === 'central' || raw === 'legacy') {
    return 'central'
  }
  if (raw === 'ci' || raw === 'civ' || raw === 'cote-divoire' || raw === 'ivory-coast' || raw === 'bulk-ci') {
    return 'ci'
  }
  throw new Error(`Unknown SEED_DATASET "${raw}". Expected "demo-ci", "central", "ci", or "demo".`)
}
export function resolveDevSeedContext(): DevSeedContext {
  const datasetId = resolveDevSeedDatasetId()
  if (datasetId === 'demo-ci') {
    return {
      datasetId,
      dataset: demoCiDataset,
      schoolId: DEMO_CI_SCHOOL_ID,
      ownerStaffId: demoCiSchoolOwnerStaffId,
      minimalStaffId: MINIMAL_CI_AUTH_FIXTURE_STAFF_ID,
      minimalStaffEmail: MINIMAL_CI_AUTH_FIXTURE_STAFF_EMAIL,
      authPassword: DEV_CI_AUTH_PASSWORD,
      staffAccounts: DEV_CI_AUTH_STAFF_ACCOUNTS,
      guardianAccounts: DEV_CI_AUTH_GUARDIAN_ACCOUNTS,
      staffAccessRoleIds: DEV_CI_AUTH_STAFF_ACCESS_ROLE_IDS,
      bootstrapSignInStaffIds: DEMO_CI_BOOTSTRAP_SIGN_IN_STAFF_IDS,
    }
  }
  if (datasetId === 'demo') {
    return {
      datasetId,
      dataset: demoDataset,
      schoolId: DEMO_CENTRAL_SCHOOL_ID,
      ownerStaffId: demoSchoolOwnerStaffId,
      minimalStaffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      minimalStaffEmail: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      authPassword: DEV_AUTH_PASSWORD,
      staffAccounts: DEV_AUTH_STAFF_ACCOUNTS,
      guardianAccounts: DEV_AUTH_GUARDIAN_ACCOUNTS,
      staffAccessRoleIds: DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
      bootstrapSignInStaffIds: CENTRAL_BOOTSTRAP_SIGN_IN_STAFF_IDS,
    }
  }
  if (datasetId === 'ci') {
    const dataset = bulkCiDataset
    return {
      datasetId,
      dataset,
      schoolId: DEMO_CENTRAL_SCHOOL_ID,
      ownerStaffId: demoSchoolOwnerStaffId,
      minimalStaffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      minimalStaffEmail: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      authPassword: DEV_AUTH_PASSWORD,
      staffAccounts: syncStaffAuthDisplayNames(dataset, DEV_AUTH_STAFF_ACCOUNTS),
      guardianAccounts: syncGuardianAuthDisplayNames(dataset, DEV_AUTH_GUARDIAN_ACCOUNTS),
      staffAccessRoleIds: DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
      bootstrapSignInStaffIds: CENTRAL_BOOTSTRAP_SIGN_IN_STAFF_IDS,
    }
  }
  return {
    datasetId,
    dataset: bulkDataset,
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    ownerStaffId: demoSchoolOwnerStaffId,
    minimalStaffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
    minimalStaffEmail: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
    authPassword: DEV_AUTH_PASSWORD,
    staffAccounts: DEV_AUTH_STAFF_ACCOUNTS,
    guardianAccounts: DEV_AUTH_GUARDIAN_ACCOUNTS,
    staffAccessRoleIds: DEV_AUTH_STAFF_ACCESS_ROLE_IDS,
    bootstrapSignInStaffIds: CENTRAL_BOOTSTRAP_SIGN_IN_STAFF_IDS,
  }
}
/** Active seed school id — honours `SEED_SCHOOL_ID` override, then `SEED_DATASET`. */
export function resolveActiveSeedSchoolId(): string {
  const explicit = process.env['SEED_SCHOOL_ID']?.trim()
  if (explicit) {
    return explicit
  }
  return resolveDevSeedContext().schoolId
}
