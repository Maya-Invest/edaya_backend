/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'

export const DEFAULT_LOCAL_FILES_URL = 'http://localhost:9200'

export interface ProfilePhotoPreflightResult {
  seedProfilePhotos: boolean
  reason?: string
}

export function parseSkipProfilePhotosFlag(argv: readonly string[]): boolean {
  return argv.includes('--skip-profile-photos')
}

export function resolveLocalFilesUrl(): string {
  const configured = process.env['LOCAL_FILES_URL']?.trim()
  return (configured || DEFAULT_LOCAL_FILES_URL).replace(/\/+$/, '')
}

export function isLocalDevApiUrl(apiBaseUrl: string): boolean {
  try {
    const host = new URL(apiBaseUrl).hostname
    return host === 'localhost' || host === '127.0.0.1'
  }
  catch {
    return false
  }
}

export async function probeLocalFilesService(
  localFilesUrl: string = resolveLocalFilesUrl(),
  timeoutMs = 3_000,
): Promise<boolean> {
  try {
    const response = await fetch(new URL('/health', localFilesUrl), {
      signal: AbortSignal.timeout(timeoutMs),
    })
    return response.ok
  }
  catch {
    return false
  }
}

export async function resolveProfilePhotoSeedPlan(options: {
  apiBaseUrl: string
  skipProfilePhotos: boolean
  /** When true, unreachable storage is an error instead of an automatic skip. */
  requirePhotoUpload?: boolean
}): Promise<ProfilePhotoPreflightResult> {
  if (options.skipProfilePhotos) {
    return {
      seedProfilePhotos: false,
      reason: 'Skipped via --skip-profile-photos.',
    }
  }

  if (!isLocalDevApiUrl(options.apiBaseUrl)) {
    return { seedProfilePhotos: true }
  }

  const localFilesUrl = resolveLocalFilesUrl()
  const reachable = await probeLocalFilesService(localFilesUrl)
  if (reachable) {
    return { seedProfilePhotos: true }
  }

  const reason = `Local file storage is not reachable at ${localFilesUrl}. Start \`bun dev\` (API + @edaya/local-files-server) or pass --skip-profile-photos.`

  if (options.requirePhotoUpload) {
    throw new Error(reason)
  }

  return {
    seedProfilePhotos: false,
    reason,
  }
}

export function seedScopeUsesProfilePhotos(scope: string): boolean {
  return scope === 'all' || scope === 'school' || scope === 'profile-pictures'
}
