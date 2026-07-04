import type { AccessSeedPort } from '../domains/access/port'
import type { AuthLinkSeedPort } from '../domains/auth-link/port'
import type { AuthProvisioner, SeedApplication } from '../support/types'
import { demoDataset } from '@edaya/fixtures'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { DEMO_CENTRAL_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { syncDevStaffAuthAndOwner } from '../bootstrap/dev-staff-auth-seed'
import { createInProcessAccessSeedPort } from '../domains/access/in-process'
import { createInProcessAuthLinkSeedPort } from '../domains/auth-link/in-process'
import { SeedPortError } from '../support/seed-port-error'
import { buildDevAccessSeedRecords } from '../support/build-dev-access-seed-records'

export type DevAccessSeedResult
  = | { status: 'skipped', reason: 'school-not-seeded' }
    | { status: 'seeded', roles: number, assignments: number, staffAssignments: number }

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
}

/** Access roles only — used before service-account provisioning in HTTP bootstrap. */
export async function runDevAccessRolesSeedWithPort(port: AccessSeedPort): Promise<void> {
  const context = resolveDevSeedContext()
  const { accessRoleRecords } = buildDevAccessSeedRecords(context)

  if (!(await port.schoolExists(context.schoolId))) {
    throw new Error('Cannot seed access roles before school exists')
  }

  for (const role of accessRoleRecords) {
    await port.saveAccessRole(role)
  }
}

/** Staff role + class assignments — run after school structure exists. */
export async function runDevAccessAssignmentsSeedWithPort(
  port: AccessSeedPort,
  options?: RunDevAccessSeedOptions,
): Promise<DevAccessSeedResult> {
  const context = resolveDevSeedContext()
  const {
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

  for (const assignment of staffRoleAssignmentRecords) {
    await port.saveStaffRoleAssignment(assignment)
  }

  for (const assignment of baseStaffAssignmentRecords) {
    await port.saveStaffAssignment(assignment)
  }

  let classSubjectStaffAssignments = 0
  if (options?.includeClassSubjectStaffAssignments !== false && context.schoolId === DEMO_CENTRAL_SCHOOL_ID) {
    for (const assignment of demoDataset.extensions?.classSubjectStaffAssignments ?? []) {
      await port.saveStaffAssignment(assignment)
      classSubjectStaffAssignments += 1
    }
  }

  return {
    status: 'seeded',
    roles: buildDevAccessSeedRecords(context).accessRoleRecords.length,
    assignments: staffRoleAssignmentRecords.length,
    staffAssignments: baseStaffAssignmentRecords.length + classSubjectStaffAssignments,
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
