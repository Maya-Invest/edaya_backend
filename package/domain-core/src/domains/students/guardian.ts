import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { AttachmentOwnerKind } from '../../domains'
import { anyPermissionAction, directPermissionEntityConfig, readByIds } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { parseDomain, zodDate } from '../utils'
import {
  GuardianContactMethod,
  guardianContactMethodSchema,
  GuardianContactMethodType,
} from './guardian-contact-method'

export const guardianSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  firstName: z.string().trim().min(1, 'firstName must not be blank'),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  phone: z.string().trim().min(1, 'phone must not be blank').nullable().optional(),
  email: z.string().trim().min(1, 'email must not be blank').nullable().optional(),
  notificationEmail: z.string().trim().min(1, 'notificationEmail must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationPhone: z.string().trim().min(1, 'notificationPhone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  contactMethods: z.array(z.union([z.instanceof(GuardianContactMethod), guardianContactMethodSchema])).default([]),
  hasAccess: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export type GuardianData = Omit<z.infer<typeof guardianSchema>, 'contactMethods'> & {
  contactMethods: readonly GuardianContactMethod[]
}
export type GuardianInput = z.input<typeof guardianSchema>

export const guardianCreateSchema = guardianSchema.omit({ createdAt: true })
export const guardianUpdateSchema = guardianSchema.partial().required({ id: true })

/**
 * Represents a parent, guardian, or sponsor of one or more students.
 * Manages their contact details and system access permissions.
 */
export class Guardian {
  readonly data: GuardianData

  constructor(args: GuardianInput) {
    const data = parseDomain(guardianSchema, args)
    const builtContactMethods = data.contactMethods.map(item =>
      item instanceof GuardianContactMethod ? item : new GuardianContactMethod(item),
    )
    const normalizedPhone = data.phone ?? undefined
    const normalizedEmail = data.email ?? undefined
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
    const finalContactMethods = Object.freeze(Guardian.normalizeContactMethods(builtContactMethods))
    this.data = {
      ...data,
      contactMethods: finalContactMethods,
      phone: finalContactMethods.find(item => item.type === GuardianContactMethodType.Phone)?.value,
      email: finalContactMethods.find(item => item.type === GuardianContactMethodType.Email)?.value,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get contactMethods() { return this.data.contactMethods }
  get subjectId() { return this.data.subjectId }
  get hasAccess() { return this.data.hasAccess }
  get notificationEmail() { return this.data.notificationEmail }
  get notificationPhone() { return this.data.notificationPhone }
  get createdAt() { return this.data.createdAt }

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
  config.read.checkModule = anyPermissionAction([
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.QUERY_GUARDIAN_SELF_READ,
  ])
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
