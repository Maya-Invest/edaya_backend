import { PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import {
  DomainValidationError,
  Fee,
  FeeCategory,
  Permission,
  StaffMember,
  StaffRoleAssignment,
} from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'

describe('[Postgres PGlite] JSONB read validation', () => {
  let pglite: PGlite
  let db: ReturnType<typeof drizzle>
  let repos: PostgresSchoolRepositories

  beforeEach(async () => {
    pglite = new PGlite()
    db = drizzle(pglite)
    repos = new PostgresSchoolRepositories(db)
    await repos.init({ driver: 'pglite' })
  })

  afterEach(async () => {
    await pglite.close()
  })

  test('Fee rejects corrupt installments JSON on read', async () => {
    await repos.fees.save(new Fee({
      id: 'fee-corrupt-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Tuition',
      defaultAmount: 100_000,
      currency: 'XAF',
      category: FeeCategory.Tuition,
    }))

    await db.execute(sql`
      UPDATE fees
      SET installments = ${JSON.stringify([{ label: '', percentage: 100 }])}::jsonb
      WHERE id = 'fee-corrupt-1'
    `)

    await expect(repos.fees.findById('fee-corrupt-1')).rejects.toBeInstanceOf(DomainValidationError)
  })

  test('AccessRole rejects invalid permission rows on read', async () => {
    await db.execute(sql`
      INSERT INTO access_roles (id, school_id, name, description, status, created_at, updated_at)
      VALUES ('role-corrupt-1', 'school', 'Broken', NULL, 'active', NOW(), NOW())
    `)
    await db.execute(sql`
      INSERT INTO access_role_permissions (role_id, permission)
      VALUES ('role-corrupt-1', 'not_a_valid_permission')
    `)

    await expect(repos.accessRoles.findById('role-corrupt-1')).rejects.toBeInstanceOf(DomainValidationError)
  })

  test('StaffRoleAssignment rejects invalid scope grant JSON on read', async () => {
    await repos.staffMembers.save(new StaffMember({
      id: 'staff-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))

    await repos.staffRoleAssignments.save(new StaffRoleAssignment({
      id: 'assignment-corrupt-1',
      staffId: 'staff-1',
      schoolId: 'school',
      roleIds: ['role-placeholder'],
      scopeGrants: [{
        permission: Permission.ATTENDANCE_RECORD,
        scopeType: 'class_group',
        scopeEntityIds: ['class-1'],
      }],
      status: 'active',
    }))

    await db.execute(sql`
      UPDATE staff_role_assignment_scope_grants
      SET scope_type = 'not_a_valid_scope'
      WHERE assignment_id = 'assignment-corrupt-1'
    `)

    await expect(repos.staffRoleAssignments.findById('assignment-corrupt-1')).rejects.toBeInstanceOf(DomainValidationError)
  })
})
