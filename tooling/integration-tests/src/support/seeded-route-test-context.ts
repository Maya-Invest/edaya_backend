import type { DevSchoolSeedResult, IntegrationLightSchoolSeedResult } from '@edaya/seeding'
import type { Hono } from 'hono'
import type { AuthenticatedRouteContext } from './api-route-harness'
import type { AppBindings } from '@/http/types'
import type { ApiSchoolApplication } from '@/lib/school-api/application'
import type { ApiRuntime } from '@/runtime'
import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import {
  createHandlerAuthProvisioner,
  createInProcessAuthLinkSeedPort,
  runDevAccessSeed,
  runDevAuthLinkWithPort,
  runDevSchoolSeed,
  runIntegrationLightSchoolSeed,
} from '@edaya/seeding'
import { afterAll, beforeAll, describe } from 'bun:test'
import { apiPgliteEnv } from './api-pglite-env'
import {

  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
  resetCoreRouteTestHarness,
} from './api-route-harness'

export type IntegrationFixtureKind = 'light' | 'full'

type FullSchoolSeedResult = DevSchoolSeedResult & { status: 'seeded' }
type LightSchoolSeedResult = IntegrationLightSchoolSeedResult & { status: 'seeded' }

export interface SeededSchoolDataContext {
  runtime: ApiRuntime
  application: ApiSchoolApplication
  seedResult: FullSchoolSeedResult
}

export interface LightSchoolDataContext {
  runtime: ApiRuntime
  application: ApiSchoolApplication
  seedResult: LightSchoolSeedResult
}

export interface SeededRouteTestContext {
  runtime: ApiRuntime
  application: ApiSchoolApplication
  seedResult: FullSchoolSeedResult | LightSchoolSeedResult
  app: Hono<AppBindings>
  authHeaders: (email?: string) => Promise<Record<string, string>>
}

export function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }

  return values.map((entry) => {
    if (entry && typeof entry === 'object' && 'data' in entry && Object.keys(entry).length === 1) {
      return (entry as { data: T }).data
    }
    return entry as T
  })
}

export interface SeededFixtureOptions {
  /** Fresh PGlite + seed per suite. Use when tests mutate school data. */
  isolate?: boolean
  /** `light` for route/auth tests; `full` for dev seed verification suites. */
  fixture?: IntegrationFixtureKind
}

const sharedContexts = new Map<IntegrationFixtureKind, {
  schoolData?: SeededSchoolDataContext | LightSchoolDataContext
  schoolDataPromise?: Promise<SeededSchoolDataContext | LightSchoolDataContext>
  route?: SeededRouteTestContext
  routePromise?: Promise<SeededRouteTestContext>
}>()

function getSharedBucket(fixture: IntegrationFixtureKind) {
  let bucket = sharedContexts.get(fixture)
  if (!bucket) {
    bucket = {}
    sharedContexts.set(fixture, bucket)
  }
  return bucket
}

async function resolveSharedSchoolDataContext(
  fixture: IntegrationFixtureKind,
): Promise<SeededSchoolDataContext | LightSchoolDataContext> {
  const bucket = getSharedBucket(fixture)
  if (bucket.schoolData) {
    return bucket.schoolData
  }

  bucket.schoolDataPromise ??= provisionSeededSchoolDataContext(fixture)
  bucket.schoolData = await bucket.schoolDataPromise
  return bucket.schoolData
}

async function resolveSharedRouteContext(
  fixture: IntegrationFixtureKind,
): Promise<SeededRouteTestContext> {
  const bucket = getSharedBucket(fixture)
  if (bucket.route) {
    return bucket.route
  }

  bucket.routePromise ??= provisionSeededRouteTestContext(fixture)
  bucket.route = await bucket.routePromise
  return bucket.route
}

/** Tear down shared fixtures once per test run (registered from bootstrap preload). */
export async function releaseSharedSeededFixtures(): Promise<void> {
  const runtimes = [...sharedContexts.values()]
    .flatMap(bucket => [bucket.route?.runtime, bucket.schoolData?.runtime])
    .filter((runtime): runtime is ApiRuntime => runtime !== undefined)

  sharedContexts.clear()

  for (const runtime of runtimes) {
    await runtime.close()
  }

  await resetCoreRouteTestHarness()
}

async function seedSchoolFixture(
  application: ApiSchoolApplication,
  fixture: IntegrationFixtureKind,
) {
  if (fixture === 'light') {
    return runIntegrationLightSchoolSeed(application)
  }

  return runDevSchoolSeed(application)
}

export async function provisionSeededSchoolDataContext(
  fixture: IntegrationFixtureKind = 'full',
): Promise<SeededSchoolDataContext | LightSchoolDataContext> {
  const { runtime, application } = await createCoreRouteTestApp({ autoCleanup: false })
  const seedResult = await seedSchoolFixture(application, fixture)
  if (seedResult.status !== 'seeded') {
    throw new Error(`Expected seeded school fixture, received: ${seedResult.status}`)
  }

  return { runtime, application, seedResult }
}

export async function provisionSeededRouteTestContext(
  fixture: IntegrationFixtureKind = 'full',
): Promise<SeededRouteTestContext> {
  const routeContext = await createCoreRouteTestApp({ autoCleanup: false })
  const { app, runtime, application } = routeContext
  const seedResult = await seedSchoolFixture(application, fixture)
  if (seedResult.status !== 'seeded') {
    throw new Error(`Expected seeded school fixture, received: ${seedResult.status}`)
  }

  const auth = createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL)
  await runDevAuthLinkWithPort(createInProcessAuthLinkSeedPort(application), auth)
  await runDevAccessSeed(application, {
    auth,
    includeClassSubjectStaffAssignments: fixture === 'full',
  })

  return {
    app,
    runtime,
    application,
    seedResult,
    authHeaders: async (email = MINIMAL_AUTH_FIXTURE_STAFF_EMAIL) => {
      const signIn = await app.request(createAppRequest('/auth/sign-in/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: DEV_AUTH_PASSWORD }),
      }))
      const cookies = collectSetCookieHeaders(signIn)
      return {
        'content-type': 'application/json',
        'cookie': cookies.join('; '),
      }
    },
  }
}

function describeWithFixture(
  name: string,
  fixture: IntegrationFixtureKind,
  suite: (getContext: () => SeededRouteTestContext) => void,
  options: SeededFixtureOptions = {},
): void {
  describe(name, () => {
    let context: SeededRouteTestContext

    beforeAll(async () => {
      context = options.isolate
        ? await provisionSeededRouteTestContext(fixture)
        : await resolveSharedRouteContext(fixture)
    }, fixture === 'light' ? 60_000 : 90_000)

    afterAll(async () => {
      if (!options.isolate) {
        return
      }

      if (context?.runtime) {
        await context.runtime.close()
      }
      await resetCoreRouteTestHarness()
    })

    suite(() => context)
  })
}

function describeWithSchoolDataFixture(
  name: string,
  fixture: IntegrationFixtureKind,
  suite: (getContext: () => SeededSchoolDataContext | LightSchoolDataContext) => void,
  options: SeededFixtureOptions = {},
): void {
  describe(name, () => {
    let context: SeededSchoolDataContext | LightSchoolDataContext

    beforeAll(async () => {
      context = options.isolate
        ? await provisionSeededSchoolDataContext(fixture)
        : await resolveSharedSchoolDataContext(fixture)
    }, fixture === 'light' ? 45_000 : 60_000)

    afterAll(async () => {
      if (!options.isolate) {
        return
      }

      if (context?.runtime) {
        await context.runtime.close()
      }
      await resetCoreRouteTestHarness()
    })

    suite(() => context)
  })
}

/** Full dev school fixture — use for seed verification suites. */
export function describeWithSeededSchool(
  name: string,
  suite: (getContext: () => SeededRouteTestContext & { seedResult: FullSchoolSeedResult }) => void,
  options: Omit<SeededFixtureOptions, 'fixture'> = {},
): void {
  describeWithFixture(name, 'full', suite as (getContext: () => SeededRouteTestContext) => void, options)
}

/** Light school fixture — structure, auth-linked people, and access roles only. */
export function describeWithLightSchool(
  name: string,
  suite: (getContext: () => SeededRouteTestContext) => void,
  options: Omit<SeededFixtureOptions, 'fixture'> = {},
): void {
  describeWithFixture(name, 'light', suite, options)
}

export function describeWithSeededSchoolData(
  name: string,
  suite: (getContext: () => SeededSchoolDataContext) => void,
  options: Omit<SeededFixtureOptions, 'fixture'> = {},
): void {
  describeWithSchoolDataFixture(name, 'full', getContext => suite(() => getContext() as SeededSchoolDataContext), options)
}

export function describeWithLightSchoolData(
  name: string,
  suite: (getContext: () => LightSchoolDataContext) => void,
  options: Omit<SeededFixtureOptions, 'fixture'> = {},
): void {
  describeWithSchoolDataFixture(name, 'light', getContext => suite(() => getContext() as LightSchoolDataContext), options)
}

export function describeWithSharedRouteApp(
  name: string,
  suite: (getContext: () => AuthenticatedRouteContext) => void,
): void {
  describe(name, () => {
    let context: AuthenticatedRouteContext

    beforeAll(async () => {
      context = await createCoreRouteTestApp({ autoCleanup: false })
    }, 60_000)

    afterAll(async () => {
      if (context?.runtime) {
        await context.runtime.close()
      }
      await resetCoreRouteTestHarness()
    })

    suite(() => context)
  })
}
