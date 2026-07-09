import { z } from 'zod'

import { Money } from '../../domain/value-objects/money'

import { parseDomain, zodDate } from '../shared/utils'

export enum PaymentMethod {
  Cash = 'cash',
  Card = 'card',
  BankTransfer = 'bank_transfer',
  MobileMoney = 'mobile_money',
  Other = 'other',
}

export enum PaymentStatus {
  Recorded = 'recorded',
  Reversed = 'reversed',
  Cancelled = 'cancelled',
}

export const paymentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  studentFeeId: z.string().trim().min(1, 'studentFeeId must not be blank'),
  amount: z.number().int().nonnegative('amount must be a non-negative integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  paymentDate: zodDate(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.Recorded),
  reference: z.string().trim().min(1, 'reference must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  recordedById: z.string().trim().min(1, 'recordedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reversedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  reversedById: z.string().trim().min(1, 'reversedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  cancelledAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  cancelledById: z.string().trim().min(1, 'cancelledById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refinePayment(data: any, ctx: z.RefinementCtx) {
  if (data.status === PaymentStatus.Reversed && (!data.reversedAt || !data.reversedById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reversedAt and reversedById are required for reversed payments',
    })
  }
  if (data.status === PaymentStatus.Cancelled && (!data.cancelledAt || !data.cancelledById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'cancelledAt and cancelledById are required for cancelled payments',
    })
  }
  if (data.status === PaymentStatus.Recorded && (data.reversedAt || data.reversedById || data.cancelledAt || data.cancelledById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'recorded payments must not define reversal or cancellation audit fields',
    })
  }
}

export const paymentSchema = paymentBaseSchema.superRefine(refinePayment)

export type PaymentData = Omit<z.infer<typeof paymentSchema>, 'amount' | 'currency'> & {
  amount: Money
}
export type PaymentInput = z.input<typeof paymentSchema>

export const paymentCreateSchema = paymentBaseSchema.omit({ createdAt: true }).superRefine(refinePayment)
export const paymentUpdateSchema = paymentBaseSchema.partial().required({ id: true }).superRefine(refinePayment)

/**
 * Represents a single financial transaction made towards a StudentFee.
 */
export class Payment {
  readonly data: PaymentData

  constructor(args: PaymentInput) {
    const validated = parseDomain(paymentSchema, args)
    this.data = {
      id: validated.id,
      studentFeeId: validated.studentFeeId,
      amount: new Money({ amount: validated.amount, currency: validated.currency }),
      paymentDate: validated.paymentDate,
      method: validated.method,
      status: validated.status,
      reference: validated.reference,
      notes: validated.notes,
      recordedById: validated.recordedById,
      reversedAt: validated.reversedAt,
      reversedById: validated.reversedById,
      cancelledAt: validated.cancelledAt,
      cancelledById: validated.cancelledById,
      createdAt: validated.createdAt,
    }
  }

  get id() { return this.data.id }
  get studentFeeId() { return this.data.studentFeeId }
  get amount() { return this.data.amount }
  get paymentDate() { return this.data.paymentDate }
  get method() { return this.data.method }
  get status() { return this.data.status }
  get reference() { return this.data.reference }
  get notes() { return this.data.notes }
  get recordedById() { return this.data.recordedById }
  get reversedAt() { return this.data.reversedAt }
  get reversedById() { return this.data.reversedById }
  get cancelledAt() { return this.data.cancelledAt }
  get cancelledById() { return this.data.cancelledById }
  get createdAt() { return this.data.createdAt }
}
