import type { CountryCode } from './types'

const IVORY_COAST_ALIASES = new Set([
  'ci',
  'civ',
  'côte d\'ivoire',
  'cote d\'ivoire',
  'ivory coast',
  'république de côte d\'ivoire',
  'republique de cote d\'ivoire',
])

const FRANCE_ALIASES = new Set([
  'fr',
  'france',
  'république française',
  'republique francaise',
])

/** Resolves a free-text country label to a template country code (defaults to CI). */
export function resolveCountryCode(country: string | null | undefined): CountryCode {
  const normalized = country?.trim().toLowerCase() ?? ''
  if (!normalized) {
    return 'CI'
  }
  if (IVORY_COAST_ALIASES.has(normalized)) {
    return 'CI'
  }
  if (FRANCE_ALIASES.has(normalized)) {
    return 'FR'
  }
  if (normalized.includes('ivoire')) {
    return 'CI'
  }
  if (normalized.includes('france')) {
    return 'FR'
  }
  return 'CI'
}
