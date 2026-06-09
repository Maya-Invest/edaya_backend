import type { ScopeGrant, ScopeType } from '../../authorization'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'

import { directPermissionEntityConfig } from '../../shared'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export const scopeGrantSchema = z.object({
  permission: z.nativeEnum(Permission),
  scopeType: z.enum([
    'platform',
    'school',
    'academic_year',
    'class_group',
    'subject',
    'course_assignment',
    'session',
    'student',
    'student_group',
  ]) as z.ZodType<ScopeType>,
  scopeEntityIds: z.array(z.string()),
})

export const staffRoleAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  staffId: z.string().trim().min(1, 'staffId must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  roleIds: z.array(z.string().trim().min(1, 'roleId must not be blank')).min(1, 'roleIds must contain at least one role').transform(arr => [...new Set(arr)]),
  scopeGrants: z.array(scopeGrantSchema).default([]),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  startsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})

function refineStaffRoleAssignment(data: any, ctx: z.RefinementCtx) {
  if (data.startsAt && data.endsAt && data.endsAt < data.startsAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endsAt must not be before startsAt',
    })
  }
}

export const staffRoleAssignmentSchema = staffRoleAssignmentBaseSchema.superRefine(refineStaffRoleAssignment)
export type StaffRoleAssignmentData = z.infer<typeof staffRoleAssignmentSchema>

export const staffRoleAssignmentCreateSchema = staffRoleAssignmentBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineStaffRoleAssignment)
export const staffRoleAssignmentUpdateSchema = staffRoleAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineStaffRoleAssignment)

export type StaffRoleAssignmentStatus = 'active' | 'inactive' | 'expired'

export interface StaffRoleAssignmentArgs {
  id: string
  staffId: string
  schoolId: string
  academicYearId?: string | null
  roleIds: readonly string[]
  scopeGrants?: readonly ScopeGrant[]
  status?: StaffRoleAssignmentStatus
  startsAt?: Date | null
  endsAt?: Date | null
  createdAt?: Date
  updatedAt?: Date
}

/** Persisted staff access grant (roles + per-permission scope). */
export class StaffRoleAssignment {
  readonly data: StaffRoleAssignmentData
  readonly roleIds: readonly string[]
  readonly scopeGrants: readonly ScopeGrant[]

  constructor(args: StaffRoleAssignmentArgs) {
    const result = staffRoleAssignmentSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    const parsed = result.data
    this.data = {
      ...parsed,
      updatedAt: parsed.updatedAt ?? parsed.createdAt,
    }
    this.roleIds = Object.freeze(this.data.roleIds)
    this.scopeGrants = Object.freeze(this.data.scopeGrants.map(grant => Object.freeze({
      ...grant,
      scopeEntityIds: Object.freeze([...grant.scopeEntityIds]),
    })))
  }

  get id() { return this.data.id }
  get staffId() { return this.data.staffId }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get status() { return this.data.status }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}

export const staffRoleAssignmentConfig: EntityConfigFactory<StaffRoleAssignment> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.staffRoleAssignments,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_ASSIGN,
  )
