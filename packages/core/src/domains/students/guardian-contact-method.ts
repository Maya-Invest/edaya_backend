import { z } from 'zod'
import { DomainValidationError, formatZodError } from '../utils'

export enum GuardianContactMethodType {
  Phone = 'phone',
  Email = 'email',
  Whatsapp = 'whatsapp',
  Sms = 'sms',
  Other = 'other',
}

export const guardianContactMethodSchema = z.object({
  type: z.nativeEnum(GuardianContactMethodType),
  value: z.string().trim().min(1, 'value must not be blank'),
  label: z.string().trim().min(1, 'label must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  isPrimary: z.boolean().default(false),
  allowsNotifications: z.boolean().default(true),
})

export type GuardianContactMethodData = z.infer<typeof guardianContactMethodSchema>

export interface GuardianContactMethodArgs {
  type: GuardianContactMethodType
  value: string
  label?: string | null
  isPrimary?: boolean
  allowsNotifications?: boolean
}

/**
 * Value object describing one way to contact a guardian.
 */
export class GuardianContactMethod {
  readonly data: GuardianContactMethodData

  constructor(args: GuardianContactMethodArgs) {
    const result = guardianContactMethodSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get type() { return this.data.type }
  get value() { return this.data.value }
  get label() { return this.data.label }
  get isPrimary() { return this.data.isPrimary }
  get allowsNotifications() { return this.data.allowsNotifications }
}
