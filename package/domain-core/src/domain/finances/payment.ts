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
}

export enum PaymentKind {
  Receipt = 'receipt',
  Disbursement = 'disbursement',
}

export const paymentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  accountId: z.string().trim().min(1, 'accountId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  kind: z.nativeEnum(PaymentKind).default(PaymentKind.Receipt),
  amount: z.number().int().positive('amount must be a strictly positive integer'),
  currency: z.string().trim().min(1, 'currency must not be blank'),
  paymentDate: zodDate(),
  method: z.nativeEnum(PaymentMethod),
  status: z.nativeEnum(PaymentStatus).default(PaymentStatus.Recorded),
  reference: z.string().trim().min(1, 'reference must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  recordedById: z.string().trim().min(1, 'recordedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reversesPaymentId: z.string().trim().min(1, 'reversesPaymentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reversedByPaymentId: z.string().trim().min(1, 'reversedByPaymentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  reversedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  reversedById: z.string().trim().min(1, 'reversedById must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refinePayment(data: any, ctx: z.RefinementCtx) {
  if (data.status === PaymentStatus.Reversed && (!data.reversedAt || !data.reversedById)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reversedAt and reversedById are required for reversed payments',
    })
  }
  if (data.status === PaymentStatus.Recorded && (data.reversedAt || data.reversedById || data.reversedByPaymentId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'recorded payments must not define reversal audit fields',
    })
  }
  if (data.kind === PaymentKind.Disbursement && data.reversesPaymentId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'disbursements must not reverse a receipt; use a receipt reversal',
      path: ['reversesPaymentId'],
    })
  }
}

export const paymentSchema = paymentBaseSchema.superRefine(refinePayment)

export type PaymentData = Omit<z.infer<typeof paymentSchema>, 'amount' | 'currency'> & {
  amount: Money
}
export type PaymentInput = z.input<typeof paymentSchema>

export const paymentCreateSchema = paymentBaseSchema.omit({ createdAt: true }).superRefine(refinePayment)
export const paymentUpdateSchema = paymentBaseSchema.partial().required({ id: true }).superRefine((data, ctx) => {
  if (data.status === PaymentStatus.Reversed && data.reversedAt !== undefined && data.reversedById !== undefined && data.reversedByPaymentId !== undefined) {
    if (!data.reversedAt || !data.reversedById || !data.reversedByPaymentId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reversedAt, reversedById, and reversedByPaymentId are required for reversed payments',
      })
    }
  }
})

export class Payment {
  readonly data: PaymentData

  constructor(args: PaymentInput) {
    const validated = parseDomain(paymentSchema, args)
    this.data = {
      id: validated.id,
      schoolId: validated.schoolId,
      accountId: validated.accountId,
      academicYearId: validated.academicYearId,
      kind: validated.kind,
      amount: new Money({ amount: validated.amount, currency: validated.currency }),
      paymentDate: validated.paymentDate,
      method: validated.method,
      status: validated.status,
      reference: validated.reference,
      notes: validated.notes,
      recordedById: validated.recordedById,
      reversesPaymentId: validated.reversesPaymentId,
      reversedByPaymentId: validated.reversedByPaymentId,
      reversedAt: validated.reversedAt,
      reversedById: validated.reversedById,
      createdAt: validated.createdAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get accountId() { return this.data.accountId }
  get academicYearId() { return this.data.academicYearId }
  get kind() { return this.data.kind }
  get amount() { return this.data.amount }
  get paymentDate() { return this.data.paymentDate }
  get method() { return this.data.method }
  get status() { return this.data.status }
  get reference() { return this.data.reference }
  get notes() { return this.data.notes }
  get recordedById() { return this.data.recordedById }
  get reversesPaymentId() { return this.data.reversesPaymentId }
  get reversedByPaymentId() { return this.data.reversedByPaymentId }
  get reversedAt() { return this.data.reversedAt }
  get reversedById() { return this.data.reversedById }
  get createdAt() { return this.data.createdAt }

  get isReceipt() {
    return this.kind === PaymentKind.Receipt
  }

  copyWith(changes: Partial<PaymentInput>): Payment {
    return new Payment({
      id: this.id,
      schoolId: this.schoolId,
      accountId: this.accountId,
      academicYearId: this.academicYearId,
      kind: this.kind,
      amount: this.amount.amount,
      currency: this.amount.currency,
      paymentDate: this.paymentDate,
      method: this.method,
      status: this.status,
      reference: this.reference,
      notes: this.notes,
      recordedById: this.recordedById,
      reversesPaymentId: this.reversesPaymentId,
      reversedByPaymentId: this.reversedByPaymentId,
      reversedAt: this.reversedAt,
      reversedById: this.reversedById,
      createdAt: this.createdAt,
      ...changes,
    })
  }
}
