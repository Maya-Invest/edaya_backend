import { describe, expect, it } from 'bun:test'
import {
  onboardingWizardClassDisplayName,
  onboardingWizardGradeLevelLabels,
} from '../../src/onboarding/wizard-grade-level-labels'

describe('onboarding wizard grade level labels', () => {
  it('maps CI onboarding template ids to wizard display names', () => {
    expect(onboardingWizardGradeLevelLabels('ci-college:6EME')).toEqual({
      name: '6ème',
      shortLabel: '6e',
    })
    expect(onboardingWizardGradeLevelLabels('ci-lycee:TLEC')).toEqual({
      name: 'Terminale',
      shortLabel: 'Terminale',
    })
    expect(onboardingWizardGradeLevelLabels('ci-primaire:CP1')).toBeUndefined()
  })

  it('builds class names like the webapp structure step', () => {
    expect(onboardingWizardClassDisplayName('ci-college:4EME', 0)).toBe('4e A')
    expect(onboardingWizardClassDisplayName('ci-college:4EME', 1)).toBe('4e B')
    expect(onboardingWizardClassDisplayName('ci-lycee:2NDC', 0)).toBe('2nde A')
  })
})
