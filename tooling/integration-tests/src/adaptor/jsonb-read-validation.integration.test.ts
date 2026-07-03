import { PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import {
  DomainValidationError,
  Fee,
  FeeCategory,
  Permission,
  StaffMember,
  StaffPermissionAssignment,
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

  test('StaffPermissionAssignment rejects invalid permission on read', async () => {
    await repos.staffMembers.save(new StaffMember({
      id: 'staff-1',
      schoolId: 'school',
      firstName: 'Ada',
      lastName: 'Lovelace',
    }))

    await db.execute(sql`
      INSERT INTO staff_permission_assignments (
        id, staff_id, school_id, academic_year_id, permission, scope_ids, status, created_at, updated_at
      )
      VALUES (
        'spa-corrupt-1', 'staff-1', 'school', 'year-1', 'not_a_valid_permission', '', 'active', NOW(), NOW()
      )
    `)

    await expect(repos.staffPermissionAssignments.findById('spa-corrupt-1')).rejects.toBeInstanceOf(DomainValidationError)
  })

  test('StaffPermissionAssignment rejects invalid scopeIds on read', async () => {
    await repos.staffMembers.save(new StaffMember({
      id: 'staff-2',
      schoolId: 'school',
      firstName: 'Grace',
      lastName: 'Hopper',
    }))

    await repos.staffPermissionAssignments.save(new StaffPermissionAssignment({
      id: 'spa-corrupt-2',
      staffId: 'staff-2',
      schoolId: 'school',
      academicYearId: 'year-1',
      permission: Permission.ATTENDANCE_RECORD,
      scopeIds: 'class-1:*',
      status: 'active',
    }))

    await db.execute(sql`
      UPDATE staff_permission_assignments
      SET scope_ids = 'class-1/invalid'
      WHERE id = 'spa-corrupt-2'
    `)

    await expect(repos.staffPermissionAssignments.findById('spa-corrupt-2')).rejects.toBeInstanceOf(DomainValidationError)
  })
})
