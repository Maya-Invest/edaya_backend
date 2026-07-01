import { z } from 'zod'
import { parseDomain } from '../../domain/shared/utils'

export const moneySchema = z.object({
  amount: z.number().int().nonnegative('amount must be a non-negative integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
})

export type MoneyData = z.infer<typeof moneySchema>
export type MoneyInput = z.input<typeof moneySchema>

/**
 * Represents a monetary value in minor units for a single currency.
 */
export class Money {
  readonly amount: number
  readonly currency: string

  constructor(input: MoneyInput) {
    const data = parseDomain(moneySchema, input)
    this.amount = data.amount
    this.currency = data.currency
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
