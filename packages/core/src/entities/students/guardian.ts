import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'
import {
  GuardianContactMethod,
  GuardianContactMethodType,
} from './guardian-contact-method'

export interface GuardianArgs {
  id: string
  schoolId: string // !
  firstName: string
  lastName: string
  phone?: string | null
  email?: string | null
  contactMethods?: readonly GuardianContactMethod[]
  hasAccess?: boolean
  premiumNotificationsEnabled?: boolean
  createdAt?: Date
}

/**
 * Represents a parent, guardian, or sponsor of one or more students.
 * Manages their contact details and system access permissions.
 */
export class Guardian {
  readonly id: string
  readonly schoolId: string
  readonly firstName: string
  readonly lastName: string
  readonly contactMethods: readonly GuardianContactMethod[]
  readonly hasAccess: boolean
  readonly premiumNotificationsEnabled: boolean
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    firstName,
    lastName,
    phone,
    email,
    contactMethods,
    hasAccess = true,
    premiumNotificationsEnabled = false,
    createdAt,
  }: GuardianArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    const normalizedPhone = requireOptionalNonBlank(phone, 'phone')
    const normalizedEmail = requireOptionalNonBlank(email, 'email')
    const builtContactMethods = contactMethods ? [...contactMethods] : []
    if (normalizedPhone) {
      builtContactMethods.push(
        new GuardianContactMethod({
          type: GuardianContactMethodType.Phone,
          value: normalizedPhone,
          isPrimary: builtContactMethods.length === 0,
        }),
      )
    }
    if (normalizedEmail) {
      builtContactMethods.push(
        new GuardianContactMethod({
          type: GuardianContactMethodType.Email,
          value: normalizedEmail,
          isPrimary: builtContactMethods.length === 0,
        }),
      )
    }
    this.contactMethods = Object.freeze(Guardian.normalizeContactMethods(builtContactMethods))
    this.hasAccess = hasAccess
    this.premiumNotificationsEnabled = premiumNotificationsEnabled
    this.createdAt = createdAt ?? new Date()
  }

  get phone(): string | undefined {
    return this.contactMethods.find(item => item.type === GuardianContactMethodType.Phone)?.value
  }

  get email(): string | undefined {
    return this.contactMethods.find(item => item.type === GuardianContactMethodType.Email)?.value
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }

  private static normalizeContactMethods(
    contactMethods: readonly GuardianContactMethod[],
  ): readonly GuardianContactMethod[] {
    const uniqueMethods = new Map<string, GuardianContactMethod>()
    let primaryKey: string | undefined

    for (const method of contactMethods) {
      const key = Guardian.buildContactMethodKey(method.type, method.value)
      if (!uniqueMethods.has(key)) {
        uniqueMethods.set(key, method)
      }
      if (!primaryKey && method.isPrimary) {
        primaryKey = key
      }
    }

    const normalizedMethods = [...uniqueMethods.entries()].map(([key, method], index) => {
      const isPrimary = primaryKey ? key === primaryKey : index === 0
      return new GuardianContactMethod({
        type: method.type,
        value: method.value,
        label: method.label,
        isPrimary,
        allowsNotifications: method.allowsNotifications,
      })
    })

    return normalizedMethods
  }

  private static buildContactMethodKey(type: GuardianContactMethodType, value: string): string {
    const normalizedValue
      = type === GuardianContactMethodType.Email ? value.toLocaleLowerCase() : value
    return `${type}:${normalizedValue}`
  }
}
