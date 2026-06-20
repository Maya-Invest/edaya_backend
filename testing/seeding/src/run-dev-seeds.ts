import type { DevAccessSeedResult } from './run-dev-access-seed'
import type { DevAuthLinkResult } from './run-dev-auth-link'
import type { DevAuthProvisionResult } from './run-dev-auth-provision'
import type { DevSchoolSeedResult } from './run-dev-school-seed'
import type { AuthProvisioner, SeedApplication } from './types'
import {
  DEV_AUTH_PASSWORD,
} from '@edaya/dev-fixtures'
import { runDevAccessSeed } from './run-dev-access-seed'
import { ownerSubjectIdFromAuthProvision } from './dev-staff-auth-seed'
import { runDevAuthLink } from './run-dev-auth-link'
import { runDevAuthProvision } from './run-dev-auth-provision'
import { runDevSchoolSeed } from './run-dev-school-seed'

export type DevSeedScope = 'school' | 'auth' | 'auth:link' | 'access' | 'all'

export interface RunDevSeedsOptions {
  scope: DevSeedScope
  application: SeedApplication
  auth: AuthProvisioner
  /** When true, skip auth user sign-up (already done before session bootstrap). */
  skipAuthProvision?: boolean
  /** School owner subject id when auth provision ran outside runDevSeeds. */
  ownerSubjectId?: string
}

export interface RunDevSeedsResults {
  school: DevSchoolSeedResult | null
  authProvision: DevAuthProvisionResult | null
  authLink: DevAuthLinkResult | null
  access: DevAccessSeedResult | null
}

export interface LogDevSeedResultsOptions {
  isEphemeralDatabase?: boolean
}

export function parseDevSeedScope(argv: string[]): DevSeedScope {
  const arg = argv[2]

  if (!arg || arg === 'all') {
    return 'all'
  }

  if (arg === 'school' || arg === 'auth' || arg === 'auth:link' || arg === 'access') {
    return arg
  }

  throw new Error(`Unknown seed scope: ${arg}. Usage: bun seed.ts [school|auth|auth:link|access|all]`)
}

export async function runDevSeeds(options: RunDevSeedsOptions): Promise<RunDevSeedsResults> {
  const { scope, application, auth } = options
  const results: RunDevSeedsResults = {
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
  }

  if (scope === 'all') {
    if (!options.skipAuthProvision) {
      results.authProvision = await runDevAuthProvision(auth)
    }
    const ownerSubjectId = options.ownerSubjectId ?? (
      results.authProvision ? ownerSubjectIdFromAuthProvision(results.authProvision) : undefined
    )
    results.school = await runDevSchoolSeed(application, {
      ownerSubjectId,
      auth,
    })
    results.access = await runDevAccessSeed(application, { auth, ownerSubjectId })
    return results
  }

  if (scope === 'school') {
    results.school = await runDevSchoolSeed(application, { auth })
  }

  if (scope === 'auth') {
    results.authProvision = await runDevAuthProvision(auth)
  }

  if (scope === 'auth:link') {
    results.authLink = await runDevAuthLink(application, auth)
  }

  if (scope === 'access') {
    results.access = await runDevAccessSeed(application, { auth })
  }

  return results
}

export function logDevSeedResults(
  results: RunDevSeedsResults,
  options: LogDevSeedResultsOptions = {},
): void {
  if (results.school) {
    if (results.school.status === 'skipped') {
      // eslint-disable-next-line no-console
      console.log(`School seed skipped (${results.school.reason}): ${results.school.schoolCount} school(s) already in database.`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`School seed loaded (${results.school.schoolId}): ${results.school.students} students, ${results.school.staff} staff`)
    }
  }

  if (results.authProvision) {
    const emails = results.authProvision.accounts.map(account => account.email).join(', ')
    // eslint-disable-next-line no-console
    console.log(`Auth provision seeded ${results.authProvision.accounts.length} account(s): ${emails} (password: ${DEV_AUTH_PASSWORD})`)
  }

  if (results.authLink) {
    if (results.authLink.status === 'seeded') {
      const emails = results.authLink.accounts.map(account => account.email).join(', ')
      // eslint-disable-next-line no-console
      console.log(`Auth link linked ${results.authLink.linkedStaff} staff and ${results.authLink.linkedGuardians} guardian(s): ${emails}`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log('Auth link skipped:', results.authLink.reason)
    }
  }

  if (results.access) {
    if (results.access.status === 'seeded') {
      // eslint-disable-next-line no-console
      console.log(`Access seed loaded: ${results.access.roles} roles, ${results.access.assignments} assignments`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log('Access seed skipped:', results.access.reason)
    }
  }

  if (options.isEphemeralDatabase) {
    // eslint-disable-next-line no-console
    console.log('Note: in-memory school data is lost when the API process exits.')
  }
}
