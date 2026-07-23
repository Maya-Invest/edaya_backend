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

export function classDisplayName(
  template: StructureTemplateDefinition,
  levelCode: string,
  index: number,
): string {
  const level = template.gradeLevels.find(entry => entry.code === levelCode)
  const shortLabel = level?.shortLabel ?? levelCode
  return `${shortLabel} ${index + 1}`
}
