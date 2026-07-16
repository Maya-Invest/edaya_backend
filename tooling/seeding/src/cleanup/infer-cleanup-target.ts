/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { CleanupTarget } from './parse-cleanup-args'
import process from 'node:process'
import { isStagingSeedApiUrl } from '../support/resolve-seed-env'

export function inferCleanupTargetFromEnv(): CleanupTarget {
  const stagingApiUrl = process.env['SEED_STAGING_API_URL']?.trim()

  if (stagingApiUrl && isStagingSeedApiUrl(stagingApiUrl)) {
    return 'staging'
  }

  if (process.env['STAGING_DATABASE_URL']?.trim()) {
    return 'staging'
  }

  return 'local'
}
