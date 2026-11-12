import { z } from 'zod'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'
import { optionalHumanIdentifierSchema } from '../shared/visible-identification'

export function normalizeGuardianPhone(value: string): string {
  return value.trim().replace(/^#(?=\d)/, '+').replace(/[\s().-]/g, '').replace(/^00/, '+')
}

const guardianPhoneSchema = z.string().trim().min(1).transform(normalizeGuardianPhone).pipe(z.string().regex(/^\+?\d+$/, 'Invalid phone number')).nullable().optional()

export const guardianSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  occupation: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  sourceFullName: z.string().refine(v => v.trim().length > 0).nullable().optional().transform(v => v === null ? undefined : v),
  firstName: z.string().trim(),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  identifier: optionalHumanIdentifierSchema,
  photoUrl: z.string().trim().min(1, 'photoUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  phone: guardianPhoneSchema,
  alternativePhone: guardianPhoneSchema,
  email: z.string().trim().email().toLowerCase().nullable().optional(),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  emailNotificationsEnabled: z.boolean().default(true),
  smsNotificationsEnabled: z.boolean().default(true),
  pushNotificationsEnabled: z.boolean().default(true),
  hasAccess: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
})

export type GuardianData = z.infer<typeof guardianSchema>
export type GuardianInput = z.input<typeof guardianSchema>

export const guardianCreateSchema = guardianSchema.omit({ createdAt: true })
export const guardianUpdateSchema = guardianSchema.partial().required({ id: true })

/**
 * Represents a parent, guardian, or sponsor of one or more students.
 * Manages their contact details and system access permissions.
 */
export class Guardian {
  readonly data: GuardianData

  copyWith(changes: Partial<GuardianInput>): Guardian { return new Guardian({ ...this.data, ...changes }) }

  constructor(args: GuardianInput) {
    const data = parseDomain(guardianSchema, args)
    if (data.phone && data.phone === data.alternativePhone) {
      throw new BusinessRuleViolationError('DUPLICATE_GUARDIAN_PHONE', 'Main and alternative phone numbers must be different')
    }
    this.data = { ...data, phone: data.phone ?? undefined, alternativePhone: data.alternativePhone ?? undefined, email: data.email ?? undefined }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get occupation() { return this.data.occupation }
  get sourceFullName() { return this.data.sourceFullName }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get identifier() { return this.data.identifier }
  get photoUrl() { return this.data.photoUrl }
  get subjectId() { return this.data.subjectId }
  get hasAccess() { return this.data.hasAccess }
  get createdAt() { return this.data.createdAt }

  get phone() { return this.data.phone ?? undefined }
  get alternativePhone() { return this.data.alternativePhone ?? undefined }
  get email() { return this.data.email ?? undefined }
  get emailNotificationsEnabled() { return this.data.emailNotificationsEnabled }
  get smsNotificationsEnabled() { return this.data.smsNotificationsEnabled }
  get pushNotificationsEnabled() { return this.data.pushNotificationsEnabled }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim()
  }
}
