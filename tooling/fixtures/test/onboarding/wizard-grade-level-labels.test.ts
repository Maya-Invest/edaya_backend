import { describe, expect, it } from 'bun:test'
import {
  onboardingWizardClassDisplayName,
  onboardingWizardGradeLevelLabels,
} from '../../src/onboarding/wizard-grade-level-labels'

describe('onboarding wizard grade level labels', () => {
  it('maps CI onboarding template ids to series display names', () => {
    expect(onboardingWizardGradeLevelLabels('ci-college:6EME')).toEqual({
      name: '6ème',
      shortLabel: '6e',
    })
    expect(onboardingWizardGradeLevelLabels('ci-lycee:2NDA')).toEqual({
      name: 'Seconde A',
      shortLabel: '2nde A',
    })
    expect(onboardingWizardGradeLevelLabels('ci-lycee:2NDC')).toEqual({
      name: 'Seconde C',
      shortLabel: '2nde C',
    })
    expect(onboardingWizardGradeLevelLabels('ci-lycee:TLEC')).toEqual({
      name: 'Terminale C',
      shortLabel: 'Tle C',
    })
    expect(onboardingWizardGradeLevelLabels('ci-primaire:CP1')).toBeUndefined()
  })

  it('builds class names from series short labels', () => {
    expect(onboardingWizardClassDisplayName('ci-college:4EME', 0)).toBe('4e A')
    expect(onboardingWizardClassDisplayName('ci-college:4EME', 1)).toBe('4e B')
    expect(onboardingWizardClassDisplayName('ci-lycee:2NDC', 0)).toBe('2nde C 1')
    expect(onboardingWizardClassDisplayName('ci-lycee:2NDA', 0)).toBe('2nde A 1')
  })
})
