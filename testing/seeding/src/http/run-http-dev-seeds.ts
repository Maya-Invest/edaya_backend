import type { DevSeedScope, LogDevSeedResultsOptions, RunDevSeedsResults } from '../run-dev-seeds'
import type { AuthProvisioner, SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import type { HttpSeedValidationResult } from './seed-validation'
import { DEV_AUTH_PASSWORD, MINIMAL_AUTH_FIXTURE_STAFF_EMAIL, resolveSeedingApiKeyForSchool, SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import { createHttpAccessSeedPort } from '../access/http'
import { createInProcessAccessSeedPort } from '../access/in-process'
import { createHttpActivitiesSeedPort } from '../activities/http'
import { createInProcessActivitiesSeedPort } from '../activities/in-process'
import { createHttpAssessmentsSeedPort } from '../assessments/http'
import { createInProcessAssessmentsSeedPort } from '../assessments/in-process'
import { createHttpAttachmentsSeedPort } from '../attachments/http'
import { createInProcessAttachmentsSeedPort } from '../attachments/in-process'
import { createHttpAttendanceSeedPort } from '../attendance/http'
import { createInProcessAttendanceSeedPort } from '../attendance/in-process'
import { createHttpAuthLinkSeedPort } from '../auth-link/http'
import { createInProcessAuthLinkSeedPort } from '../auth-link/in-process'
import { createHttpCommunicationsSeedPort } from '../communications/http'
import { createInProcessCommunicationsSeedPort } from '../communications/in-process'
import { createHttpCurriculumSeedPort } from '../curriculum/http'
import { createInProcessCurriculumSeedPort } from '../curriculum/in-process'
import { ownerSubjectIdFromAuthProvision } from '../dev-staff-auth-seed'
import { createHttpDisciplineSeedPort } from '../discipline/http'
import { createInProcessDisciplineSeedPort } from '../discipline/in-process'
import { createHttpFinanceSeedPort } from '../finance/http'
import { createInProcessFinanceSeedPort } from '../finance/in-process'
import { createHttpLearningContentSeedPort } from '../learning-content/http'
import { createInProcessLearningContentSeedPort } from '../learning-content/in-process'
import { createHttpPopulationSeedPort } from '../population/http'
import { createInProcessPopulationSeedPort } from '../population/in-process'
import { createHttpReportCardsSeedPort } from '../report-cards/http'
import { createInProcessReportCardsSeedPort } from '../report-cards/in-process'
import {
  runDevAccessAssignmentsSeedWithPort,
  runDevAccessRolesSeedWithPort,
} from '../run-dev-access-seed'
import { runDevAuthLinkWithPort } from '../run-dev-auth-link'
import { runDevAuthProvision } from '../run-dev-auth-provision'
import { runDevSchoolSeed } from '../run-dev-school-seed'
import {
  logDevSeedResults,
  runDevSeeds,
} from '../run-dev-seeds'
import { createHttpSchedulingSeedPort } from '../scheduling/http'
import { createInProcessSchedulingSeedPort } from '../scheduling/in-process'
import { createHttpSchoolLifeSeedPort } from '../school-life/http'
import { createInProcessSchoolLifeSeedPort } from '../school-life/in-process'
import { createHttpSchoolStructureSeedPort } from '../school-structure/http'
import { createInProcessSchoolStructureSeedPort } from '../school-structure/in-process'
import { createHttpStudentSupportSeedPort } from '../student-support/http'
import { createInProcessStudentSupportSeedPort } from '../student-support/in-process'
import { HttpAuthProvisioner, signInViaHttp } from './auth'
import { bootstrapHttpCoreSession } from './bootstrap-http-core-session'
import { postEntityList } from './core-entity'
import { throwHttpBootstrapFailure } from './local-dev-http-bootstrap-error'
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

  const profileSeedingApiKey = resolveSeedingApiKeyForSchool(SEED_SCHOOL_ID)
  let serviceAccountApiKey: string | undefined = options.serviceAccountApiKey ?? profileSeedingApiKey
  if (serviceAccountApiKey && scope !== 'auth') {
    const valid = await isServiceAccountApiKeyValid(client, serviceAccountApiKey)
    if (!valid) {
      console.warn(
        'Seeding API key from the school profile in @edaya/dev-fixtures was rejected by the API (401). '
        + 'Using session bootstrap to register the school and provision the seeding service account.',
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

    const seedingApiKey = profileSeedingApiKey
    const canListSchoolsViaHttp = Boolean(options.application)
      || Boolean(options.serviceAccountApiKey)
      || await canUseSeedingServiceAccount(client, seedingApiKey)
    const hasSchools = canListSchoolsViaHttp
      ? await hasSeededSchools(client, options.application, seedingApiKey)
      : false
    if (hasSchools) {
      const authLinkPort = options.application
        ? createInProcessAuthLinkSeedPort(options.application)
        : createHttpAuthLinkSeedPort({ client, serviceAccountApiKey: seedingApiKey })
      results.authLink = await runDevAuthLinkWithPort(authLinkPort, auth)
    }

    if (log) {
      logDevSeedResults(results, log)
    }
    return results
  }

  if (scope === 'smoke') {
    results.smoke = await runHttpSmokeSeed(client, {
      application: options.application,
      serviceAccountApiKey,
    })
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
  const seedingApiKey = profileSeedingApiKey

  if (
    scope === 'all'
    && !serviceAccountApiKey
    && !options.application
    && !(await canUseSeedingServiceAccount(client, seedingApiKey))
  ) {
    results.authProvision = await runDevAuthProvision(auth)

    try {
      await bootstrapHttpCoreSession(client)
    }
    catch (error) {
      throwHttpBootstrapFailure(error)
    }

    const ownerSubjectId = results.authProvision
      ? ownerSubjectIdFromAuthProvision(results.authProvision)
      : undefined

    await runDevAccessRolesSeedWithPort(createHttpAccessSeedPort({ client }))

    const provision = await provisionSeedingServiceAccountHttp(client, {
      schoolId: SEED_SCHOOL_ID,
      apiKey: seedingApiKey,
    })
    logProvisionedServiceAccountKey(provision)

    const serviceAccountApiKeyFromProvision = provision.apiKey ?? seedingApiKey
    if (!serviceAccountApiKeyFromProvision) {
      throw new Error(
        'Seeding service account already exists but the profile API key is not available. '
        + 'Run `bun seed:service-account` or wipe `.data` and run `bun seed:init`.',
      )
    }

    const authLinkPort = createHttpAuthLinkSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const accessSeedPort = createHttpAccessSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const schoolStructurePort = createHttpSchoolStructureSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const populationPort = createHttpPopulationSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const curriculumPort = createHttpCurriculumSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const schedulingPort = createHttpSchedulingSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const attendancePort = createHttpAttendanceSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const assessmentsPort = createHttpAssessmentsSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const reportCardsPort = createHttpReportCardsSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const financePort = createHttpFinanceSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const learningContentPort = createHttpLearningContentSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const activitiesPort = createHttpActivitiesSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const schoolLifePort = createHttpSchoolLifeSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const studentSupportPort = createHttpStudentSupportSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const disciplinePort = createHttpDisciplineSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const communicationsPort = createHttpCommunicationsSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })
    const attachmentsPort = createHttpAttachmentsSeedPort({
      client,
      serviceAccountApiKey: serviceAccountApiKeyFromProvision,
    })

    results.school = await runDevSchoolSeed(undefined, {
      auth,
      ownerSubjectId,
      authLinkPort,
      schoolStructurePort,
      populationPort,
      curriculumPort,
      schedulingPort,
      attendancePort,
      assessmentsPort,
      reportCardsPort,
      financePort,
      learningContentPort,
      activitiesPort,
      schoolLifePort,
      studentSupportPort,
      disciplinePort,
      communicationsPort,
      attachmentsPort,
    })
    results.access = await runDevAccessAssignmentsSeedWithPort(
      accessSeedPort,
      { auth, ownerSubjectId, authLinkPort },
    )

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
  if (!options.application && !serviceAccountApiKey) {
    try {
      await bootstrapHttpCoreSession(client)
    }
    catch (error) {
      throwHttpBootstrapFailure(error)
    }
  }

  const domainResults = await runDevSeeds({
    scope,
    application: options.application,
    auth,
    authLinkPort: options.application
      ? createInProcessAuthLinkSeedPort(options.application)
      : createHttpAuthLinkSeedPort({ client, serviceAccountApiKey }),
    accessSeedPort: options.application
      ? createInProcessAccessSeedPort(options.application)
      : createHttpAccessSeedPort({ client, serviceAccountApiKey }),
    schoolStructurePort: options.application
      ? createInProcessSchoolStructureSeedPort(options.application)
      : createHttpSchoolStructureSeedPort({ client, serviceAccountApiKey }),
    populationPort: options.application
      ? createInProcessPopulationSeedPort(options.application)
      : createHttpPopulationSeedPort({ client, serviceAccountApiKey }),
    curriculumPort: options.application
      ? createInProcessCurriculumSeedPort(options.application)
      : createHttpCurriculumSeedPort({ client, serviceAccountApiKey }),
    schedulingPort: options.application
      ? createInProcessSchedulingSeedPort(options.application)
      : createHttpSchedulingSeedPort({ client, serviceAccountApiKey }),
    attendancePort: options.application
      ? createInProcessAttendanceSeedPort(options.application)
      : createHttpAttendanceSeedPort({ client, serviceAccountApiKey }),
    assessmentsPort: options.application
      ? createInProcessAssessmentsSeedPort(options.application)
      : createHttpAssessmentsSeedPort({ client, serviceAccountApiKey }),
    reportCardsPort: options.application
      ? createInProcessReportCardsSeedPort(options.application)
      : createHttpReportCardsSeedPort({ client, serviceAccountApiKey }),
    financePort: options.application
      ? createInProcessFinanceSeedPort(options.application)
      : createHttpFinanceSeedPort({ client, serviceAccountApiKey }),
    learningContentPort: options.application
      ? createInProcessLearningContentSeedPort(options.application)
      : createHttpLearningContentSeedPort({ client, serviceAccountApiKey }),
    activitiesPort: options.application
      ? createInProcessActivitiesSeedPort(options.application)
      : createHttpActivitiesSeedPort({ client, serviceAccountApiKey }),
    schoolLifePort: options.application
      ? createInProcessSchoolLifeSeedPort(options.application)
      : createHttpSchoolLifeSeedPort({ client, serviceAccountApiKey }),
    studentSupportPort: options.application
      ? createInProcessStudentSupportSeedPort(options.application)
      : createHttpStudentSupportSeedPort({ client, serviceAccountApiKey }),
    disciplinePort: options.application
      ? createInProcessDisciplineSeedPort(options.application)
      : createHttpDisciplineSeedPort({ client, serviceAccountApiKey }),
    communicationsPort: options.application
      ? createInProcessCommunicationsSeedPort(options.application)
      : createHttpCommunicationsSeedPort({ client, serviceAccountApiKey }),
    attachmentsPort: options.application
      ? createInProcessAttachmentsSeedPort(options.application)
      : createHttpAttachmentsSeedPort({ client, serviceAccountApiKey }),
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
