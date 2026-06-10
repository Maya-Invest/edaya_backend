import type { Permission } from '@edaya/core'
import { StaffRoleAssignment } from '@edaya/core'
import { inArray } from 'drizzle-orm'
import { deserializeJsonb } from '../lib/mappers'
import * as schema from '../postgres-schema'
import { PostgresStore } from '../postgres-store'

/** `roleIds` and `scopeGrants` are normalized tables; `populateRelations` always constructs via Zod. */
export class PostgresStaffRoleAssignmentStore extends PostgresStore<StaffRoleAssignment> {
  constructor(db: any) {
    super(
      db,
      schema.staffRoleAssignments,
      (entity: StaffRoleAssignment) => ({
        id: entity.id,
        staffId: entity.staffId,
        schoolId: entity.schoolId,
        academicYearId: entity.academicYearId ?? null,
        status: entity.status,
        startsAt: entity.startsAt ?? null,
        endsAt: entity.endsAt ?? null,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
      }),
      row => new StaffRoleAssignment({
        id: row.id,
        staffId: row.staffId,
        schoolId: row.schoolId,
        academicYearId: row.academicYearId ?? undefined,
        roleIds: ['dummy'],
        scopeGrants: [],
        status: row.status,
        startsAt: row.startsAt ?? undefined,
        endsAt: row.endsAt ?? undefined,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      }),
    )
  }

  private async populateRelations(assignments: StaffRoleAssignment[]): Promise<StaffRoleAssignment[]> {
    if (assignments.length === 0) {
      return []
    }

    const ids = assignments.map(a => a.id)
    const client = this.getClient()

    const roleRows = await client
      .select({
        assignmentId: schema.staffRoleAssignmentRoles.assignmentId,
        roleId: schema.staffRoleAssignmentRoles.roleId,
      })
      .from(schema.staffRoleAssignmentRoles)
      .where(inArray(schema.staffRoleAssignmentRoles.assignmentId, ids))

    const rolesByAssignment = new Map<string, string[]>()
    for (const row of roleRows) {
      const list = rolesByAssignment.get(row.assignmentId) ?? []
      list.push(row.roleId)
      rolesByAssignment.set(row.assignmentId, list)
    }

    const scopeRows = await client
      .select({
        assignmentId: schema.staffRoleAssignmentScopeGrants.assignmentId,
        permission: schema.staffRoleAssignmentScopeGrants.permission,
        scopeType: schema.staffRoleAssignmentScopeGrants.scopeType,
        scopeEntityIds: schema.staffRoleAssignmentScopeGrants.scopeEntityIds,
      })
      .from(schema.staffRoleAssignmentScopeGrants)
      .where(inArray(schema.staffRoleAssignmentScopeGrants.assignmentId, ids))

    const scopeGrantsByAssignment = new Map<string, any[]>()
    for (const row of scopeRows) {
      const list = scopeGrantsByAssignment.get(row.assignmentId) ?? []
      list.push({
        permission: row.permission as Permission,
        scopeType: row.scopeType,
        scopeEntityIds: deserializeJsonb(row.scopeEntityIds),
      })
      scopeGrantsByAssignment.set(row.assignmentId, list)
    }

    return assignments.map(a => new StaffRoleAssignment({
      id: a.id,
      staffId: a.staffId,
      schoolId: a.schoolId,
      academicYearId: a.academicYearId,
      roleIds: rolesByAssignment.get(a.id) ?? [],
      scopeGrants: scopeGrantsByAssignment.get(a.id) ?? [],
      status: a.status,
      startsAt: a.startsAt,
      endsAt: a.endsAt,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    }))
  }

  private async clearRelations(assignmentIds: string[]): Promise<void> {
    const client = this.getClient()
    await client
      .delete(schema.staffRoleAssignmentRoles)
      .where(inArray(schema.staffRoleAssignmentRoles.assignmentId, assignmentIds))
    await client
      .delete(schema.staffRoleAssignmentScopeGrants)
      .where(inArray(schema.staffRoleAssignmentScopeGrants.assignmentId, assignmentIds))
  }

  private async insertRelations(entity: StaffRoleAssignment): Promise<void> {
    const client = this.getClient()

    if (entity.roleIds && entity.roleIds.length > 0) {
      await client
        .insert(schema.staffRoleAssignmentRoles)
        .values(entity.roleIds.map(roleId => ({
          assignmentId: entity.id,
          roleId,
        })))
    }

    if (entity.scopeGrants && entity.scopeGrants.length > 0) {
      await client
        .insert(schema.staffRoleAssignmentScopeGrants)
        .values(entity.scopeGrants.map(grant => ({
          assignmentId: entity.id,
          permission: grant.permission,
          scopeType: grant.scopeType,
          scopeEntityIds: grant.scopeEntityIds,
        })))
    }
  }

  override async findById(id: string): Promise<StaffRoleAssignment | undefined> {
    const assignment = await super.findById(id)
    if (!assignment) {
      return undefined
    }
    const [populated] = await this.populateRelations([assignment])
    return populated
  }

  override async findByIds(ids: string[]): Promise<StaffRoleAssignment[]> {
    return this.populateRelations(await super.findByIds(ids))
  }

  override async list(options?: any): Promise<StaffRoleAssignment[]> {
    return this.populateRelations(await super.list(options))
  }

  override async save(entity: StaffRoleAssignment): Promise<void> {
    await super.save(entity)
    await this.clearRelations([entity.id])
    await this.insertRelations(entity)
  }

  override async batchSave(entities: StaffRoleAssignment[]): Promise<string[]> {
    if (entities.length === 0) {
      return []
    }
    const ids = await super.batchSave(entities)
    await this.clearRelations(ids)

    const roleValues = entities.flatMap(entity =>
      (entity.roleIds || []).map(roleId => ({
        assignmentId: entity.id,
        roleId,
      })),
    )
    if (roleValues.length > 0) {
      await this.getClient().insert(schema.staffRoleAssignmentRoles).values(roleValues)
    }

    const scopeValues = entities.flatMap(entity =>
      (entity.scopeGrants || []).map(grant => ({
        assignmentId: entity.id,
        permission: grant.permission,
        scopeType: grant.scopeType,
        scopeEntityIds: grant.scopeEntityIds,
      })),
    )
    if (scopeValues.length > 0) {
      await this.getClient().insert(schema.staffRoleAssignmentScopeGrants).values(scopeValues)
    }

    return ids
  }

  override async delete(id: string): Promise<void> {
    await this.clearRelations([id])
    await super.delete(id)
  }

  override async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return
    }
    await this.clearRelations(ids)
    await super.batchDelete(ids)
  }
}
