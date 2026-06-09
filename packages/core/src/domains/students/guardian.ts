import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { AttachmentOwnerKind } from '../../domains'
import { directPermissionEntityConfig, readByIds } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'
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
  subjectId?: string | null
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
  readonly subjectId?: string
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
    subjectId,
    contactMethods,
    hasAccess = true,
    premiumNotificationsEnabled = false,
    createdAt,
  }: GuardianArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.firstName = requireNonBlank(firstName, 'firstName')
    this.lastName = requireNonBlank(lastName, 'lastName')
    this.subjectId = requireOptionalNonBlank(subjectId, 'subjectId')
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

export const guardianConfig: EntityConfigFactory<Guardian> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.guardians,
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.PARENT_UPDATE,
    readByIds((actor, ids) => input.policy.checkGuardianAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preDelete: validateGuardianDelete,
    },
  }
}

async function validateGuardianDelete(
  guardian: Guardian,
  repositories: SchoolRepositories,
): Promise<void> {
  const [links, attachments] = await Promise.all([
    repositories.guardianLinks.list({ guardianId: guardian.id }),
    repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Guardian, ownerId: guardian.id }),
  ])
  if (links.length > 0 || attachments.length > 0) {
    throw new BusinessRuleViolationError('GUARDIAN_HAS_DEPENDENCIES', `Cannot delete guardian ${guardian.id}: dependent records still exist`)
  }
}
