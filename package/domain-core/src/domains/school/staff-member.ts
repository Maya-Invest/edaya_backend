import type { ActorMetadata } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import type { StaffAccountKind } from './staff-account-kind'
import { z } from 'zod'
import {
  actorHasAnyPermission,
  AuthorizationError,
  AuthorizationErrorCode,
  Permission,
} from '../../authorization'
import {
  anyPermissionAction,
  authorizeDeleteByReadAccess,
  authorizeExistingById,
  config,
  directSchoolTenant,
  permissionAction,
  read,
  write,
} from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { parseDomain, zodDate } from '../utils'
import { STAFF_ACCOUNT_KINDS } from './staff-account-kind'

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
  email: z.string().trim().min(1, 'email must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationEmail: z.string().trim().min(1, 'notificationEmail must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notificationPhone: z.string().trim().min(1, 'notificationPhone must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  accountKind: z.enum(STAFF_ACCOUNT_KINDS).default('human'),
  serviceId: z.string().trim().min(1, 'serviceId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdBySubjectId: z.string().trim().min(1, 'createdBySubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  serviceElevated: z.boolean().default(false),
  isActive: z.boolean().default(true),
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

  constructor(args: StaffMemberInput) {
    this.data = parseDomain(staffMemberSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get firstName() { return this.data.firstName }
  get lastName() { return this.data.lastName }
  get email() { return this.data.email }
  get notificationEmail() { return this.data.notificationEmail }
  get notificationPhone() { return this.data.notificationPhone }
  get subjectId() { return this.data.subjectId }
  get accountKind(): StaffAccountKind { return this.data.accountKind }
  get serviceId() { return this.data.serviceId }
  get createdBySubjectId() { return this.data.createdBySubjectId }
  get serviceElevated() { return this.data.serviceElevated }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`
  }
}

function isSelfStaffMember(actor: ActorMetadata, staffMember: StaffMember): boolean {
  return actor.kind === 'staff' && actor.staffMemberId === staffMember.id
}

async function checkStaffMemberReadAccess(
  actor: ActorMetadata,
  entities: readonly StaffMember[],
): Promise<void> {
  for (const entity of entities) {
    if (isSelfStaffMember(actor, entity)) {
      continue
    }
    if (!actorHasAnyPermission(actor, [
      Permission.SCHOOL_STRUCTURE_CONFIGURE,
      Permission.STAFF_READ,
    ])) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Staff member read denied')
    }
  }
}

const STAFF_MEMBER_ADMIN_READ_PERMISSIONS = [
  Permission.SCHOOL_STRUCTURE_CONFIGURE,
  Permission.STAFF_READ,
] as const

export const staffMemberConfig: EntityConfigFactory<StaffMember> = (input) => {
  const checkStaffReadModule = anyPermissionAction([
    Permission.QUERY_WORKSPACE_READ,
    ...STAFF_MEMBER_ADMIN_READ_PERMISSIONS,
  ])

  return {
    ...config({
      repository: input.repositories.staffMembers,
      tenant: directSchoolTenant<StaffMember>(),
      read: read(checkStaffReadModule, checkStaffMemberReadAccess),
      write: write(
        permissionAction(Permission.SCHOOL_STRUCTURE_CONFIGURE),
        authorizeExistingById(checkStaffMemberReadAccess),
        authorizeDeleteByReadAccess(checkStaffMemberReadAccess),
      ),
      atomicExecution: input.atomicExecution,
    }),
    gates: {
      preSave: validateStaffMemberSave,
      preDelete: validateStaffMemberDelete,
    },
  }
}

export async function validateStaffMemberSave(
  staffMember: StaffMember,
  existing: StaffMember | undefined,
  repositories: SchoolRepositories,
  actor: ActorMetadata,
): Promise<void> {
  const school = await repositories.schools.findById(staffMember.schoolId)
  const ownerSubjectId = school?.ownerSubjectId
  const subjectId = staffMember.subjectId ?? existing?.subjectId
  if (existing?.isActive && !staffMember.isActive && ownerSubjectId && subjectId === ownerSubjectId) {
    throw new BusinessRuleViolationError('SCHOOL_OWNER_DEACTIVATION_BLOCKED', 'Transfer school ownership before deactivating the owner')
  }

  if (
    existing?.isActive
    && !staffMember.isActive
    && actor.kind === 'staff'
    && staffMember.id === actor.staffMemberId
  ) {
    throw new BusinessRuleViolationError('SELF_DEACTIVATION_BLOCKED', 'Staff members cannot deactivate their own account')
  }
}

async function validateStaffMemberDelete(
  staffMember: StaffMember,
  repositories: SchoolRepositories,
): Promise<void> {
  const school = await repositories.schools.findById(staffMember.schoolId)
  if (school?.ownerSubjectId && staffMember.subjectId === school.ownerSubjectId) {
    throw new BusinessRuleViolationError('SCHOOL_OWNER_DELETE_BLOCKED', 'Transfer school ownership before deleting the owner')
  }

  const [assignments, homeroomClasses, reportedIncidents, assignedActions, authoredNotes] = await Promise.all([
    repositories.staffAssignments.list({ staffId: staffMember.id }),
    repositories.classGroups.list({ homeroomStaffId: staffMember.id }),
    repositories.incidents.list({ reporterId: staffMember.id }),
    repositories.studentDisciplinaryActions.list({ assignedByStaffId: staffMember.id }),
    repositories.studentNotes.list({ authorStaffId: staffMember.id }),
  ])
  if (
    assignments.length > 0
    || homeroomClasses.length > 0
    || reportedIncidents.length > 0
    || assignedActions.length > 0
    || authoredNotes.length > 0
  ) {
    throw new BusinessRuleViolationError('STAFF_MEMBER_HAS_DEPENDENCIES', `Cannot delete staff member ${staffMember.id}: dependent records still exist`)
  }
}
