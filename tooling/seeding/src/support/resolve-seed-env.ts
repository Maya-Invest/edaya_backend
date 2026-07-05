/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'

export const DEFAULT_LOCAL_API_URL = 'http://localhost:9999'
export const DEFAULT_LOCAL_APP_ORIGIN = 'http://localhost:5173'
export const DEFAULT_REMOTE_API_URL = 'https://api-staging.edaya.softilab.dev'
export const DEFAULT_REMOTE_APP_ORIGIN = 'https://app-staging.edaya.softilab.dev'

export type SeedHttpTarget = 'local' | 'staging'

function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, '')
}

/** Local API base URL (`bun seed`, `bun seed:doctor`, …). */
export function resolveLocalSeedApiUrl(): string {
  const configured = process.env['SEED_API_URL']?.trim()
    || process.env['BETTER_AUTH_URL']?.trim()
  return normalizeUrl(configured || DEFAULT_LOCAL_API_URL)
}

/** Staging API base URL (`bun seed --staging`, `bun smoke:staging`). */
export function resolveRemoteSeedApiUrl(): string {
  const configured = process.env['SEED_REMOTE_API_URL']?.trim()
  return normalizeUrl(configured || DEFAULT_REMOTE_API_URL)
}

/** Trusted webapp `Origin` for local Better Auth sign-in. */
export function resolveLocalAppOrigin(): string {
  const configured = process.env['SEED_APP_ORIGIN']?.trim()
  return normalizeUrl(configured || DEFAULT_LOCAL_APP_ORIGIN)
}

/** Trusted webapp `Origin` for remote Better Auth sign-in. */
export function resolveRemoteAppOrigin(): string {
  const configured = process.env['SEED_REMOTE_APP_ORIGIN']?.trim()
  return normalizeUrl(configured || DEFAULT_REMOTE_APP_ORIGIN)
}

export function resolveSeedApiUrl(target: SeedHttpTarget): string {
  return target === 'staging' ? resolveRemoteSeedApiUrl() : resolveLocalSeedApiUrl()
}

export function resolveSeedAppOrigin(target: SeedHttpTarget): string {
  return target === 'staging' ? resolveRemoteAppOrigin() : resolveLocalAppOrigin()
}
