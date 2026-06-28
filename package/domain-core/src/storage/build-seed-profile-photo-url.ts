export const SEED_PROFILE_PHOTO_ROUTE_PREFIX = '/core/seed/profile-photos'

export function buildSeedProfilePhotoUrl(apiBaseUrl: string, attachmentId: string): string {
  const base = apiBaseUrl.replace(/\/+$/, '')
  return `${base}${SEED_PROFILE_PHOTO_ROUTE_PREFIX}/${attachmentId}`
}
