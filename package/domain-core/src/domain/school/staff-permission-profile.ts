import { z } from 'zod'
import { Permission } from '../permissions/permission'
import { corePermissionDefinition } from '../permissions/permission-catalog'
import { parseDomain, zodDate } from '../shared/utils'

function refineStaffPermissionProfile(
  data: {
    permissions?: Permission[]
  },
  ctx: z.RefinementCtx,
) {
  if (data.permissions === undefined)
    return

  const seen = new Set<Permission>()
  for (const [index, permission] of data.permissions.entries()) {
    if (seen.has(permission)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Profile permissions must be unique',
        path: ['permissions', index],
      })
      continue
    }
    seen.add(permission)
    if (!corePermissionDefinition(permission).staffAssignable) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Platform permissions cannot be included in staff profiles',
        path: ['permissions', index],
      })
    }
  }
}

export const staffPermissionProfileBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  permissions: z.array(z.nativeEnum(Permission)).default([]),
  sourceKey: z.string().trim().min(1, 'sourceKey must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})

export const staffPermissionProfileSchema = staffPermissionProfileBaseSchema.superRefine(refineStaffPermissionProfile)
export type StaffPermissionProfileData = z.infer<typeof staffPermissionProfileSchema>
export type StaffPermissionProfileInput = z.input<typeof staffPermissionProfileSchema>

export const staffPermissionProfileCreateSchema = staffPermissionProfileBaseSchema
  .omit({ createdAt: true, updatedAt: true })
  .superRefine(refineStaffPermissionProfile)

export const staffPermissionProfileUpdateSchema = staffPermissionProfileBaseSchema
  .partial()
  .required({ id: true })
  .superRefine(refineStaffPermissionProfile)

/** School-owned permission bundle. Runtime authority stays on stamped grant rows. */
export class StaffPermissionProfile {
  readonly data: StaffPermissionProfileData

  constructor(args: StaffPermissionProfileInput) {
    const parsed = parseDomain(staffPermissionProfileSchema, args)
    this.data = {
      ...parsed,
      updatedAt: parsed.updatedAt ?? parsed.createdAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get description() { return this.data.description }
  get permissions() { return this.data.permissions }
  get sourceKey() { return this.data.sourceKey }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
