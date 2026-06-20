import type { DevSeedScope, LogDevSeedResultsOptions, RunDevSeedsResults } from '../run-dev-seeds'
import type { AuthProvisioner, SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import type { HttpSeedValidationResult } from './seed-validation'
import { DEV_AUTH_PASSWORD, MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, resolveSeedingApiKeyForSchool, SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import { runDevAccessAssignmentsSeed, runDevAccessRolesSeed } from '../run-dev-access-seed'
import { runDevAuthLink } from '../run-dev-auth-link'
import { DEV_AUTH_PASSWORD, MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/dev-fixtures'
import { runDevAccessAssignmentsSeed, runDevAccessRolesSeed, runDevAccessSeed } from '../run-dev-access-seed'
import { ownerSubjectIdFromAuthProvision } from '../dev-staff-auth-seed'
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
  createLocalInProcessSeedContext,
  isLocalPersistedPgliteDev,
  runLocalInProcessStaffAuthSync,
} from '../run-local-in-process-repair'
import {
  logProvisionedServiceAccountKey,
  provisionSeedingServiceAccountHttp,
  provisionSeedingServiceAccountInProcess,
} from './provision-seeding-service-account'
import { runHttpSeedValidation } from './seed-validation'
import { isServiceAccountApiKeyValid } from './verify-service-account'

export type HttpDevSeedScope = DevSeedScope | 'smoke' | 'service-account' | 'validate'

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
  validation: HttpSeedValidationResult | null
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
    || arg === 'validate'
  ) {
    return arg
  }

  throw new Error(
    `Unknown HTTP seed scope: ${arg}. Usage: bun seed-http.ts [school|auth|auth:link|access|service-account|smoke|validate|all]`,
  )
}

async function createSessionHttpSeedApplication(client: HttpSeedClient): Promise<SeedApplication> {
  await bootstrapHttpCoreSessionWithLocalRepair(client)
  return createCoreHttpSeedApplication({ client })
}

async function bootstrapHttpCoreSessionWithLocalRepair(client: HttpSeedClient): Promise<void> {
  try {
    await bootstrapHttpCoreSession(client)
  }
  catch (error) {
    if (!isLocalPersistedPgliteDev()) {
      throw error
    }

    // eslint-disable-next-line no-console
    console.warn(
      'HTTP /core bootstrap failed; repairing dev auth links in-process against local PGlite...',
    )
    await runLocalInProcessStaffAuthSync()
    await bootstrapHttpCoreSession(client)
  }
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

async function canUseSeedingServiceAccount(
  client: HttpSeedClient,
  apiKey: string,
): Promise<boolean> {
  const grants = await client.jsonRequest('/core/authorization/effective-grants', {
    headers: {
      authorization: `Bearer ${apiKey}`,
    },
  })
  return grants.response.ok
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

  let serviceAccountApiKey = options.serviceAccountApiKey
  if (serviceAccountApiKey && scope !== 'auth') {
    const valid = await isServiceAccountApiKeyValid(client, serviceAccountApiKey)
    if (!valid) {
      // eslint-disable-next-line no-console
      console.warn(
        'SERVICE_ACCOUNT_API_KEY was rejected by the API (401). '
        + 'Falling back to session bootstrap for /core/* seeding. '
        + 'Update apps/api/.env after `bun seed:init` prints a new key.',
      )
      serviceAccountApiKey = undefined
    }
  }

  const results: RunHttpDevSeedsResults = {
    school: null,
    authProvision: null,
    authLink: null,
    access: null,
    smoke: null,
    validation: null,
  }

  if (scope === 'validate') {
    results.validation = await runHttpSeedValidation({ client })
    if (log) {
      logHttpDevSeedResults(results, log)
    }
    return results
  }

  if (scope === 'auth') {
    results.authProvision = await runDevAuthProvision(auth, { baseUrl: client.origin })

    const seedingApiKey = options.serviceAccountApiKey ?? resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID)
    const canListSchoolsViaHttp = Boolean(options.application)
      || Boolean(options.serviceAccountApiKey)
      || await canUseSeedingServiceAccount(client, seedingApiKey)
    const hasSchools = canListSchoolsViaHttp
      ? await hasSeededSchools(client, options.application, seedingApiKey)
      : false
    if (hasSchools) {
      const application = options.application
        ?? (await canUseSeedingServiceAccount(client, seedingApiKey)
          ? createCoreHttpSeedApplication({ client, serviceAccountApiKey: seedingApiKey })
          : await resolveSeedApplication({ ...options, serviceAccountApiKey: seedingApiKey }))
      results.authLink = await runDevAuthLink(application, auth)
    }

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
  const seedingApiKey = options.serviceAccountApiKey ?? resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID)

  if (
    scope === 'all'
    && !serviceAccountApiKey
    && !options.application
    && !(await canUseSeedingServiceAccount(client, seedingApiKey))
  ) {
    results.authProvision = await runDevAuthProvision(auth)

    let useInProcessFallback = false
    try {
      await bootstrapHttpCoreSession(client)
    }
    catch (error) {
      if (!isLocalPersistedPgliteDev()) {
        throw error
      }

      // eslint-disable-next-line no-console
      console.warn(
        'HTTP /core bootstrap failed; completing seed in-process against local PGlite...',
      )
      await runLocalInProcessStaffAuthSync()
      useInProcessFallback = true
    }

    const ownerSubjectId = results.authProvision
      ? ownerSubjectIdFromAuthProvision(results.authProvision)
      : undefined

    if (useInProcessFallback) {
      const local = await createLocalInProcessSeedContext()
      results.school = await runDevSchoolSeed(local.application, {
        auth: local.auth,
        ownerSubjectId,
      })
      results.access = await runDevAccessSeed(local.application, {
        auth: local.auth,
        ownerSubjectId,
      })

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

    const sessionApp = createCoreHttpSeedApplication({ client })
    await runDevAccessRolesSeed(sessionApp)

    const provision = await provisionSeedingServiceAccountHttp(client, {
      schoolId: SEED_SCHOOL_ID,
      apiKey: seedingApiKey,
    })
    logProvisionedServiceAccountKey(provision)

    application = createCoreHttpSeedApplication({ client, serviceAccountApiKey: seedingApiKey })
    const serviceAccountApiKeyFromProvision = provision.apiKey
    if (!serviceAccountApiKeyFromProvision) {
      throw new Error(
        'Seeding service account already exists but SERVICE_ACCOUNT_API_KEY is not set. '
        + 'Add the key to apps/api/.env or rotate the account.',
      )
    }

    application = createCoreHttpSeedApplication({ client, serviceAccountApiKey: serviceAccountApiKeyFromProvision })

    results.school = await runDevSchoolSeed(application, { auth, ownerSubjectId })
    results.access = await runDevAccessAssignmentsSeed(application, { auth, ownerSubjectId })

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
    application = await resolveSeedApplication({
      ...options,
      serviceAccountApiKey: seedingApiKey,
      serviceAccountApiKey,
    })
  }

  const domainResults = await runDevSeeds({
    scope,
    application,
    auth,
    ...(scope === 'all' && !serviceAccountApiKey && !options.application
      ? { skipAuthProvision: true }
      : {}),
  })

  results.school = domainResults.school
  results.authProvision = authProvision ?? domainResults.authProvision
  results.authLink = domainResults.authLink
  results.access = domainResults.access

  if (scope === 'all') {
    await maybeProvisionSeedingServiceAccount({
      ...options,
      serviceAccountApiKey,
    })
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

  if (results.validation) {
    const passedEntities = results.validation.entities.filter(entry => entry.status === 'passed').length
    const passedQueries = results.validation.queries.filter(entry => entry.status === 'passed').length
    if (results.validation.status === 'passed') {
      // eslint-disable-next-line no-console
      console.log(`HTTP seed validation passed (${passedEntities} entities, ${passedQueries} queries).`)
    }
    else {
      // eslint-disable-next-line no-console
      console.log(`HTTP seed validation failed (${results.validation.failures.length} issues).`)
      for (const failure of results.validation.failures) {
        // eslint-disable-next-line no-console
        console.log(`  - ${failure}`)
      }
    }
  }
}
