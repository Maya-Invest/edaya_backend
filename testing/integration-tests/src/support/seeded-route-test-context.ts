import type { DevSchoolSeedResult } from '@edaya/seeding'
import type { Hono } from 'hono'
import type { AuthenticatedRouteContext } from './api-route-harness'
import type { AppBindings } from '@/http/types'
import type { ApiSchoolApplication } from '@/lib/school-api/application'
import type { ApiRuntime } from '@/runtime'
import process from 'node:process'
import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import { createHandlerAuthProvisioner, runDevAccessSeed, runDevAuthLink, runDevSchoolSeed } from '@edaya/seeding'
import { afterAll, beforeAll, describe } from 'bun:test'
import { apiPgliteEnv } from './api-pglite-env'
import {

  collectSetCookieHeaders,
  createAppRequest,
  createCoreRouteTestApp,
  resetCoreRouteTestHarness,
} from './api-route-harness'

export interface SeededSchoolDataContext {
  runtime: ApiRuntime
  application: ApiSchoolApplication
  seedResult: DevSchoolSeedResult & { status: 'seeded' }
}

export interface SeededRouteTestContext extends SeededSchoolDataContext {
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
}

let sharedSchoolDataContext: SeededSchoolDataContext | undefined
let sharedSchoolDataPromise: Promise<SeededSchoolDataContext> | undefined
let sharedRouteContext: SeededRouteTestContext | undefined
let sharedRoutePromise: Promise<SeededRouteTestContext> | undefined

async function resolveSharedSchoolDataContext(): Promise<SeededSchoolDataContext> {
  if (sharedSchoolDataContext) {
    return sharedSchoolDataContext
  }

  sharedSchoolDataPromise ??= provisionSeededSchoolDataContext()
  sharedSchoolDataContext = await sharedSchoolDataPromise
  return sharedSchoolDataContext
}

async function resolveSharedRouteContext(): Promise<SeededRouteTestContext> {
  if (sharedRouteContext) {
    return sharedRouteContext
  }

  sharedRoutePromise ??= provisionSeededRouteTestContext()
  sharedRouteContext = await sharedRoutePromise
  return sharedRouteContext
}

/** Tear down shared fixtures once per test run (registered from bootstrap preload). */
export async function releaseSharedSeededFixtures(): Promise<void> {
  const runtimes = [sharedRouteContext?.runtime, sharedSchoolDataContext?.runtime]
    .filter((runtime): runtime is ApiRuntime => runtime !== undefined)

  sharedRouteContext = undefined
  sharedRoutePromise = undefined
  sharedSchoolDataContext = undefined
  sharedSchoolDataPromise = undefined

  for (const runtime of runtimes) {
    await runtime.close()
  }

  await resetCoreRouteTestHarness()
}

export async function provisionSeededSchoolDataContext(): Promise<SeededSchoolDataContext> {
  const { runtime, application } = await createCoreRouteTestApp({ autoCleanup: false })
  const seedResult = await runDevSchoolSeed(application)
  if (seedResult.status !== 'seeded') {
    throw new Error(`Expected seeded school fixture, received: ${seedResult.status}`)
  }

  return { runtime, application, seedResult }
}

export async function provisionSeededRouteTestContext(): Promise<SeededRouteTestContext> {
  const routeContext = await createCoreRouteTestApp({ autoCleanup: false })
  const { app, runtime, application } = routeContext
  const seedResult = await runDevSchoolSeed(application)
  if (seedResult.status !== 'seeded') {
    throw new Error(`Expected seeded school fixture, received: ${seedResult.status}`)
  }

  const auth = createHandlerAuthProvisioner(runtime.getAuth(), apiPgliteEnv.BETTER_AUTH_URL)
  await runDevAuthLink(application, auth)
  await runDevAccessSeed(application)

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

export function describeWithSeededSchoolData(
  name: string,
  suite: (getContext: () => SeededSchoolDataContext) => void,
  options: SeededFixtureOptions = {},
): void {
  describe(name, () => {
    let context: SeededSchoolDataContext

    beforeAll(async () => {
      context = options.isolate
        ? await provisionSeededSchoolDataContext()
        : await resolveSharedSchoolDataContext()
    }, 60_000)

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

export function describeWithSeededSchool(
  name: string,
  suite: (getContext: () => SeededRouteTestContext) => void,
  options: SeededFixtureOptions = {},
): void {
  describe(name, () => {
    let context: SeededRouteTestContext

    beforeAll(async () => {
      context = options.isolate
        ? await provisionSeededRouteTestContext()
        : await resolveSharedRouteContext()
    }, 90_000)

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

/** Skip slow HTTP seed suites when INTEGRATION_TEST_FAST=1 (default in `bun test`). */
export const describeSlowIntegration = process.env.INTEGRATION_TEST_FAST === '1'
  ? describe.skip
  : describe
