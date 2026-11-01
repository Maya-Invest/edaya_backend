import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'
import { parseDomain, zodDate } from '../shared/utils'

export enum AccountEntryDirection {
  Credit = 'credit',
  Debit = 'debit',
}

export enum AccountEntrySourceKind {
  PaymentReceipt = 'payment_receipt',
  PaymentReversal = 'payment_reversal',
  AllocationSettle = 'allocation_settle',
  AllocationReverse = 'allocation_reverse',
  Refund = 'refund',
}

export const studentAccountEntryBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  accountId: z.string().trim().min(1, 'accountId must not be blank'),
  direction: z.nativeEnum(AccountEntryDirection),
  amount: z.number().int().positive('amount must be a strictly positive integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  sourceKind: z.nativeEnum(AccountEntrySourceKind),
  sourceId: z.string().trim().min(1, 'sourceId must not be blank'),
  commandId: z.string().trim().min(1, 'commandId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  effectiveAt: zodDate(),
  recordedAt: zodDate().default(() => new Date()),
  resultingAvailableBalance: z.number().int().nonnegative('resultingAvailableBalance must be a non-negative integer'),
  createdAt: zodDate().default(() => new Date()),
})

export const studentAccountEntrySchema = studentAccountEntryBaseSchema

export type StudentAccountEntryData = Omit<z.infer<typeof studentAccountEntrySchema>, 'amount' | 'currency' | 'resultingAvailableBalance'> & {
  amount: Money
  resultingAvailableBalance: Money
}
export type StudentAccountEntryInput = z.input<typeof studentAccountEntrySchema>

export class StudentAccountEntry {
  readonly data: StudentAccountEntryData

  constructor(args: StudentAccountEntryInput) {
    const validated = parseDomain(studentAccountEntrySchema, args)
    const currency = validated.currency
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      accountId: validated.accountId,
      direction: validated.direction,
      amount: new Money({ amount: validated.amount, currency }),
      sourceKind: validated.sourceKind,
      sourceId: validated.sourceId,
      commandId: validated.commandId,
      effectiveAt: validated.effectiveAt,
      recordedAt: validated.recordedAt,
      resultingAvailableBalance: new Money({ amount: validated.resultingAvailableBalance, currency }),
      createdAt: validated.createdAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get accountId() { return this.data.accountId }
  get direction() { return this.data.direction }
  get amount() { return this.data.amount }
  get sourceKind() { return this.data.sourceKind }
  get sourceId() { return this.data.sourceId }
  get commandId() { return this.data.commandId }
  get effectiveAt() { return this.data.effectiveAt }
  get recordedAt() { return this.data.recordedAt }
  get resultingAvailableBalance() { return this.data.resultingAvailableBalance }
  get createdAt() { return this.data.createdAt }

  get signedAmount(): number {
    return this.direction === AccountEntryDirection.Credit ? this.amount.amount : -this.amount.amount
  }
}
