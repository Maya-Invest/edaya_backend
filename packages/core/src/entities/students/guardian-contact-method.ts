import { requireNonBlank } from '$lib/core/utils/validation'

export enum GuardianContactMethodType {
  Phone = 'phone',
  Email = 'email',
  Whatsapp = 'whatsapp',
  Sms = 'sms',
  Other = 'other',
}

export interface GuardianContactMethodArgs {
  type: GuardianContactMethodType
  value: string
  label?: string
  isPrimary?: boolean
  allowsNotifications?: boolean
}

/**
 * Value object describing one way to contact a guardian.
 */
export class GuardianContactMethod {
  readonly type: GuardianContactMethodType
  readonly value: string
  readonly label?: string
  readonly isPrimary: boolean
  readonly allowsNotifications: boolean

  constructor({
    type,
    value,
    label,
    isPrimary = false,
    allowsNotifications = true,
  }: GuardianContactMethodArgs) {
    this.type = type
    this.value = requireNonBlank(value, 'value')
    this.label = label ? requireNonBlank(label, 'label') : undefined
    this.isPrimary = isPrimary
    this.allowsNotifications = allowsNotifications
  }
}
