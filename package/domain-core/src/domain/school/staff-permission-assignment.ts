import { z } from 'zod'
import { refineEndsAtNotBeforeStartsAtOptional } from '../../domain/value-objects/date-time-range'

import { grantScopesSchema, validatePermissionScopes } from '../permissions/grant-scope'

import { Permission } from '../permissions/permission'

import { parseDomain, zodDate } from '../shared/utils'

export type StaffPermissionAssignmentStatus = 'active' | 'inactive' | 'expired'

export const staffPermissionAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  staffId: z.string().trim().min(1, 'staffId must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  permission: z.nativeEnum(Permission),
  scopes: grantScopesSchema,
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  startsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})

function refineStaffPermissionAssignmentScope(
  data: { permission?: Permission, scopes?: z.infer<typeof grantScopesSchema>, startsAt?: Date, endsAt?: Date },
  ctx: z.RefinementCtx,
) {
  refineEndsAtNotBeforeStartsAtOptional(
    { startsAt: data.startsAt, endsAt: data.endsAt },
    ctx,
  )

  if (data.permission === undefined || data.scopes === undefined) {
    return
  }

  try {
    validatePermissionScopes(data.permission, data.scopes)
  }
  catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid grant scopes',
      path: ['scopes'],
    })
  }
}

export const staffPermissionAssignmentSchema = staffPermissionAssignmentBaseSchema.superRefine(refineStaffPermissionAssignmentScope)
export type StaffPermissionAssignmentData = z.infer<typeof staffPermissionAssignmentSchema>
export type StaffPermissionAssignmentInput = z.input<typeof staffPermissionAssignmentSchema>

export const staffPermissionAssignmentCreateSchema = staffPermissionAssignmentBaseSchema
  .omit({ createdAt: true, updatedAt: true })
  .superRefine(refineStaffPermissionAssignmentScope)

export const staffPermissionAssignmentUpdateSchema = staffPermissionAssignmentBaseSchema
  .partial()
  .required({ id: true })
  .superRefine(refineStaffPermissionAssignmentScope)

/** Manual permission grant with typed scopes, validity and provenance. */
export class StaffPermissionAssignment {
  readonly data: StaffPermissionAssignmentData

  constructor(args: StaffPermissionAssignmentInput) {
    const parsed = parseDomain(staffPermissionAssignmentSchema, args)
    this.data = {
      ...parsed,
      updatedAt: parsed.updatedAt ?? parsed.createdAt,
    }
  }

  get id() { return this.data.id }
  get staffId() { return this.data.staffId }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get permission() { return this.data.permission }
  get scopes() { return this.data.scopes }
  get status() { return this.data.status }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
