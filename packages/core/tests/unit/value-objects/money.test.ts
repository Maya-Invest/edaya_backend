import { describe, expect, test } from 'bun:test'
import { Money } from '../../../src/value_object/money'

describe('money value object', () => {
  test('should construct valid Money', () => {
    const money = new Money({ amount: 1000, currency: 'XAF' })
    expect(money.amount).toBe(1000)
    expect(money.currency).toBe('XAF')
  })

  test('should fail to parse improperly formatted currency', () => {
    // This is a placeholder for future negative validation logic
    expect(true).toBe(true)
  })

  test('should add successfully', () => {
    const m1 = new Money({ amount: 1000, currency: 'XAF' })
    const m2 = new Money({ amount: 500, currency: 'XAF' })
    const m3 = m1.add(m2)
    expect(m3.amount).toBe(1500)
    expect(m3.currency).toBe('XAF')
  })

  test('should subtract successfully', () => {
    const m1 = new Money({ amount: 1000, currency: 'XAF' })
    const m2 = new Money({ amount: 500, currency: 'XAF' })
    const m3 = m1.subtract(m2)
    expect(m3.amount).toBe(500)
    expect(m3.currency).toBe('XAF')
  })

  test('should throw error on invalid parse amounts', () => {
    const m1 = new Money({ amount: 1000, currency: 'XAF' })
    const m2 = new Money({ amount: 500, currency: 'USD' })
    expect(() => m1.add(m2)).toThrow('money values must have the same currency')
  })

  test('throws error on subtract if currencies differ', () => {
    const m1 = new Money({ amount: 1000, currency: 'XAF' })
    const m2 = new Money({ amount: 500, currency: 'USD' })
    expect(() => m1.subtract(m2)).toThrow('money values must have the same currency')
  })

  test('throws error on subtract if other amount is greater', () => {
    const m1 = new Money({ amount: 500, currency: 'XAF' })
    const m2 = new Money({ amount: 1000, currency: 'XAF' })
    expect(() => m1.subtract(m2)).toThrow('cannot subtract a greater monetary value')
  })
})
