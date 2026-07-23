import type { ApiGradeLevelTemplateId } from './seed-ids'

/**
 * Display names aligned with the webapp onboarding structure step
 * (`edaya_web/.../structure-templates.ts`).
 */
export const ONBOARDING_WIZARD_GRADE_LEVEL_LABELS = {
  'ci-college:6EME': { name: '6ème', shortLabel: '6e' },
  'ci-college:5EME': { name: '5ème', shortLabel: '5e' },
  'ci-college:4EME': { name: '4ème', shortLabel: '4e' },
  'ci-college:3EME': { name: '3ème', shortLabel: '3e' },
  'ci-lycee:2NDC': { name: '2nde', shortLabel: '2nde' },
  'ci-lycee:1ERC': { name: '1ère', shortLabel: '1ère' },
  'ci-lycee:TLEC': { name: 'Terminale', shortLabel: 'Terminale' },
} as const satisfies Record<
  ApiGradeLevelTemplateId,
  { name: string, shortLabel: string }
>

export function onboardingWizardGradeLevelLabels(
  templateGradeLevelId: string,
): { name: string, shortLabel: string } | undefined {
  return ONBOARDING_WIZARD_GRADE_LEVEL_LABELS[
    templateGradeLevelId as ApiGradeLevelTemplateId
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
  const letter = CLASS_LETTERS[index] ?? String(index + 1)
  return `${labels.shortLabel} ${letter}`
}
