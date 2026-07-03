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

interface AccessRoleRow {
  id: string
  school_id: string
  permissions: Permission[]
}

interface StaffRoleAssignmentRow {
  id: string
  staff_id: string
  school_id: string
  academic_year_id: string | null
  role_ids: string[]
  scope_grants: ScopeGrant[]
  status: 'active' | 'inactive' | 'expired'
  starts_at: Date | null
  ends_at: Date | null
}

interface StaffAssignmentRow {
  id: string
  staff_id: string
  school_id: string
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

try {
  const accessRoles = await sql<AccessRoleRow[]>`
    SELECT id, school_id, permissions
    FROM access_roles
  `

  const roleAssignments = await sql<StaffRoleAssignmentRow[]>`
    SELECT
      id,
      staff_id,
      school_id,
      academic_year_id,
      role_ids,
      scope_grants,
      status,
      starts_at,
      ends_at
    FROM staff_role_assignments
    WHERE status = 'active'
  `

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
      roleIds: row.role_ids,
      scopeGrants: row.scope_grants ?? [],
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
      school_id,
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
        SET permissions = ${sql.array([...ASSIGNMENT_SCOPED_PERMISSIONS])}
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
