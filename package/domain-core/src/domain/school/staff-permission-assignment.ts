import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { Permission } from '../../capabilities/authorization'
import { permissionDefinitions } from '../../capabilities/authorization/permissions/permission-definitions'
import { validateScopeIds } from '../../capabilities/authorization/scope/scope-ids-validate'
import { refineEndsAtNotBeforeStartsAtOptional } from '../../domain/value-objects/date-time-range'
import { parseDomain, zodDate } from '../shared/utils'

export type StaffPermissionAssignmentStatus = 'active' | 'inactive' | 'expired'

export const staffPermissionAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  staffId: z.string().trim().min(1, 'staffId must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  permission: z.nativeEnum(Permission),
  scopeIds: z.string().default(''),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  startsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  sourceStaffAssignmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})

function refineStaffPermissionAssignmentScope(
  data: { permission?: Permission, scopeIds?: string, startsAt?: Date, endsAt?: Date },
  ctx: z.RefinementCtx,
) {
  refineEndsAtNotBeforeStartsAtOptional(
    { startsAt: data.startsAt, endsAt: data.endsAt },
    ctx,
  )

  if (data.permission === undefined || data.scopeIds === undefined) {
    return
  }

  try {
    validateScopeIds(data.scopeIds, permissionDefinitions[data.permission].scope)
  }
  catch (error) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : 'Invalid scopeIds',
      path: ['scopeIds'],
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

/** Direct staff capability grant (replaces role assignment rows in the target model). */
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
  get scopeIds() { return this.data.scopeIds }
  get status() { return this.data.status }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get sourceStaffAssignmentId() { return this.data.sourceStaffAssignmentId }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}

export const staffPermissionAssignmentConfig: EntityConfigFactory<StaffPermissionAssignment> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.staffPermissionAssignments,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_ASSIGN,
  )
