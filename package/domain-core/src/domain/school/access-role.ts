import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { Permission } from '../../capabilities/authorization'
import { directPermissionEntityConfig } from '../../application/entities/entity-config'
import { parseDomain, zodDate } from '../shared/utils'

export type AccessRoleStatus = 'active' | 'inactive'

export const accessRoleBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  permissions: z.nativeEnum(Permission).array(),
  status: z.enum(['active', 'inactive']).default('active'),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

function refineAccessRole(data: any, ctx: z.RefinementCtx) {
  if (data.permissions.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'permissions must contain at least one entry',
    })
  }
}

export const accessRoleSchema = accessRoleBaseSchema.extend({
  permissions: z.nativeEnum(Permission).array().transform(arr => Object.freeze([...new Set(arr)])),
}).superRefine(refineAccessRole)

export type AccessRoleData = Omit<z.infer<typeof accessRoleSchema>, 'permissions'> & {
  readonly permissions: readonly Permission[]
}
export type AccessRoleInput = z.input<typeof accessRoleSchema>

export const accessRoleCreateSchema = accessRoleBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineAccessRole)
export const accessRoleUpdateSchema = accessRoleBaseSchema.partial().required({ id: true }).superRefine(refineAccessRole)

/** School-scoped role definition (system templates or custom roles). */
export class AccessRole {
  readonly data: AccessRoleData

  constructor(args: AccessRoleInput) {
    this.data = parseDomain(accessRoleSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get description() { return this.data.description }
  get permissions() { return this.data.permissions }
  get status() { return this.data.status }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt ?? this.data.createdAt }
}

export const accessRoleConfig: EntityConfigFactory<AccessRole> = input =>
  directPermissionEntityConfig(
    input,
    input.repositories.accessRoles,
    Permission.ACCESS_CONTROL_READ,
    Permission.ACCESS_CONTROL_CONFIGURE,
  )
