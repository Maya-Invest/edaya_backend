import type { CountryCode, StructureTemplateDefinition, StructureTemplateId } from './types'
import { resolveCountryCode } from './country'
import { IVORY_COAST_STRUCTURE_TEMPLATES } from './ivory-coast/parse-ivory-coast-templates'

export { resolveCountryCode } from './country'
export type { CountryCode } from './types'

export const BUILTIN_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[] = [
  ...IVORY_COAST_STRUCTURE_TEMPLATES,
]

const BUILTIN_BY_ID = new Map(
  BUILTIN_STRUCTURE_TEMPLATES.map(template => [template.id, template]),
)

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

export function isStructureTemplateId(value: string): value is StructureTemplateId {
  return value.startsWith('ci-')
}

export function resolveStructureTemplates(
  templateIds: StructureTemplateId[],
  snapshots: StructureTemplateDefinition[] = [],
): StructureTemplateDefinition[] {
  const snapshotById = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]))

  return templateIds.map((templateId) => {
    const snapshot = snapshotById.get(templateId)
    if (snapshot) {
      return snapshot
    }
    const builtin = BUILTIN_BY_ID.get(templateId)
    if (builtin) {
      return builtin
    }
    throw new Error(`Unknown structure template: ${templateId}`)
  })
}

export function parseGradeLevelTemplateId(gradeLevelId: string): {
  templateId: StructureTemplateId
  levelCode: string
} | null {
  const separatorIndex = gradeLevelId.indexOf(':')
  if (separatorIndex <= 0) {
    return null
  }
  const templateId = gradeLevelId.slice(0, separatorIndex)
  const levelCode = gradeLevelId.slice(separatorIndex + 1)
  if (!isStructureTemplateId(templateId) || !levelCode) {
    return null
  }
  return { templateId, levelCode }
}

export type ClassNamingMode = 'alphabetical' | 'numerical'

const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const

/**
 * Class name from a grade level label used as stem: `6ème` + index 0
 * gives `6ème 1` (numerical) or `6ème A` (alphabetical).
 * Single source of truth shared by onboarding, seeds and QA fixtures.
 */
export function classNameFromLabel(
  label: string,
  index: number,
  mode: ClassNamingMode = 'numerical',
): string {
  if (mode === 'alphabetical') {
    const letter = CLASS_LETTERS[index]
    if (letter) {
      return `${label} ${letter}`
    }
  }
  return `${label} ${index + 1}`
}

/** Class display names from the template short label + alphabetical/numerical increment. */
export function classDisplayName(
  template: StructureTemplateDefinition,
  levelCode: string,
  index: number,
  mode: ClassNamingMode = 'numerical',
): string {
  const level = template.gradeLevels.find(entry => entry.code === levelCode)
  if (!level) {
    throw new Error(`Unknown grade level ${levelCode} for template ${template.id}`)
  }
  return classNameFromLabel(level.shortLabel, index, mode)
}
