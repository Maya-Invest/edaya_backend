import { parseGradeLevelTemplateId } from './registry'

/**
 * Maps onboarding API grade-level template ids to the mnemonic seed ids
 * used by demo fixtures (`gl-6`, `gl-5`, …) and the webapp structure step.
 */
export const API_GRADE_LEVEL_TEMPLATE_TO_SEED_ID = {
  'ci-college:6EME': 'gl-6',
  'ci-college:5EME': 'gl-5',
  'ci-college:4EME': 'gl-4',
  'ci-college:3EME': 'gl-3',
  'ci-lycee:2NDC': 'gl-2',
  'ci-lycee:1ERC': 'gl-1',
  'ci-lycee:TLEC': 'gl-t',
} as const satisfies Record<string, string>

export type ApiGradeLevelTemplateId = keyof typeof API_GRADE_LEVEL_TEMPLATE_TO_SEED_ID

export function structureGradeLevelSeedId(templateGradeLevelId: string): string {
  const mapped = API_GRADE_LEVEL_TEMPLATE_TO_SEED_ID[
    templateGradeLevelId as ApiGradeLevelTemplateId
  ]
  if (mapped) {
    return mapped
  }

  const parsed = parseGradeLevelTemplateId(templateGradeLevelId)
  if (!parsed) {
    throw new Error(`Unknown grade level template id: ${templateGradeLevelId}`)
  }

  return `gl-${parsed.levelCode.toLowerCase()}`
}

/**
 * Seed-style class group id (`6a`, `5b`, `ta`, `cp1a`, …).
 */
export function structureClassGroupSeedId(gradeLevelSeedId: string, index: number): string {
  const letterIndex = Math.max(0, Math.min(index, 25))
  const letter = String.fromCharCode(97 + letterIndex)
  const stem = gradeLevelSeedId.startsWith('gl-')
    ? gradeLevelSeedId.slice(3)
    : gradeLevelSeedId
  return `${stem}${letter}`
}
