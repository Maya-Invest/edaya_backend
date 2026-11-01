import type { DevSchoolSeedResult, IntegrationLightSchoolSeedResult } from '@edaya/seeding'
import type { Hono } from 'hono'
import type { AuthenticatedRouteContext } from './api-route-harness'
import type { AppBindings } from '@/http/types'
import type { ApiSchoolApplication } from '@/lib/school-api/application'
import type { ApiRuntime } from '@/runtime'
import process from 'node:process'
import { MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { DEMO_CI_ACADEMIC_YEAR_ID } from '@edaya/fixtures/shared/ids'
import {
  createInProcessAuthLinkSeedPort,
  runDevAccessSeed,
  runDevAuthLinkWithPort,
  runDevSchoolSeed,
  runIntegrationLightSchoolSeed,
} from '@edaya/seeding'
import { afterAll, beforeAll, describe } from 'bun:test'
import {
  createCoreRouteTestApp,
  resetCoreRouteTestHarness,
  signInWithBearerThroughApp,
  testIdentityProvisioner,
} from './api-route-harness'

export type IntegrationFixtureKind = 'light' | 'full'

// Full fixtures provision the complete demo dataset, identity links, access
// assignments and private photos. Match the HTTP seed suite's setup allowance;
// keep the smaller route fixtures and individual assertion deadlines unchanged.
const FULL_SEED_SETUP_TIMEOUT = 600_000

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
  const route = await resolveSharedRouteContext(fixture)
  return { runtime: route.runtime, application: route.application, seedResult: route.seedResult }
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
    .flatMap(bucket => [bucket.route?.runtime])
    .filter((runtime): runtime is ApiRuntime => runtime !== undefined)

  sharedContexts.clear()

  const results = await Promise.allSettled([...new Set(runtimes)].map(runtime => runtime.close()))
  try {
    await resetCoreRouteTestHarness()
  }
  catch (error) {
    results.push({ status: 'rejected', reason: error })
  }
  const failures = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (failures.length)
    throw new AggregateError(failures.map(result => result.reason), 'Failed to release seeded fixtures')
}

async function seedSchoolFixture(
  application: ApiSchoolApplication,
  fixture: IntegrationFixtureKind,
) {
  if (fixture === 'light') {
    return runIntegrationLightSchoolSeed(application)
  }

  return runDevSchoolSeed(application, { auth: testIdentityProvisioner })
}

export async function provisionSeededSchoolDataContext(
  fixture: IntegrationFixtureKind = 'full',
): Promise<SeededSchoolDataContext | LightSchoolDataContext> {
  const { runtime, application } = await createCoreRouteTestApp({ autoCleanup: false })
  try {
    const seedResult = await seedSchoolFixture(application, fixture)
    if (seedResult.status !== 'seeded') {
      throw new Error(`Expected seeded school fixture, received: ${seedResult.status}`)
    }

    return { runtime, application, seedResult }
  }
  catch (error) {
    await runtime.close()
    throw error
  }
}

export async function provisionSeededRouteTestContext(
  fixture: IntegrationFixtureKind = 'full',
): Promise<SeededRouteTestContext> {
  const started = performance.now()
  const routeContext = await createCoreRouteTestApp({ autoCleanup: false })
  const { app, runtime, application } = routeContext
  try {
    const seedResult = await seedSchoolFixture(application, fixture)
    if (seedResult.status !== 'seeded') {
      throw new Error(`Expected seeded school fixture, received: ${seedResult.status}`)
    }

    const auth = testIdentityProvisioner
    await runDevAuthLinkWithPort(createInProcessAuthLinkSeedPort(application), auth)
    await runDevAccessSeed(application, {
      auth,
      includeClassSubjectStaffAssignments: fixture === 'full',
    })

    process.stdout.write(`[fixture bootstrap] ${JSON.stringify({ kind: fixture, durationMs: performance.now() - started })}\n`)
    return {
      app,
      runtime,
      application,
      seedResult,
      authHeaders: async (email = MINIMAL_AUTH_FIXTURE_STAFF_EMAIL) => {
        const accessToken = await signInWithBearerThroughApp(app, { email })
        return {
          'content-type': 'application/json',
          'authorization': `Bearer ${accessToken}`,
          'x-academic-year-id': DEMO_CI_ACADEMIC_YEAR_ID,
        }
      },
    }
  }
  catch (error) {
    await runtime.close()
    throw error
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
    }, fixture === 'light' ? 60_000 : FULL_SEED_SETUP_TIMEOUT)

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
    }, fixture === 'light' ? 45_000 : FULL_SEED_SETUP_TIMEOUT)

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
