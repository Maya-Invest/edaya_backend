/** School profiles for multi-school UI demo. */
export const SEED_SCHOOL_PROFILES = [
  {
    id: 'sch-edaya-ci-cocody',
    name: 'École EDaya — Cocody',
    shortName: 'Cocody',
    city: 'Abidjan',
    timeZone: 'Africa/Abidjan',
    seedingApiKey: 'sk_live_dev_edaya_ci_cocody_seeding_integration_key',
    edayaSparkS2sApiKey: 's2s_live_dev_edaya_ci_cocody_edaya_spark_key01',
  },
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

export function resolveEdayaSparkS2sApiKeyForSchool(schoolId: string): string | undefined {
  const profile = SEED_SCHOOL_PROFILES.find(entry => entry.id === schoolId)
  if (!profile || !('edayaSparkS2sApiKey' in profile)) {
    return undefined
  }
  return profile.edayaSparkS2sApiKey
}
