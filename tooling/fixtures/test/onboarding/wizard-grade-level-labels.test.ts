import { describe, expect, it } from 'bun:test'
import {
  onboardingWizardClassDisplayName,
  onboardingWizardGradeLevelLabels,
} from '../../src/onboarding/wizard-grade-level-labels'

describe('onboarding wizard grade level labels', () => {
  it('resolves known template ids and ignores unknown ones', () => {
    const college = onboardingWizardGradeLevelLabels('ci-college:6EME')
    expect(college).toBeDefined()
    expect(college!.name.trim().length).toBeGreaterThan(0)
    expect(college!.shortLabel.trim().length).toBeGreaterThan(0)

    const lycee = onboardingWizardGradeLevelLabels('ci-lycee:2NDC')
    expect(lycee).toBeDefined()
    expect(lycee!.shortLabel.includes(' ')).toBe(true)

    expect(onboardingWizardGradeLevelLabels('ci-primaire:CP1')).toBeUndefined()
  })

  it('builds class names from shortLabel (letter for collège, index for séries)', () => {
    const college = onboardingWizardGradeLevelLabels('ci-college:4EME')!
    expect(onboardingWizardClassDisplayName('ci-college:4EME', 0)).toBe(`${college.shortLabel} A`)
    expect(onboardingWizardClassDisplayName('ci-college:4EME', 1)).toBe(`${college.shortLabel} B`)

    const secondeC = onboardingWizardGradeLevelLabels('ci-lycee:2NDC')!
    expect(onboardingWizardClassDisplayName('ci-lycee:2NDC', 0)).toBe(`${secondeC.shortLabel} 1`)
    expect(onboardingWizardClassDisplayName('ci-lycee:2NDA', 0)).toBe(
      `${onboardingWizardGradeLevelLabels('ci-lycee:2NDA')!.shortLabel} 1`,
    )

    expect(onboardingWizardClassDisplayName('ci-primaire:CP1', 0)).toBeUndefined()
  })
})
