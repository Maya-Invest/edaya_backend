/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { resolveSeedingApiKeyForSchool } from '@edaya/fixtures/meta/school-profiles'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { loadRepoEnvFile } from '../../../seeding/src/support/load-repo-env'
import {
  resolveStagingAppOrigin,
  resolveStagingSeedApiUrl,
  resolveStagingSeedAuthUrl,
} from '../../../seeding/src/support/resolve-seed-env'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const repoRoot = path.resolve(packageRoot, '../..')

export interface SmokeStagingEnv {
  apiUrl: string
  authUrl: string
  appOrigin: string
  staffEmail: string
  staffPassword: string
  serviceAccountApiKey: string
}

export function loadSmokeStagingEnv(options?: { loadEnvFile?: boolean }): SmokeStagingEnv {
  const shouldLoadEnvFile = options?.loadEnvFile ?? process.env['SMOKE_STAGING_LOAD_ENV_FILE'] !== '0'
  if (shouldLoadEnvFile) {
    loadRepoEnvFile(repoRoot)
  }

  const apiUrl = resolveStagingSeedApiUrl()
  const appOrigin = resolveStagingAppOrigin()
  const schoolId = process.env['SEED_SCHOOL_ID']?.trim() || SEED_SCHOOL_ID

  return {
    apiUrl,
    authUrl: resolveStagingSeedAuthUrl(),
    appOrigin,
    staffEmail: process.env['SMOKE_STAFF_EMAIL']?.trim() ?? '',
    staffPassword: process.env['SMOKE_STAFF_PASSWORD']?.trim() ?? '',
    serviceAccountApiKey: resolveSeedingApiKeyForSchool(schoolId),
  }
}
