/** School profiles for multi-school UI demo. Only Campus Central is fully seeded in PGLite. */
export const SEED_SCHOOL_PROFILES = [
  {
    id: 'sch-edaya-central',
    name: 'EDAYA — Campus Central',
    shortName: 'Campus Central',
    city: 'Paris',
    timeZone: 'Europe/Paris',
    seedingApiKey: 'sk_live_dev_edaya_central_seeding_integration_key',
  },
  {
    id: 'sch-edaya-nord',
    name: 'EDAYA — Campus Nord',
    shortName: 'Campus Nord',
    city: 'Lille',
    timeZone: 'Europe/Paris',
    seedingApiKey: 'sk_live_dev_edaya_nord_seeding_integration_key',
  },
] as const

export type SeedSchoolProfile = (typeof SEED_SCHOOL_PROFILES)[number]

export function resolveSeedingApiKeyForSchool(schoolId: string): string {
  const profile = SEED_SCHOOL_PROFILES.find(entry => entry.id === schoolId)
  if (!profile) {
    throw new Error(`No seed school profile with seeding API key for "${schoolId}"`)
  }
  return profile.seedingApiKey
}
