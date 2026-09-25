import type {
  AccessRolePresetRecord,
  AccessSeedPort,
  StaffRoleAssignmentPresetRecord,
} from '../domains/access/port'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { SeedProgressReporter } from '../support/seed-progress'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import { ASSIGNMENT_SCOPED_PERMISSIONS, permissionRowsFromPreset } from '@edaya/authorization'
import { defaultScopesForProfileGrain } from '@edaya/core'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'
import { createInProcessAccessSeedPort } from '../domains/access/adapters/in-process'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/adapters/in-process'
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

    const rows = permissionRowsFromPreset(
      assignment.staffId,
      assignment.schoolId,
      assignment.academicYearId,
      role.permissions,
      assignment.scopesByPermission ?? {},
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

    const rows = permissionRowsFromPreset(
      assignment.staffId,
      assignment.schoolId,
      assignment.academicYearId,
      role.permissions,
      assignment.scopesByPermission ?? {},
    )
    count += rows.length
  }

  return count
}

function matchesRoleSourceKey(sourceKey: string | undefined, roleId: string): boolean {
  return sourceKey === roleId || sourceKey?.startsWith(`${roleId}:`) === true
}

async function seedStaffPermissionProfileBindings(
  port: AccessSeedPort,
  staffRoleAssignmentPresets: readonly StaffRoleAssignmentPresetRecord[],
): Promise<void> {
  const schoolId = staffRoleAssignmentPresets[0]?.schoolId
  if (!schoolId) {
    return
  }

  const profiles = await port.listPermissionProfiles(schoolId)
  if (profiles.length === 0) {
    return
  }

  for (const assignment of staffRoleAssignmentPresets) {
    const matching = profiles.filter(profile => matchesRoleSourceKey(profile.sourceKey, assignment.roleId))
    for (const profile of matching) {
      await port.applyStaffPermissionProfile({
        staffId: assignment.staffId,
        profileId: profile.id,
        academicYearId: assignment.academicYearId,
        scopes: defaultScopesForProfileGrain(profile.scopeGrain),
      })
    }
  }
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
    options?.includeClassSubjectStaffAssignments !== false
      ? (context.dataset.extensions?.classSubjectStaffAssignments?.length ?? 0)
      : 0
  )

  const runAssignments = async (tick: (by?: number) => void) => {
    const permissionAssignments = await seedStaffPermissionAssignments(
      port,
      accessRoleRecords,
      staffRoleAssignmentRecords,
      tick,
    )
    await seedStaffPermissionProfileBindings(port, staffRoleAssignmentRecords)

    for (const assignment of baseStaffAssignmentRecords) {
      await port.saveStaffAssignment({
        ...assignment,
        permissions: assignment.permissions ?? [...ASSIGNMENT_SCOPED_PERMISSIONS],
      })
      tick()
    }

    let classSubjectStaffAssignments = 0
    if (options?.includeClassSubjectStaffAssignments !== false) {
      for (const assignment of context.dataset.extensions?.classSubjectStaffAssignments ?? []) {
        await port.saveStaffAssignment({
          id: assignment.id,
          staffId: assignment.staffId,
          academicYearId: assignment.academicYearId,
          responsibility: assignment.responsibility,
          classGroupId: assignment.classGroupId ?? undefined,
          classSubjectId: assignment.classSubjectId ?? undefined,
          lessonSessionId: assignment.lessonSessionId ?? undefined,
        })
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
