/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { CleanupTarget } from './parse-cleanup-args'
import process from 'node:process'

export function inferCleanupTargetFromEnv(): CleanupTarget {
  const remoteApiUrl = process.env['SEED_REMOTE_API_URL'] ?? ''

  if (remoteApiUrl.includes('api-staging.') || remoteApiUrl.includes('staging')) {
    return 'staging'
  }

  if (process.env['STAGING_DATABASE_URL']?.trim()) {
    return 'staging'
  }

  return 'local'
}
