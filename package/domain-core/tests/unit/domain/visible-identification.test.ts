import { humanIdentifierSchema, normalizeHumanIdentifier, optionalHumanIdentifierSchema, shortNameSchema, suggestShortName } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('human identifiers', () => {
  test('normalizes compatible ASCII while preserving leading zeros', () => {
    expect(humanIdentifierSchema.parse('  ｓｔｕ-０００１２７  ')).toBe('STU-000127')
    expect(humanIdentifierSchema.parse('000127')).toBe('000127')
    expect(normalizeHumanIdentifier('élève')).toBe('éLèVE')
  })

  test.each(['', 'a b', 'élève', 'ß', 'a_b', '-A', 'A-', 'A--B', 'A'.repeat(21)])('rejects invalid identifier %j', (value) => {
    expect(humanIdentifierSchema.safeParse(value).success).toBe(false)
  })

  test.each([null, undefined, '', '  '])('accepts an absent identifier %j', (value) => {
    expect(optionalHumanIdentifierSchema.parse(value)).toBeUndefined()
  })
})

describe('short names', () => {
  test('preserves spelling and punctuation while normalizing display whitespace', () => {
    expect(shortNameSchema.parse('  Hist.-Ge\u0301o.\u00A0  A  ')).toBe('Hist.-Géo. A')
    expect(shortNameSchema.parse('Français')).toBe('Français')
  })

  test('counts graphemes rather than code units or code points', () => {
    const family = '👨‍👩‍👧‍👦'
    expect(shortNameSchema.parse(family.repeat(32))).toBe(family.repeat(32))
    expect(shortNameSchema.safeParse(family.repeat(33)).success).toBe(false)
    expect(shortNameSchema.parse('e\u0301'.repeat(32))).toBe('é'.repeat(32))
  })

  test.each(['', '   ', '\tMath', 'Math\n', 'Math\r', 'A\u0000B', 'A\u2028B', 'A\u2029B'])('rejects controls before trimming %j', (value) => {
    expect(shortNameSchema.safeParse(value).success).toBe(false)
  })

  test('uses curated display text or a grapheme-safe full-name suggestion', () => {
    expect(suggestShortName('Histoire et géographie')).toBe('Histoire et géographie')
    expect(suggestShortName('Histoire et géographie', 'Hist.-Géo.')).toBe('Hist.-Géo.')
    expect(suggestShortName('é'.repeat(33))).toBe('é'.repeat(32))
    expect(() => suggestShortName('Name', 'X'.repeat(33))).toThrow()
    expect(() => suggestShortName('Math\n')).toThrow()
  })
})
