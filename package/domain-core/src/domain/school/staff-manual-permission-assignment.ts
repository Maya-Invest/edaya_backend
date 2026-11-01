import { z } from 'zod'
import { Permission } from '../permissions/permission'
import { corePermissionDefinition } from '../permissions/permission-catalog'
import { permissionResolutionWarningSchema, permissionScopeSelectionsSchema } from '../permissions/permission-selections'
import { parseDomain, zodDate } from '../shared/utils'
import { refineEndsAtNotBeforeStartsAtOptional } from '../value-objects/date-time-range'

export const staffManualPermissionAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  staffId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  permission: z.nativeEnum(Permission),
  customScopes: permissionScopeSelectionsSchema,
  useDefaultScopes: z.boolean().default(true),
  status: z.enum(['active', 'inactive', 'expired']).default('active'),
  startsAt: zodDate().nullable().optional().transform(v => v ?? undefined),
  endsAt: zodDate().nullable().optional().transform(v => v ?? undefined),
  warnings: z.array(permissionResolutionWarningSchema).default([]),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})
export const staffManualPermissionAssignmentSchema = staffManualPermissionAssignmentBaseSchema.superRefine((data, ctx) => {
  refineEndsAtNotBeforeStartsAtOptional(data, ctx)
  const definition = corePermissionDefinition(data.permission)
  if (!definition.staffAssignable)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Platform actions cannot be staff permissions', path: ['permission'] })
  if (definition.scopePolicy.mode === 'none' && data.customScopes.length > 0)
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Unscoped permissions do not accept resource selections', path: ['customScopes'] })
})
export type StaffManualPermissionAssignmentInput = z.input<typeof staffManualPermissionAssignmentSchema>
export type StaffManualPermissionAssignmentData = z.infer<typeof staffManualPermissionAssignmentSchema>

export class StaffManualPermissionAssignment {
  readonly data: StaffManualPermissionAssignmentData
  constructor(args: StaffManualPermissionAssignmentInput) {
    const parsed = parseDomain(staffManualPermissionAssignmentSchema, args)
    this.data = {
      ...parsed,
      ...(corePermissionDefinition(parsed.permission).scopePolicy.mode === 'none' ? { customScopes: [], useDefaultScopes: false } : {}),
      updatedAt: parsed.updatedAt ?? parsed.createdAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get staffId() { return this.data.staffId }
  get academicYearId() { return this.data.academicYearId }
  get permission() { return this.data.permission }
  get customScopes() { return this.data.customScopes }
  get useDefaultScopes() { return this.data.useDefaultScopes }
  get status() { return this.data.status }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get warnings() { return this.data.warnings }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
