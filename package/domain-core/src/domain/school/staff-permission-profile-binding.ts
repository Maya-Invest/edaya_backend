import { z } from 'zod'
import { grantScopesSchema } from '../permissions/grant-scope'
import { parseDomain, zodDate } from '../shared/utils'

export const staffPermissionProfileBindingBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  staffId: z.string().trim().min(1, 'staffId must not be blank'),
  profileId: z.string().trim().min(1, 'profileId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  scopes: grantScopesSchema,
  sortOrder: z.number().int().nonnegative(),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})

export const staffPermissionProfileBindingSchema = staffPermissionProfileBindingBaseSchema
export type StaffPermissionProfileBindingData = z.infer<typeof staffPermissionProfileBindingSchema>
export type StaffPermissionProfileBindingInput = z.input<typeof staffPermissionProfileBindingSchema>

export const staffPermissionProfileBindingCreateSchema = staffPermissionProfileBindingBaseSchema.omit({ createdAt: true, updatedAt: true })
export const staffPermissionProfileBindingUpdateSchema = staffPermissionProfileBindingBaseSchema.partial().required({ id: true })

/** Ordered staff-to-profile link. sortOrder 0 is highest priority for first-wins resolve. */
export class StaffPermissionProfileBinding {
  readonly data: StaffPermissionProfileBindingData

  constructor(args: StaffPermissionProfileBindingInput) {
    const parsed = parseDomain(staffPermissionProfileBindingSchema, args)
    this.data = {
      ...parsed,
      updatedAt: parsed.updatedAt ?? parsed.createdAt,
    }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get staffId() { return this.data.staffId }
  get profileId() { return this.data.profileId }
  get academicYearId() { return this.data.academicYearId }
  get scopes() { return this.data.scopes }
  get sortOrder() { return this.data.sortOrder }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
