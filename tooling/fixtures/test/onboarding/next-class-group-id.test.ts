import { describe, expect, it } from 'bun:test'
import {
  nextClassGroupIdForGradeSeed,
  nextOnboardingClassGroupId,
} from '../../src/onboarding/next-class-group-id'

describe('next class group id', () => {
  it('matches webapp import ids for collège levels', () => {
    const taken = new Set<string>()
    const counts = new Map<string, number>()

    const sixA = nextClassGroupIdForGradeSeed('gl-6', taken, counts)
    taken.add(sixA)
    const sixB = nextClassGroupIdForGradeSeed('gl-6', taken, counts)
    taken.add(sixB)
    expect(sixA).toBe('6a')
    expect(sixB).toBe('6b')
    expect(nextOnboardingClassGroupId('ci-college:4EME', taken, counts)).toBe('4a')
  })

  it('uses 2nd for the first seconde class', () => {
    const taken = new Set<string>()
    const counts = new Map<string, number>()
    expect(nextClassGroupIdForGradeSeed('gl-2', taken, counts)).toBe('2nd')
  })
})
