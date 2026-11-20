import type { StructureTemplateDefinition, StructureTemplateId } from './structure-template-types'

export function isStructureTemplateId(value: string): value is StructureTemplateId {
  return value.trim().length > 0 && !value.includes(':')
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
