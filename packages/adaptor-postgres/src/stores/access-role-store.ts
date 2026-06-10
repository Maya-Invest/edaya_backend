import { AccessRole, Permission } from '@edaya/core'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

/** Permissions live in `access_role_permissions`; reads always rebuild via `AccessRole` constructor. */
export class PostgresAccessRoleStore extends PostgresStore<AccessRole> {
  constructor(db: any) {
    super(
      db,
      schema.accessRoles,
      (entity: AccessRole) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        name: entity.name,
        description: entity.description ?? null,
        status: entity.status,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
      row => new AccessRole({
        id: row.id,
        schoolId: row.schoolId,
        name: row.name,
        description: row.description ?? undefined,
        permissions: [Permission.ACCESS_CONTROL_READ],
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    )
  }

  private async fetchPermissionsByRoleId(roleIds: string[]): Promise<Map<string, Permission[]>> {
    if (roleIds.length === 0) {
      return new Map()
    }

    const permissionRows = await this.getClient()
      .select({
        roleId: schema.accessRolePermissions.roleId,
        permission: schema.accessRolePermissions.permission,
      })
      .from(schema.accessRolePermissions)
      .where(inArray(schema.accessRolePermissions.roleId, roleIds))

    const permissionsByRole = new Map<string, Permission[]>()
    for (const row of permissionRows) {
      const list = permissionsByRole.get(row.roleId) ?? []
      list.push(row.permission as Permission)
      permissionsByRole.set(row.roleId, list)
    }
    return permissionsByRole
  }

  private withPermissions(role: AccessRole, permissions: Permission[]): AccessRole {
    return new AccessRole({
      id: role.id,
      schoolId: role.schoolId,
      name: role.name,
      description: role.description,
      permissions,
      status: role.status,
      createdAt: role.createdAt,
      updatedAt: role.updatedAt,
    })
  }

  private async enrichRoles(roles: AccessRole[]): Promise<AccessRole[]> {
    const permissionsByRole = await this.fetchPermissionsByRoleId(roles.map(r => r.id))
    return roles.map(role => this.withPermissions(role, permissionsByRole.get(role.id) ?? []))
  }

  override async findById(id: string): Promise<AccessRole | undefined> {
    const role = await super.findById(id)
    if (!role) {
      return undefined
    }
    const [enriched] = await this.enrichRoles([role])
    return enriched
  }

  override async findByIds(ids: string[]): Promise<AccessRole[]> {
    return this.enrichRoles(await super.findByIds(ids))
  }

  override async list(options?: any): Promise<AccessRole[]> {
    return this.enrichRoles(await super.list(options))
  }

  private async replacePermissions(roleId: string, permissions: readonly Permission[]): Promise<void> {
    const client = this.getClient()
    await client
      .delete(schema.accessRolePermissions)
      .where(eq(schema.accessRolePermissions.roleId, roleId))

    if (permissions.length > 0) {
      await client
        .insert(schema.accessRolePermissions)
        .values(permissions.map(permission => ({ roleId, permission })))
    }
  }

  override async save(entity: AccessRole): Promise<void> {
    await super.save(entity)
    await this.replacePermissions(entity.id, entity.permissions ?? [])
  }

  override async batchSave(entities: AccessRole[]): Promise<string[]> {
    if (entities.length === 0) {
      return []
    }
    const ids = await super.batchSave(entities)
    const client = this.getClient()

    await client
      .delete(schema.accessRolePermissions)
      .where(inArray(schema.accessRolePermissions.roleId, ids))

    const values = entities.flatMap(entity =>
      (entity.permissions || []).map(permission => ({
        roleId: entity.id,
        permission,
      })),
    )
    if (values.length > 0) {
      await client.insert(schema.accessRolePermissions).values(values)
    }
    return ids
  }

  override async delete(id: string): Promise<void> {
    await this.getClient()
      .delete(schema.accessRolePermissions)
      .where(eq(schema.accessRolePermissions.roleId, id))
    await super.delete(id)
  }

  override async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return
    }
    await this.getClient()
      .delete(schema.accessRolePermissions)
      .where(inArray(schema.accessRolePermissions.roleId, ids))
    await super.batchDelete(ids)
  }
}
