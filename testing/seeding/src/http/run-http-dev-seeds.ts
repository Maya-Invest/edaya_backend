import type { DevSeedScope, LogDevSeedResultsOptions, RunDevSeedsResults } from '../run-dev-seeds'
import type { AuthProvisioner, SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import { DEV_AUTH_PASSWORD, MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import { runDevAuthProvision } from '../run-dev-auth-provision'
import {

  logDevSeedResults,

  runDevSeeds,

} from '../run-dev-seeds'
import { HttpAuthProvisioner, signInViaHttp } from './auth'
import { postSystemEntityList } from './system-entity'
import { createSystemHttpSeedApplication } from './system-seed-application'

export type HttpDevSeedScope = DevSeedScope | 'smoke'

export interface RunHttpDevSeedsOptions {
  client: HttpSeedClient
  scope: HttpDevSeedScope
  /** Direct database access for domain loaders. Omit when using `systemActorSecret`. */
  application?: SeedApplication
  /** Remote staging: seed domain data through `/core/system/*` routes. */
  systemActorSecret?: string
  /** Override the default HTTP auth provisioner (for tests). */
  auth?: AuthProvisioner
  log?: LogDevSeedResultsOptions
}

export interface HttpSmokeSeedResult {
  status: 'passed' | 'failed'
  signInStatus: number
  effectiveGrantsStatus?: number
  reason?: string
}

export interface RunHttpDevSeedsResults extends RunDevSeedsResults {
  smoke: HttpSmokeSeedResult | null
}

export function parseHttpDevSeedScope(argv: string[]): HttpDevSeedScope {
  const arg = argv[2]

  if (!arg || arg === 'all') {
    return 'all'
  }

  if (arg === 'school' || arg === 'auth' || arg === 'auth:link' || arg === 'access' || arg === 'smoke') {
    return arg
  }

  throw new Error(`Unknown HTTP seed scope: ${arg}. Usage: bun seed-http.ts [school|auth|auth:link|access|smoke|all]`)
}

function resolveSeedApplication(options: RunHttpDevSeedsOptions): SeedApplication | undefined {
  if (options.application) {
    return options.application
  }

  if (options.systemActorSecret) {
    return createSystemHttpSeedApplication({
      client: options.client,
      systemActorSecret: options.systemActorSecret,
    })
  }

  return undefined
}

function assertSeedApplication(scope: HttpDevSeedScope, application: SeedApplication | undefined): SeedApplication {
  if (!application) {
    throw new Error(
      `HTTP seed scope "${scope}" requires SYSTEM_ACTOR_SECRET. `
      + 'Set SYSTEM_ACTOR_SECRET in apps/api/.env, then run `bun seed` or `bun seed:init`.',
    )
  }

  return application
}

async function hasSeededSchools(
  client: HttpSeedClient,
  application: SeedApplication | undefined,
  systemActorSecret: string | undefined,
): Promise<boolean> {
  if (application && !systemActorSecret) {
    return (await application.repositories.schools.list()).length > 0
  }

  if (systemActorSecret) {
    const schools = await postSystemEntityList(
      {
        client,
        systemActorSecret,
        actor: {
          kind: 'system',
          systemId: 'http-seed-smoke',
          schoolId: SEED_SCHOOL_ID,
          requestId: 'http-seed-smoke',
          reason: 'HTTP smoke seed school check',
        },
      },
      'schools',
    )
    return schools.length > 0
  }

  return false
}

async function runHttpSmokeSeed(
  client: HttpSeedClient,
  options: Pick<RunHttpDevSeedsOptions, 'application' | 'systemActorSecret'>,
): Promise<HttpSmokeSeedResult> {
  await signInViaHttp(client, {
    email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
    password: DEV_AUTH_PASSWORD,
  })

  const hasSchools = await hasSeededSchools(client, options.application, options.systemActorSecret)
  if (!hasSchools) {
    return {
      status: 'failed',
      signInStatus: 200,
      reason: 'School database is empty after sign-in; run school seed first',
    }
  }

  const grants = await client.jsonRequest('/core/authorization/effective-grants')
  if (!grants.response.ok) {
    return {
      status: 'failed',
      signInStatus: 200,
      effectiveGrantsStatus: grants.response.status,
      reason: `Effective grants request failed for ${MINIMAL_AUTH_FIXTURE_STAFF_EMAIL}`,
    }
  }

  return {
    status: 'passed',
    signInStatus: 200,
    effectiveGrantsStatus: grants.response.status,
  }
}

export async function runHttpDevSeeds(options: RunHttpDevSeedsOptions): Promise<RunHttpDevSeedsResults> {
  const { client, scope, log } = options
  const auth = options.auth ?? new HttpAuthProvisioner(client)

  const results: RunHttpDevSeedsResults = {
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
    smoke: null,
  }

  if (scope === 'auth') {
    results.authProvision = await runDevAuthProvision(auth)
    if (log) {
      logDevSeedResults(results, log)
    }
    return results
  }

  if (scope === 'smoke') {
    results.smoke = await runHttpSmokeSeed(client, options)
    return results
  }

  const application = assertSeedApplication(scope, resolveSeedApplication(options))
  const domainResults = await runDevSeeds({
    scope,
    application,
    auth,
  })

  results.school = domainResults.school
  results.authProvision = domainResults.authProvision
  results.authLink = domainResults.authLink
  results.access = domainResults.access

  if (log) {
    logDevSeedResults(domainResults, log)
  }

  return results
}

export function logHttpDevSeedResults(results: RunHttpDevSeedsResults, log: LogDevSeedResultsOptions = {}): void {
  logDevSeedResults(results, log)

  if (results.smoke) {
    if (results.smoke.status === 'passed') {
      // eslint-disable-next-line no-console
      console.log('HTTP smoke seed passed (sign-in + effective-grants).')
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`HTTP smoke seed failed: ${results.smoke.reason ?? 'unknown reason'}`)
    }
  }
}
