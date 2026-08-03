import { describe, expect, it } from 'bun:test'
import { BUILTIN_STRUCTURE_TEMPLATES, classDisplayName } from '../../src/onboarding/registry'

const college = BUILTIN_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-college')!
const lycee = BUILTIN_STRUCTURE_TEMPLATES.find(template => template.id === 'ci-lycee')!

describe('classDisplayName', () => {
  it('uses fixture code with numerical increment by default', () => {
    expect(classDisplayName(college, '6EME', 0)).toBe('6EME 1')
    expect(classDisplayName(college, '6EME', 1, 'numerical')).toBe('6EME 2')
  })

  it('uses fixture code with alphabetical increment', () => {
    expect(classDisplayName(college, '4EME', 0, 'alphabetical')).toBe('4EME A')
    expect(classDisplayName(college, '4EME', 1, 'alphabetical')).toBe('4EME B')
  })

  it('falls back to numbers after letter J for alphabetical mode', () => {
    expect(classDisplayName(college, '6EME', 10, 'alphabetical')).toBe('6EME 11')
  })

  it('names lycée series from fixture code', () => {
    expect(classDisplayName(lycee, '2NDA', 0, 'numerical')).toBe('2NDA 1')
    expect(classDisplayName(lycee, '2NDA', 0, 'alphabetical')).toBe('2NDA A')
  })
})
