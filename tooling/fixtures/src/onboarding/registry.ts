import type { OnboardingDataset } from '@edaya/service'
import type { CountryCode, StructureTemplateDefinition, StructureTemplateId } from './types'
import { BusinessRuleViolationError } from '@edaya/core'
import { onboardingDatasetSchema } from '@edaya/service'
import { resolveCountryCode } from './country'
import { IVORY_COAST_ONBOARDING_DATASET, IVORY_COAST_STRUCTURE_TEMPLATES } from './ivory-coast/parse-ivory-coast-templates'

export { resolveCountryCode } from './country'
export type { CountryCode } from './types'

export {
  classDisplayName,
  classNameFromLabel,
  isStructureTemplateId,
  parseGradeLevelTemplateId,
} from '@edaya/service'
export type { ClassNamingMode } from '@edaya/service'

export const BUILTIN_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[] = [
  ...IVORY_COAST_STRUCTURE_TEMPLATES,
]

const TEMPLATES_BY_COUNTRY = new Map<CountryCode, readonly StructureTemplateDefinition[]>([
  ['CI', IVORY_COAST_STRUCTURE_TEMPLATES],
  ['FR', []],
])

export function listStructureTemplatesForCountry(
  country: string | null | undefined,
): { countryCode: CountryCode, templates: readonly StructureTemplateDefinition[] } {
  const countryCode = resolveCountryCode(country)
  return {
    countryCode,
    templates: TEMPLATES_BY_COUNTRY.get(countryCode) ?? [],
  }
}

/** Read-side compatibility for older template-list clients; never used for provisioning. */
export function resolveStructureTemplates(templateIds: StructureTemplateId[]): StructureTemplateDefinition[] {
  return templateIds.map((id) => {
    const template = BUILTIN_STRUCTURE_TEMPLATES.find(row => row.id === id)
    if (!template)
      throw new Error(`Unknown structure template: ${id}`)
    return structuredClone(template)
  })
}

export function resolveOnboardingDataset(id: string, version: string) {
  if (id !== IVORY_COAST_ONBOARDING_DATASET.id || version !== IVORY_COAST_ONBOARDING_DATASET.version)
    throw new BusinessRuleViolationError('UNKNOWN_ONBOARDING_DATASET', `Unknown onboarding dataset: ${id}@${version}`)
  return structuredClone(IVORY_COAST_ONBOARDING_DATASET)
}

/** API composition owns fixture lookup; the service receives only resolved canonical data. */
export function resolveOnboardingDatasetInput(input: { dataset?: { id: string, version: string }, datasetSnapshot?: OnboardingDataset }): OnboardingDataset {
  if (input.dataset && input.datasetSnapshot)
    throw new BusinessRuleViolationError('ONBOARDING_DATASET_AMBIGUOUS', 'Supply a dataset reference or snapshot, not both')
  if (input.datasetSnapshot)
    return onboardingDatasetSchema.parse(input.datasetSnapshot)
  const reference = input.dataset ?? { id: 'ci-general-secondary', version: '1.0.0' }
  return resolveOnboardingDataset(reference.id, reference.version)
}

/** Published choices; versions remain pinned even when a new default is introduced. */
export const ONBOARDING_DATASET_CHOICES = [{
  id: 'ci-general-secondary',
  version: '1.0.0',
  countryCode: 'CI' as const,
  label: 'Enseignement général — Côte d’Ivoire',
  isDefault: true,
}]

export function listOnboardingDatasets(country?: string) {
  if (country === undefined)
    return structuredClone(ONBOARDING_DATASET_CHOICES)
  const normalized = country.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/’/g, '\'')
  const code = ['ci', 'civ', 'cote d\'ivoire', 'ivory coast', 'republique de cote d\'ivoire'].includes(normalized) ? 'CI' : undefined
  return structuredClone(ONBOARDING_DATASET_CHOICES.filter(row => row.countryCode === code))
}
