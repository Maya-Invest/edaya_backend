#!/usr/bin/env bun
/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */

import type { Permission, ScopeGrant } from '@edaya/core'
import { randomUUID } from 'node:crypto'
import process from 'node:process'
import {
  ASSIGNMENT_SCOPED_PERMISSIONS,
  expandLegacyStaffAccessToPermissionRows,
} from '@edaya/core'
import postgres from 'postgres'

const databaseUrl = process.env['DATABASE_URL']

if (!databaseUrl || databaseUrl === 'pglite' || databaseUrl === 'memory') {
  console.error('Set DATABASE_URL to a Postgres connection string before running staff access migration.')
  process.exit(1)
}

const dryRun = process.argv.includes('--dry-run')

interface AccessRolePermissionRow {
  role_id: string
  permission: Permission
}

interface StaffRoleAssignmentRow {
  id: string
  staff_id: string
  school_id: string
  academic_year_id: string | null
  status: 'active' | 'inactive' | 'expired'
  starts_at: Date | null
  ends_at: Date | null
}

interface StaffRoleAssignmentRoleRow {
  assignment_id: string
  role_id: string
}

interface StaffRoleAssignmentScopeGrantRow {
  assignment_id: string
  permission: Permission
  scope_type: ScopeGrant['scopeType']
  scope_entity_ids: string[]
}

interface StaffAssignmentRow {
  id: string
  staff_id: string
  academic_year_id: string | null
  class_group_id: string | null
  class_subject_id: string | null
  lesson_session_id: string | null
  activity_session_id: string | null
  assessment_id: string | null
  permissions: Permission[] | null
}

interface AcademicYearRow {
  id: string
  school_id: string
  is_active: boolean
}

const sql = postgres(databaseUrl, { max: 1 })

async function legacyAccessTablesExist(): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'access_roles'
    ) AS exists
  `
  return rows[0]?.exists ?? false
}

async function staffPermissionTableExists(): Promise<boolean> {
  const rows = await sql<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'staff_permission_assignments'
    ) AS exists
  `
  return rows[0]?.exists ?? false
}

try {
  if (!(await legacyAccessTablesExist())) {
    console.log(JSON.stringify({
      dryRun,
      skipped: true,
      reason: 'legacy access control tables absent — cutover already applied or fresh database',
    }, null, 2))
    process.exit(0)
  }

  if (!(await staffPermissionTableExists())) {
    console.error(
      'staff_permission_assignments table is missing. '
      + 'Apply school migrations through 0036 first (bun run db:migrate:full).',
    )
    process.exit(1)
  }

  const accessRolePermissions = await sql<AccessRolePermissionRow[]>`
    SELECT role_id, permission
    FROM access_role_permissions
  `

  const accessRoles = [...accessRolePermissions.reduce((roles, row) => {
    const existing = roles.get(row.role_id) ?? { id: row.role_id, permissions: [] as Permission[] }
    existing.permissions.push(row.permission)
    roles.set(row.role_id, existing)
    return roles
  }, new Map<string, { id: string, permissions: Permission[] }>()).values()]

  const roleAssignments = await sql<StaffRoleAssignmentRow[]>`
    SELECT
      id,
      staff_id,
      school_id,
      academic_year_id,
      status,
      starts_at,
      ends_at
    FROM staff_role_assignments
    WHERE status = 'active'
  `

  const assignmentRoles = await sql<StaffRoleAssignmentRoleRow[]>`
    SELECT assignment_id, role_id
    FROM staff_role_assignment_roles
  `

  const assignmentScopeGrants = await sql<StaffRoleAssignmentScopeGrantRow[]>`
    SELECT assignment_id, permission, scope_type, scope_entity_ids
    FROM staff_role_assignment_scope_grants
  `

  const roleIdsByAssignment = assignmentRoles.reduce((map, row) => {
    const existing = map.get(row.assignment_id) ?? []
    existing.push(row.role_id)
    map.set(row.assignment_id, existing)
    return map
  }, new Map<string, string[]>())

  const scopeGrantsByAssignment = assignmentScopeGrants.reduce((map, row) => {
    const existing = map.get(row.assignment_id) ?? []
    existing.push({
      permission: row.permission,
      scopeType: row.scope_type,
      scopeEntityIds: row.scope_entity_ids ?? [],
    })
    map.set(row.assignment_id, existing)
    return map
  }, new Map<string, ScopeGrant[]>())

  const academicYears = await sql<AcademicYearRow[]>`
    SELECT id, school_id, is_active
    FROM academic_years
  `

  const activeYearBySchool = new Map<string, string>()
  for (const year of academicYears) {
    if (year.is_active) {
      activeYearBySchool.set(year.school_id, year.id)
    }
  }
  for (const year of academicYears) {
    if (!activeYearBySchool.has(year.school_id)) {
      activeYearBySchool.set(year.school_id, year.id)
    }
  }

  const migrationRows = expandLegacyStaffAccessToPermissionRows({
    roleAssignments: roleAssignments.map(row => ({
      staffId: row.staff_id,
      schoolId: row.school_id,
      ...(row.academic_year_id ? { academicYearId: row.academic_year_id } : {}),
      roleIds: roleIdsByAssignment.get(row.id) ?? [],
      scopeGrants: scopeGrantsByAssignment.get(row.id) ?? [],
      status: row.status,
      ...(row.starts_at ? { startsAt: row.starts_at } : {}),
      ...(row.ends_at ? { endsAt: row.ends_at } : {}),
    })),
    accessRoles: accessRoles.map(row => ({
      id: row.id,
      permissions: row.permissions ?? [],
    })),
    defaultAcademicYearId: academicYears[0]?.id ?? 'unknown-year',
  }).map(row => ({
    ...row,
    academicYearId: row.academicYearId === 'unknown-year'
      ? activeYearBySchool.get(row.schoolId) ?? row.academicYearId
      : row.academicYearId,
  }))

  const existingManualRows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM staff_permission_assignments
    WHERE source_staff_assignment_id IS NULL
  `
  const existingManualCount = Number(existingManualRows[0]?.count ?? 0)

  if (existingManualCount > 0) {
    console.log(`Skipping manual permission rows: ${existingManualCount} already present.`)
  }

  const now = new Date()
  let inserted = 0

  if (!dryRun && existingManualCount === 0) {
    for (const row of migrationRows) {
      await sql`
        INSERT INTO staff_permission_assignments (
          id,
          staff_id,
          school_id,
          academic_year_id,
          permission,
          scope_ids,
          status,
          starts_at,
          ends_at,
          source_staff_assignment_id,
          created_at,
          updated_at
        ) VALUES (
          ${randomUUID()},
          ${row.staffId},
          ${row.schoolId},
          ${row.academicYearId},
          ${row.permission},
          ${row.scopeIds},
          ${row.status},
          ${row.startsAt ?? null},
          ${row.endsAt ?? null},
          NULL,
          ${now},
          ${now}
        )
      `
      inserted += 1
    }
  }

  const staffAssignments = await sql<StaffAssignmentRow[]>`
    SELECT
      id,
      staff_id,
      academic_year_id,
      class_group_id,
      class_subject_id,
      lesson_session_id,
      activity_session_id,
      assessment_id,
      permissions
    FROM staff_assignments
  `

  let backfilledAssignments = 0
  for (const assignment of staffAssignments) {
    const hasTeachingTarget = Boolean(
      assignment.class_group_id
      || assignment.class_subject_id
      || assignment.lesson_session_id
      || assignment.activity_session_id
      || assignment.assessment_id,
    )
    if (!hasTeachingTarget) {
      continue
    }

    const current = assignment.permissions ?? []
    if (current.length > 0) {
      continue
    }

    if (!dryRun) {
      await sql`
        UPDATE staff_assignments
        SET permissions = ${JSON.stringify([...ASSIGNMENT_SCOPED_PERMISSIONS])}::jsonb
        WHERE id = ${assignment.id}
      `
    }
    backfilledAssignments += 1
  }

  console.log(JSON.stringify({
    dryRun,
    accessRoles: accessRoles.length,
    roleAssignments: roleAssignments.length,
    permissionRowsPrepared: migrationRows.length,
    permissionRowsInserted: inserted,
    staffAssignmentsBackfilled: backfilledAssignments,
  }, null, 2))

  if (dryRun) {
    console.log('Dry run only — no rows written. Re-run without --dry-run to apply.')
  }
}
finally {
  await sql.end({ timeout: 5 })
}
