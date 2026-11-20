import { describe, expect, it } from 'bun:test'
import { BUILTIN_STRUCTURE_TEMPLATES, classDisplayName } from '../../src/onboarding/registry'

const college = BUILTIN_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-college')!
const lycee = BUILTIN_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-lycee')!

describe('classDisplayName', () => {
  it('uses the level short label with numerical increment by default', () => {
    expect(classDisplayName(college, '6EME', 0)).toBe('6ème 1')
    expect(classDisplayName(college, '6EME', 1, 'numerical')).toBe('6ème 2')
  })

  it('uses the level short label with alphabetical increment', () => {
    expect(classDisplayName(college, '4EME', 0, 'alphabetical')).toBe('4ème A')
    expect(classDisplayName(college, '4EME', 1, 'alphabetical')).toBe('4ème B')
  })

  it('falls back to numbers after letter J for alphabetical mode', () => {
    expect(classDisplayName(college, '6EME', 10, 'alphabetical')).toBe('6ème 11')
  })

  it('keeps the série inside the lycée stem', () => {
    expect(classDisplayName(lycee, '2NDA', 0, 'numerical')).toBe('2nde A 1')
  })

  it('accepts the doubled letter when a lycée school picks alphabetical', () => {
    expect(classDisplayName(lycee, '2NDA', 0, 'alphabetical')).toBe('2nde A A')
  })

  it('throws when the level is absent from the template', () => {
    expect(() => classDisplayName(college, 'TLEC', 0)).toThrow(
      'Unknown grade level TLEC for template ci-college',
    )
  })
})
