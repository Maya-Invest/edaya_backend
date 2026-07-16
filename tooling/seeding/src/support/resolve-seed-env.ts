/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'

export const DEFAULT_LOCAL_API_URL = 'http://localhost:9999'
export const DEFAULT_LOCAL_APP_ORIGIN = 'http://localhost:5173'
export const DEFAULT_STAGING_API_URL = 'https://staging.api.edaya.app'
export const DEFAULT_STAGING_APP_ORIGIN = 'https://staging.staff.edaya.app'

export type SeedHttpTarget = 'local' | 'staging'

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Local API base URL (`bun repo seed`, `bun repo seed --scope doctor`, …). */
export function resolveLocalSeedApiUrl(): string {
  const configured = process.env['SEED_API_URL']?.trim()
    || process.env['BETTER_AUTH_URL']?.trim()
  return normalizeUrl(configured || DEFAULT_LOCAL_API_URL)
}

/** Staging API base URL (`bun repo seed --staging`, `bun repo smoke-test staging`). */
export function resolveStagingSeedApiUrl(): string {
  const configured = process.env['SEED_STAGING_API_URL']?.trim()
  return normalizeUrl(configured || DEFAULT_STAGING_API_URL)
}

/** Trusted webapp `Origin` for local Better Auth sign-in. */
export function resolveLocalAppOrigin(): string {
  const configured = process.env['SEED_APP_ORIGIN']?.trim()
  return normalizeUrl(configured || DEFAULT_LOCAL_APP_ORIGIN)
}

/** Trusted webapp `Origin` for staging Better Auth sign-in. */
export function resolveStagingAppOrigin(): string {
  const configured = process.env['SEED_STAGING_APP_ORIGIN']?.trim()
  return normalizeUrl(configured || DEFAULT_STAGING_APP_ORIGIN)
}

export function resolveSeedApiUrl(target: SeedHttpTarget): string {
  return target === 'staging' ? resolveStagingSeedApiUrl() : resolveLocalSeedApiUrl()
}

export function resolveSeedAppOrigin(target: SeedHttpTarget): string {
  return target === 'staging' ? resolveStagingAppOrigin() : resolveLocalAppOrigin()
}

/** True when the API base URL targets staging (current or legacy hostname patterns). */
export function isStagingSeedApiUrl(apiUrl: string): boolean {
  const trimmed = apiUrl.trim()
  if (!trimmed) {
    return false
  }

  try {
    const hostname = new URL(trimmed).hostname.toLowerCase()
    return hostname === 'staging.api.edaya.app'
      || hostname.startsWith('staging.api.')
      || hostname.startsWith('api-staging.')
  }
  catch {
    const lower = trimmed.toLowerCase()
    return lower.includes('staging.api.')
      || lower.includes('api-staging.')
  }
}
