import { PostgresSchoolRepositories } from '@edaya/adaptor-postgres'
import { Permission } from '@edaya/authorization'
import { CatalogService, CatalogServiceStatus, DomainValidationError, StaffMember, StaffPermissionAssignment } from '@edaya/core'
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

  test('CatalogService rejects corrupt billing terms JSON on read', async () => {
    await repos.catalogServices.save(new CatalogService({
      id: 'fee-corrupt-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      name: 'Tuition',
      defaultPrice: 100_000,
      currency: 'XAF',
      billingTerms: { kind: 'one_time', installments: [] },
      status: CatalogServiceStatus.Draft,
    }))

    await db.execute(sql`
      UPDATE catalog_services
      SET billing_terms = ${JSON.stringify({ kind: 'one_time', installments: [{ label: '', percentage: 100 }] })}::jsonb
      WHERE id = 'fee-corrupt-1'
    `)

    await expect(repos.catalogServices.findById('fee-corrupt-1')).rejects.toBeInstanceOf(DomainValidationError)
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
        id, staff_id, school_id, academic_year_id, permission, scopes, status, created_at, updated_at
      )
      VALUES (
        'spa-corrupt-1', 'staff-1', 'school', 'year-1', 'not_a_valid_permission', '[{"kind":"school"}]'::jsonb, 'active', NOW(), NOW()
      )
    `)

    await expect(repos.staffPermissionAssignments.findById('spa-corrupt-1')).rejects.toBeInstanceOf(DomainValidationError)
  })

  test('StaffPermissionAssignment rejects invalid typed scopes on read', async () => {
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
      scopes: [{ kind: 'class_group', classGroupId: 'class-1' }],
      status: 'active',
    }))

    await db.execute(sql`
      UPDATE staff_permission_assignments
      SET scopes = '[{"kind":"class_subject","classGroupId":"class-1","classSubjectId":"math"}]'::jsonb
      WHERE id = 'spa-corrupt-2'
    `)

    await expect(repos.staffPermissionAssignments.findById('spa-corrupt-2')).rejects.toBeInstanceOf(DomainValidationError)
  })
})
