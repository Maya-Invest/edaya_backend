import type { DevSeedScope, LogDevSeedResultsOptions, RunDevSeedsResults } from '../run-dev-seeds'
import type { AuthProvisioner, SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import { DEV_AUTH_PASSWORD, MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/dev-fixtures'
import { runDevAccessAssignmentsSeed, runDevAccessRolesSeed } from '../run-dev-access-seed'
import { runDevAuthLink } from '../run-dev-auth-link'
import { runDevAuthProvision } from '../run-dev-auth-provision'
import { runDevSchoolSeed } from '../run-dev-school-seed'
import {
  logDevSeedResults,
  runDevSeeds,
} from '../run-dev-seeds'
import { HttpAuthProvisioner, signInViaHttp } from './auth'
import { bootstrapHttpCoreSession } from './bootstrap-http-core-session'
import { postEntityList } from './core-entity'
import { createCoreHttpSeedApplication } from './core-seed-application'
import {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
  provisionSeedingServiceAccountInProcess,
} from './provision-seeding-service-account'

export type HttpDevSeedScope = DevSeedScope | 'smoke' | 'service-account'

export interface RunHttpDevSeedsOptions {
  client: HttpSeedClient
  scope: HttpDevSeedScope
  /** Direct database access for domain loaders. */
  application?: SeedApplication
  /** Seed domain data through `/core/*` routes with a service account API key. */
  serviceAccountApiKey?: string
  /** Override the default HTTP auth provisioner (for tests). */
  auth?: AuthProvisioner
  /** After `all`, provision a seeding service account when no API key is configured. */
  provisionServiceAccount?: boolean
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

  if (
    arg === 'school'
    || arg === 'auth'
    || arg === 'auth:link'
    || arg === 'access'
    || arg === 'smoke'
    || arg === 'service-account'
  ) {
    return arg
  }

  throw new Error(
    `Unknown HTTP seed scope: ${arg}. Usage: bun seed-http.ts [school|auth|auth:link|access|service-account|smoke|all]`,
  )
}

async function createSessionHttpSeedApplication(client: HttpSeedClient): Promise<SeedApplication> {
  await bootstrapHttpCoreSession(client)
  return createCoreHttpSeedApplication({ client })
}

async function resolveSeedApplication(options: RunHttpDevSeedsOptions): Promise<SeedApplication> {
  if (options.application) {
    return options.application
  }

  if (options.serviceAccountApiKey) {
    return createCoreHttpSeedApplication({
      client: options.client,
      serviceAccountApiKey: options.serviceAccountApiKey,
    })
  }

  return createSessionHttpSeedApplication(options.client)
}

async function hasSeededSchools(
  client: HttpSeedClient,
  application: SeedApplication | undefined,
  serviceAccountApiKey: string | undefined,
): Promise<boolean> {
  if (application) {
    return (await application.repositories.schools.list()).length > 0
  }

  const schools = await postEntityList(
    {
      client,
      serviceAccountApiKey,
      requestId: 'http-seed-smoke',
    },
    'schools',
  )
  return schools.length > 0
}

async function runHttpSmokeSeed(
  client: HttpSeedClient,
  options: Pick<RunHttpDevSeedsOptions, 'application' | 'serviceAccountApiKey'>,
): Promise<HttpSmokeSeedResult> {
  if (options.serviceAccountApiKey) {
    const hasSchools = await hasSeededSchools(
      client,
      options.application,
      options.serviceAccountApiKey,
    )
    if (!hasSchools) {
      return {
        status: 'failed',
        signInStatus: 0,
        reason: 'School database is empty; run school seed first',
      }
    }

    const grants = await client.jsonRequest('/core/authorization/effective-grants', {
      headers: {
        authorization: `Bearer ${options.serviceAccountApiKey}`,
      },
    })
    if (!grants.response.ok) {
      return {
        status: 'failed',
        signInStatus: 0,
        effectiveGrantsStatus: grants.response.status,
        reason: 'Effective grants request failed for seeding service account',
      }
    }

    return {
      status: 'passed',
      signInStatus: 0,
      effectiveGrantsStatus: grants.response.status,
    }
  }

  await signInViaHttp(client, {
    email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
    password: DEV_AUTH_PASSWORD,
  })

  const hasSchools = await hasSeededSchools(client, options.application, undefined)
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

async function maybeProvisionSeedingServiceAccount(
  options: RunHttpDevSeedsOptions,
): Promise<void> {
  if (options.serviceAccountApiKey || options.provisionServiceAccount === false) {
    return
  }

  if (options.application) {
    const result = await provisionSeedingServiceAccountInProcess(options.application)
    logProvisionedServiceAccountKey(result)
    return
  }

  const result = await provisionSeedingServiceAccountHttp(options.client)
  logProvisionedServiceAccountKey(result)
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
    results.authProvision = await runDevAuthProvision(auth, { baseUrl: client.origin })
    if (log) {
      logDevSeedResults(results, log)
    }
    return results
  }

  if (scope === 'smoke') {
    results.smoke = await runHttpSmokeSeed(client, options)
    return results
  }

  if (scope === 'service-account') {
    if (options.application) {
      const result = await provisionSeedingServiceAccountInProcess(options.application)
      logProvisionedServiceAccountKey(result)
      return results
    }

    const result = await provisionSeedingServiceAccountHttp(client)
    logProvisionedServiceAccountKey(result)
    return results
  }

  const authProvision: Awaited<ReturnType<typeof runDevAuthProvision>> | null = null
  let application: SeedApplication

  if (
    scope === 'all'
    && !options.serviceAccountApiKey
    && !options.application
  ) {
    results.authProvision = await runDevAuthProvision(auth)
    await bootstrapHttpCoreSession(client)

    const sessionApp = createCoreHttpSeedApplication({ client })
    await runDevAccessRolesSeed(sessionApp)

    const provision = await provisionSeedingServiceAccountHttp(client)
    logProvisionedServiceAccountKey(provision)

    const serviceAccountApiKey = provision.apiKey
    if (!serviceAccountApiKey) {
      throw new Error(
        'Seeding service account already exists but SERVICE_ACCOUNT_API_KEY is not set. '
        + 'Add the key to apps/api/.env or rotate the account.',
      )
    }

    application = createCoreHttpSeedApplication({ client, serviceAccountApiKey })

    results.school = await runDevSchoolSeed(application)
    results.authLink = await runDevAuthLink(application, auth)
    results.access = await runDevAccessAssignmentsSeed(application)

    if (log) {
      logDevSeedResults({
        school: results.school,
        authProvision: results.authProvision,
        authLink: results.authLink,
        access: results.access,
      }, log)
    }

    return results
  }
  else {
    application = await resolveSeedApplication(options)
  }

  const domainResults = await runDevSeeds({
    scope,
    application,
    auth,
    ...(scope === 'all' && !options.serviceAccountApiKey && !options.application
      ? { skipAuthProvision: true }
      : {}),
  })

  results.school = domainResults.school
  results.authProvision = authProvision ?? domainResults.authProvision
  results.authLink = domainResults.authLink
  results.access = domainResults.access

  if (scope === 'all') {
    await maybeProvisionSeedingServiceAccount(options)
  }

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
