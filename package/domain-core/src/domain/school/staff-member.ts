import type { StaffAccountKind } from './staff-account-kind'
import type { StaffProfileRole } from './staff-profile-role'

import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'
import { optionalHumanIdentifierSchema, shortNameSchema } from '../shared/visible-identification'

import { STAFF_ACCOUNT_KINDS } from './staff-account-kind'
import { STAFF_PROFILE_ROLES } from './staff-profile-role'

function refineStaffMember(data: {
  accountKind?: StaffAccountKind
  serviceId?: string
  subjectId?: string
  serviceElevated?: boolean
}, ctx: z.RefinementCtx) {
  const accountKind = data.accountKind ?? 'human'
  const serviceElevated = data.serviceElevated ?? false

  if (accountKind === 'service') {
    if (!data.serviceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'serviceId is required for service accounts',
        path: ['serviceId'],
      })
    }
    if (data.subjectId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'service accounts must not have a subjectId',
        path: ['subjectId'],
      })
    }
    return
  }

  if (data.serviceId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'serviceId is only allowed for service accounts',
      path: ['serviceId'],
    })
  }
  if (serviceElevated) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'serviceElevated is only allowed for service accounts',
      path: ['serviceElevated'],
    })
  }
}

export const staffMemberBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  firstName: z.string().trim().min(1, 'firstName must not be blank'),
  lastName: z.string().trim().min(1, 'lastName must not be blank'),
  identifier: optionalHumanIdentifierSchema,
  name: z.string().trim().min(1).optional(),
  shortName: shortNameSchema.optional(),
  photoUrl: z.string().trim().min(1, 'photoUrl must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  email: z.string().trim().min(1, 'email must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  phone: z.string().trim().min(1, 'phone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationEmail: z.string().trim().min(1, 'notificationEmail must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationPhone: z.string().trim().min(1, 'notificationPhone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  accountKind: z.enum(STAFF_ACCOUNT_KINDS).default('human'),
  serviceId: z.string().trim().min(1, 'serviceId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdBySubjectId: z.string().trim().min(1, 'createdBySubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  serviceElevated: z.boolean().default(false),
  isActive: z.boolean().default(true),
  onboardingWizardCompletedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  onboardingMaxReachedStep: z.number().int().min(1).max(4).nullable().optional().transform(v => v === null ? undefined : v),
  profileRole: z.enum(STAFF_PROFILE_ROLES).nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export const staffMemberSchema = staffMemberBaseSchema.superRefine(refineStaffMember)

export type StaffMemberData = z.infer<typeof staffMemberSchema>
export type StaffMemberInput = z.input<typeof staffMemberSchema>

export const staffMemberCreateSchema = staffMemberBaseSchema.omit({ createdAt: true }).superRefine(refineStaffMember)
export const staffMemberUpdateSchema = staffMemberBaseSchema.partial().required({ id: true }).superRefine(refineStaffMember)

/**
 * Represents a school staff member.
 */
export class StaffMember {
  readonly data: StaffMemberData

  copyWith(changes: Partial<StaffMemberInput>): StaffMember { return new StaffMember({ ...this.data, ...changes }) }

  constructor(args: StaffMemberInput) {
    this.data = parseDomain(staffMemberSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.data.name }
  get identifier() { return this.data.identifier }
  get photoUrl() { return this.data.photoUrl }
  get email() { return this.data.email }
  get phone() { return this.data.phone }
  get notificationEmail() { return this.data.notificationEmail }
  get notificationPhone() { return this.data.notificationPhone }
  get subjectId() { return this.data.subjectId }
  get accountKind(): StaffAccountKind { return this.data.accountKind }
  get serviceId() { return this.data.serviceId }
  get createdBySubjectId() { return this.data.createdBySubjectId }
  get serviceElevated() { return this.data.serviceElevated }
  get isActive() { return this.data.isActive }
  get onboardingWizardCompletedAt() { return this.data.onboardingWizardCompletedAt }
  get onboardingMaxReachedStep() { return this.data.onboardingMaxReachedStep }
  get profileRole(): StaffProfileRole | undefined { return this.data.profileRole }
  get createdAt() { return this.data.createdAt }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }
}
