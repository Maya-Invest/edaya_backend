import type { ApiGradeLevelTemplateId } from './seed-ids'

/**
 * Display names for grade levels persisted at onboarding apply-structure time.
 * Lycée series keep their full names (Seconde A, Seconde C, …) — never a bare "2nde".
 */
export const ONBOARDING_WIZARD_GRADE_LEVEL_LABELS = {
  'ci-college:6EME': { name: '6ème', shortLabel: '6e' },
  'ci-college:5EME': { name: '5ème', shortLabel: '5e' },
  'ci-college:4EME': { name: '4ème', shortLabel: '4e' },
  'ci-college:3EME': { name: '3ème', shortLabel: '3e' },
  'ci-lycee:2NDA': { name: 'Seconde A', shortLabel: '2nde A' },
  'ci-lycee:2NDC': { name: 'Seconde C', shortLabel: '2nde C' },
  'ci-lycee:1ERA': { name: 'Première A', shortLabel: '1ère A' },
  'ci-lycee:1ERC': { name: 'Première C', shortLabel: '1ère C' },
  'ci-lycee:1ERD': { name: 'Première D', shortLabel: '1ère D' },
  'ci-lycee:TLEA': { name: 'Terminale A', shortLabel: 'Tle A' },
  'ci-lycee:TLEC': { name: 'Terminale C', shortLabel: 'Tle C' },
  'ci-lycee:TLED': { name: 'Terminale D', shortLabel: 'Tle D' },
} as const

export type OnboardingWizardGradeLevelId = keyof typeof ONBOARDING_WIZARD_GRADE_LEVEL_LABELS

/** Legacy seed-mapped ids remain covered by the wizard label table. */
const _assertSeedMappedLabels: Record<
  ApiGradeLevelTemplateId,
  { name: string, shortLabel: string }
> = {
  'ci-college:6EME': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-college:6EME'],
  'ci-college:5EME': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-college:5EME'],
  'ci-college:4EME': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-college:4EME'],
  'ci-college:3EME': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-college:3EME'],
  'ci-lycee:2NDC': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-lycee:2NDC'],
  'ci-lycee:1ERC': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-lycee:1ERC'],
  'ci-lycee:TLEC': ONBOARDING_WIZARD_GRADE_LEVEL_LABELS['ci-lycee:TLEC'],
}
void _assertSeedMappedLabels

export function onboardingWizardGradeLevelLabels(
  templateGradeLevelId: string,
): { name: string, shortLabel: string } | undefined {
  if (!(templateGradeLevelId in ONBOARDING_WIZARD_GRADE_LEVEL_LABELS)) {
    return undefined
  }
  return ONBOARDING_WIZARD_GRADE_LEVEL_LABELS[
    templateGradeLevelId as OnboardingWizardGradeLevelId
  ]
}

const CLASS_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'] as const

export function onboardingWizardClassDisplayName(
  templateGradeLevelId: string,
  index: number,
): string | undefined {
  const labels = onboardingWizardGradeLevelLabels(templateGradeLevelId)
  if (!labels) {
    return undefined
  }
  // Series labels already include A/C/D — number sections (2nde C 1) instead of "2nde C A".
  if (labels.shortLabel.includes(' ')) {
    return `${labels.shortLabel} ${index + 1}`
  }
  const letter = CLASS_LETTERS[index] ?? String(index + 1)
  return `${labels.shortLabel} ${letter}`
}
