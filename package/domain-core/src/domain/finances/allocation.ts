import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'
import { parseDomain, zodDate } from '../shared/utils'

export enum AllocationKind {
  Settle = 'settle',
  Reverse = 'reverse',
}

export const allocationBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  accountId: z.string().trim().min(1, 'accountId must not be blank'),
  chargeId: z.string().trim().min(1, 'chargeId must not be blank'),
  amount: z.number().int().positive('amount must be a strictly positive integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  kind: z.nativeEnum(AllocationKind),
  causedByPaymentId: z.string().trim().min(1, 'causedByPaymentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reversesAllocationId: z.string().trim().min(1, 'reversesAllocationId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  effectiveAt: zodDate(),
  recordedAt: zodDate().default(() => new Date()),
  createdAt: zodDate().default(() => new Date()),
})

function refineAllocation(data: z.infer<typeof allocationBaseSchema>, ctx: z.RefinementCtx) {
  if (data.kind === AllocationKind.Reverse && !data.reversesAllocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reversesAllocationId'],
      message: 'reversesAllocationId is required for reverse allocations',
    })
  }
  if (data.kind === AllocationKind.Settle && data.reversesAllocationId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reversesAllocationId'],
      message: 'settle allocations must not reverse another allocation',
    })
  }
}

export const allocationSchema = allocationBaseSchema.superRefine(refineAllocation)

export type AllocationData = Omit<z.infer<typeof allocationSchema>, 'amount' | 'currency'> & {
  amount: Money
}
export type AllocationInput = z.input<typeof allocationSchema>

export class Allocation {
  readonly data: AllocationData

  constructor(args: AllocationInput) {
    const validated = parseDomain(allocationSchema, args)
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      accountId: validated.accountId,
      chargeId: validated.chargeId,
      amount: new Money({ amount: validated.amount, currency: validated.currency }),
      kind: validated.kind,
      causedByPaymentId: validated.causedByPaymentId,
      reversesAllocationId: validated.reversesAllocationId,
      effectiveAt: validated.effectiveAt,
      recordedAt: validated.recordedAt,
      createdAt: validated.createdAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get accountId() { return this.data.accountId }
  get chargeId() { return this.data.chargeId }
  get amount() { return this.data.amount }
  get kind() { return this.data.kind }
  get causedByPaymentId() { return this.data.causedByPaymentId }
  get reversesAllocationId() { return this.data.reversesAllocationId }
  get effectiveAt() { return this.data.effectiveAt }
  get recordedAt() { return this.data.recordedAt }
  get createdAt() { return this.data.createdAt }

  get isSettle() {
    return this.kind === AllocationKind.Settle
  }
}
