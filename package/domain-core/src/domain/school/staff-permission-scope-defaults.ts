import { z } from 'zod'
import { permissionScopeSelectionsSchema } from '../permissions/permission-selections'
import { parseDomain, zodDate } from '../shared/utils'

export const staffPermissionScopeDefaultsBaseSchema = z.object({
  id: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  staffId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  scopes: permissionScopeSelectionsSchema,
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().optional(),
})
export const staffPermissionScopeDefaultsSchema = staffPermissionScopeDefaultsBaseSchema
export type StaffPermissionScopeDefaultsInput = z.input<typeof staffPermissionScopeDefaultsSchema>
export type StaffPermissionScopeDefaultsData = z.infer<typeof staffPermissionScopeDefaultsSchema>

export class StaffPermissionScopeDefaults {
  readonly data: StaffPermissionScopeDefaultsData
  constructor(args: StaffPermissionScopeDefaultsInput) {
    const parsed = parseDomain(staffPermissionScopeDefaultsSchema, args)
    this.data = { ...parsed, updatedAt: parsed.updatedAt ?? parsed.createdAt }
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get staffId() { return this.data.staffId }
  get academicYearId() { return this.data.academicYearId }
  get scopes() { return this.data.scopes }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
