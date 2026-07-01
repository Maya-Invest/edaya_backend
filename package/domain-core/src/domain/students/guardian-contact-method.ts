import { z } from 'zod'
import { parseDomain } from '../shared/utils'

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
export type GuardianContactMethodInput = z.input<typeof guardianContactMethodSchema>

/**
 * Value object describing one way to contact a guardian.
 */
export class GuardianContactMethod {
  readonly data: GuardianContactMethodData

  constructor(args: GuardianContactMethodInput) {
    this.data = parseDomain(guardianContactMethodSchema, args)
  }

  get type() { return this.data.type }
  get value() { return this.data.value }
  get label() { return this.data.label }
  get isPrimary() { return this.data.isPrimary }
  get allowsNotifications() { return this.data.allowsNotifications }
}
