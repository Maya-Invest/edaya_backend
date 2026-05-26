import { requireNonBlank, requireNonNegativeInt } from '../entities/utils'

/**
 * Represents a monetary value in minor units for a single currency.
 */
export class Money {
  readonly amount: number
  readonly currency: string

  constructor({ amount, currency }: { amount: number, currency: string }) {
    this.amount = requireNonNegativeInt(amount, 'amount')
    this.currency = requireNonBlank(currency, 'currency')
  }

  add(other: Money): Money {
    this.assertSameCurrency(other)
    return new Money({ amount: this.amount + other.amount, currency: this.currency })
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other)
    if (other.amount > this.amount) {
      throw new Error('cannot subtract a greater monetary value')
    }
    return new Money({ amount: this.amount - other.amount, currency: this.currency })
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error('money values must have the same currency')
    }
  }
}
