import type {
  AccessRolePresetRecord,
  AccessSeedPort,
  StaffRoleAssignmentPresetRecord,
} from '../domains/access/port'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { SeedProgressReporter } from '../support/seed-progress'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import { ASSIGNMENT_SCOPED_PERMISSIONS, permissionRowsFromTemplatePermissions } from '@edaya/authorization'
import { demoDataset } from '@edaya/fixtures'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { DEMO_CENTRAL_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'
import { createInProcessAccessSeedPort } from '../domains/access/in-process'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/in-process'
import { buildDevAccessSeedRecords } from '../support/build-dev-access-seed-records'
import { SeedPortError } from '../support/seed-port-error'

async function seedStaffPermissionAssignments(
  port: AccessSeedPort,
  accessRolePresets: readonly AccessRolePresetRecord[],
  staffRoleAssignmentPresets: readonly StaffRoleAssignmentPresetRecord[],
  onProgress?: () => void,
): Promise<number> {
  const presetsById = new Map(accessRolePresets.map(role => [role.id, role]))
  let count = 0

  for (const assignment of staffRoleAssignmentPresets) {
    const role = presetsById.get(assignment.roleId)
    if (!role) {
      continue
    }

    const rows = permissionRowsFromTemplatePermissions(
      assignment.staffId,
      assignment.schoolId,
      assignment.academicYearId,
      role.permissions,
      assignment.scopeGrants ?? [],
    )

    for (const [index, row] of rows.entries()) {
      await port.saveStaffPermissionAssignment({
        id: `spa-${assignment.staffId}-${row.permission}-${index}`,
        ...row,
        status: 'active',
      })
      count += 1
      onProgress?.()
    }
  }

  return count
}

function countStaffPermissionAssignments(
  accessRolePresets: readonly AccessRolePresetRecord[],
  staffRoleAssignmentPresets: readonly StaffRoleAssignmentPresetRecord[],
): number {
  const presetsById = new Map(accessRolePresets.map(role => [role.id, role]))
  let count = 0

  for (const assignment of staffRoleAssignmentPresets) {
    const role = presetsById.get(assignment.roleId)
    if (!role) {
      continue
    }

    const rows = permissionRowsFromTemplatePermissions(
      assignment.staffId,
      assignment.schoolId,
      assignment.academicYearId,
      role.permissions,
      assignment.scopeGrants ?? [],
    )
    count += rows.length
  }

  return count
}

export type DevAccessSeedResult
  = | { status: 'skipped', reason: 'school-not-seeded' }
    | { status: 'seeded', permissionAssignments: number, staffAssignments: number }

export interface RunDevAccessSeedOptions {
  auth?: AuthProvisioner
  ownerSubjectId?: string
  authLinkPort?: AuthLinkSeedPort
  /** When set, staff/class assignments use this port instead of the roles port. */
  assignmentsPort?: AccessSeedPort
  /** Runs immediately before staff/class assignment writes (e.g. refresh owner session). */
  beforeAssignments?: () => Promise<void>
  /** When false, skip class-subject teacher assignments (integration light fixture). */
  includeClassSubjectStaffAssignments?: boolean
  progress?: SeedProgressReporter
}

/** Access roles only — used before service-account provisioning in HTTP bootstrap. */
export async function runDevAccessRolesSeedWithPort(port: AccessSeedPort): Promise<void> {
  const context = resolveDevSeedContext()
  if (await port.schoolExists(context.schoolId)) {
    // Permission-model dev seeds expand preset roles into assignments in the assignments phase.
  }
}

/** Staff permission + class assignments — run after school structure exists. */
export async function runDevAccessAssignmentsSeedWithPort(
  port: AccessSeedPort,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  const context = resolveDevSeedContext()
  const {
    accessRoleRecords,
    staffRoleAssignmentRecords,
    baseStaffAssignmentRecords,
  } = buildDevAccessSeedRecords(context)

  if (options?.beforeAssignments) {
    await options.beforeAssignments()
  }

  if (!(await port.schoolExists(context.schoolId))) {
    return { status: 'skipped', reason: 'school-not-seeded' }
  }

  if (options?.auth) {
    if (!options.authLinkPort) {
      throw new SeedPortError('access.authLink', { detail: 'authLinkPort is required when auth is provided' })
    }
    await syncDevStaffAuthAndOwner(
      options.authLinkPort,
      options.auth,
      options.ownerSubjectId,
    )
  }

  const permissionAssignmentTotal = countStaffPermissionAssignments(
    accessRoleRecords,
    staffRoleAssignmentRecords,
  ) + baseStaffAssignmentRecords.length + (
    options?.includeClassSubjectStaffAssignments !== false && context.schoolId === DEMO_CENTRAL_SCHOOL_ID
      ? (demoDataset.extensions?.classSubjectStaffAssignments?.length ?? 0)
      : 0
  )

  const runAssignments = async (tick: (by?: number) => void) => {
    const permissionAssignments = await seedStaffPermissionAssignments(
      port,
      accessRoleRecords,
      staffRoleAssignmentRecords,
      tick,
    )

    for (const assignment of baseStaffAssignmentRecords) {
      await port.saveStaffAssignment({
        ...assignment,
        permissions: assignment.permissions ?? [...ASSIGNMENT_SCOPED_PERMISSIONS],
      })
      tick()
    }

    let classSubjectStaffAssignments = 0
    if (options?.includeClassSubjectStaffAssignments !== false && context.schoolId === DEMO_CENTRAL_SCHOOL_ID) {
      for (const assignment of demoDataset.extensions?.classSubjectStaffAssignments ?? []) {
        await port.saveStaffAssignment(assignment)
        classSubjectStaffAssignments += 1
        tick()
      }
    }

    return {
      permissionAssignments,
      staffAssignments: baseStaffAssignmentRecords.length + classSubjectStaffAssignments,
    }
  }

  const assignmentCounts = options?.progress
    ? await options.progress.step(runAssignments, { total: permissionAssignmentTotal })
    : await runAssignments(() => {})

  return {
    status: 'seeded',
    permissionAssignments: assignmentCounts.permissionAssignments,
    staffAssignments: assignmentCounts.staffAssignments,
  }
}

export function runDevAccessRolesSeed(application: SeedApplication): Promise<void> {
  return runDevAccessRolesSeedWithPort(createInProcessAccessSeedPort(application))
}

export function runDevAccessAssignmentsSeed(
  application: SeedApplication,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  return runDevAccessAssignmentsSeedWithPort(
    createInProcessAccessSeedPort(application),
    options?.auth
      ? {
          ...options,
          authLinkPort: options.authLinkPort ?? createInProcessAuthLinkSeedPort(application),
        }
      : options,
  )
}

export async function runDevAccessSeedWithPort(
  port: AccessSeedPort,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  await runDevAccessRolesSeedWithPort(port)
  return runDevAccessAssignmentsSeedWithPort(options?.assignmentsPort ?? port, options)
}

export async function runDevAccessSeed(
  application: SeedApplication,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  const port = createInProcessAccessSeedPort(application)
  return runDevAccessSeedWithPort(
    port,
    options?.auth
      ? {
          ...options,
          authLinkPort: options.authLinkPort ?? createInProcessAuthLinkSeedPort(application),
        }
      : options,
  )
}
