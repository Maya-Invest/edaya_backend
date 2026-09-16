import { CORE_ENTITY_KEYS } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('CoreEntityMap', () => {
  test('keeps family feedback stores off generic entity keys', () => {
    expect(CORE_ENTITY_KEYS.some(key => key.toLowerCase().includes('familyfeedback'))).toBe(false)
  })
})
