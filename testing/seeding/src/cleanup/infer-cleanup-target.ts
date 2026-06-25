/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { CleanupTarget } from './parse-cleanup-args'
import process from 'node:process'

export function inferCleanupTargetFromEnv(): CleanupTarget {
  const apiUrl = process.env['SEED_API_URL']
    ?? process.env['STAGING_API_URL']
    ?? process.env['BETTER_AUTH_URL']
    ?? ''

  if (apiUrl.includes('api-staging.')) {
    return 'staging'
  }

  if (process.env['STAGING_DATABASE_URL']?.trim()) {
    return 'staging'
  }

  return 'local'
}
