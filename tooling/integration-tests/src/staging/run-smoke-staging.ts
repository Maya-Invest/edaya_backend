/* eslint-disable no-console -- CLI progress and result reporting intentionally writes to stdout. */
import { HttpSeedClient, signInViaHttp } from '@edaya/seeding/http'
import { loadSmokeStagingEnv } from './load-smoke-env'

export interface SmokeCheckResult {
  id: string
  label: string
  status: 'passed' | 'failed' | 'skipped'
  detail?: string
}

export interface SmokeStagingResult {
  checks: SmokeCheckResult[]
  passed: boolean
}

function truncateBody(text: string, max = 240): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) {
    return trimmed
  }
  return `${trimmed.slice(0, max)}…`
}

async function checkHealth(client: HttpSeedClient): Promise<SmokeCheckResult> {
  const { response, body } = await client.jsonRequest<{ message?: string }>('/')
  if (!response.ok) {
    return {
      id: 'S1',
      label: 'API health',
      status: 'failed',
      detail: `GET / returned ${response.status}`,
    }
  }

  if (body?.message !== 'Edaya Core API') {
    return {
      id: 'S1',
      label: 'API health',
      status: 'failed',
      detail: `Unexpected body: ${JSON.stringify(body)}`,
    }
  }

  return { id: 'S1', label: 'API health', status: 'passed' }
}

async function checkDocs(client: HttpSeedClient): Promise<SmokeCheckResult> {
  for (const path of ['/doc', '/reference'] as const) {
    const response = await client.request(path)
    if (response.ok) {
      return { id: 'S2', label: 'OpenAPI docs', status: 'passed', detail: path }
    }
  }

  return {
    id: 'S2',
    label: 'OpenAPI docs',
    status: 'failed',
    detail: 'Neither /doc nor /reference returned 200',
  }
}

async function checkCorsAllow(client: HttpSeedClient, appOrigin: string): Promise<SmokeCheckResult> {
  const response = await client.request('/core/entities/schools/list', {
    method: 'OPTIONS',
    headers: {
      'Origin': appOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-academic-year-id',
    },
  })

  const allowOrigin = response.headers.get('access-control-allow-origin')
  if (response.status === 204 && allowOrigin === appOrigin) {
    return { id: 'S3', label: 'CORS trusted origin', status: 'passed' }
  }

  return {
    id: 'S3',
    label: 'CORS trusted origin',
    status: 'failed',
    detail: `status=${response.status}, allow-origin=${allowOrigin ?? 'missing'}`,
  }
}

async function checkCorsDeny(client: HttpSeedClient): Promise<SmokeCheckResult> {
  const evilOrigin = 'https://evil.example.com'
  const response = await client.request('/core/entities/schools/list', {
    method: 'OPTIONS',
    headers: {
      'Origin': evilOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  const allowOrigin = response.headers.get('access-control-allow-origin')
  if (allowOrigin === evilOrigin) {
    return {
      id: 'S4',
      label: 'CORS unknown origin rejected',
      status: 'failed',
      detail: `evil origin was reflected in allow-origin=${allowOrigin}`,
    }
  }

  return { id: 'S4', label: 'CORS unknown origin rejected', status: 'passed' }
}

async function checkSignIn(
  client: HttpSeedClient,
  _appOrigin: string,
  email: string,
  password: string,
): Promise<SmokeCheckResult> {
  try {
    await signInViaHttp(client, { email, password })
  }
  catch (error) {
    return { id: 'S5', label: 'Identity sign-in', status: 'failed', detail: error instanceof Error ? error.message : 'Sign-in failed' }
  }

  if (!client.cookieHeader()) {
    return {
      id: 'S5',
      label: 'Identity sign-in',
      status: 'failed',
      detail: 'Sign-in succeeded but no session cookie was set',
    }
  }

  return { id: 'S5', label: 'Identity sign-in', status: 'passed' }
}

async function diagnoseMissingActor(client: HttpSeedClient): Promise<string | undefined> {
  const { response, body } = await client.jsonRequest<{
    session?: { id?: string }
    user?: { email?: string }
  }>('/auth/edaya/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })

  if (response.ok && body?.session && body?.user) {
    const email = body.user.email ?? 'unknown'
    return `Auth session is valid for ${email} but no portal actor is linked — run \`bun repo seed --staging\``
  }

  return undefined
}

async function checkEffectiveGrants(client: HttpSeedClient): Promise<SmokeCheckResult> {
  const { response, body } = await client.jsonRequest<{
    kind?: string
    grants?: Array<{ permission: string }>
  }>('/core/authorization/effective-grants')

  if (!response.ok) {
    const missingActor = response.status === 401
      ? await diagnoseMissingActor(client)
      : undefined

    return {
      id: 'S6',
      label: 'Effective grants',
      status: 'failed',
      detail: missingActor ?? `${response.status} ${truncateBody(JSON.stringify(body ?? {}))}`,
    }
  }

  if (body?.kind !== 'staff') {
    return {
      id: 'S6',
      label: 'Effective grants',
      status: 'failed',
      detail: `Expected staff actor, got ${body?.kind ?? 'unknown'}`,
    }
  }

  return { id: 'S6', label: 'Effective grants', status: 'passed' }
}

async function checkServiceAccount(apiUrl: string, apiKey: string): Promise<SmokeCheckResult> {
  const client = new HttpSeedClient({ baseUrl: apiUrl })
  const { response } = await client.jsonRequest('/core/entities/schools/list', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return {
      id: 'S7',
      label: 'Service account entity access',
      status: 'failed',
      detail: response.status === 401 || response.status === 500
        ? `${response.status} — service account key may be missing on staging; run \`bun repo seed --staging\``
        : `${response.status}`,
    }
  }

  return { id: 'S7', label: 'Service account entity access', status: 'passed' }
}

function schoolIdFromListItem(school: { id?: string, data?: { id?: string } }): string | undefined {
  return school.id ?? school.data?.id
}

async function checkSeededSchool(client: HttpSeedClient, schoolId: string): Promise<SmokeCheckResult> {
  const { response, body } = await client.jsonRequest<Array<{ id?: string, data?: { id?: string } }>>('/core/entities/schools/list', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    const missingActor = response.status === 401
      ? await diagnoseMissingActor(client)
      : undefined

    return {
      id: 'S8',
      label: 'Hyperdrive seeded data',
      status: 'failed',
      detail: missingActor ?? `${response.status}`,
    }
  }

  const schools = body ?? []
  if (!schools.some(school => schoolIdFromListItem(school) === schoolId)) {
    return {
      id: 'S8',
      label: 'Hyperdrive seeded data',
      status: 'failed',
      detail: `Expected seeded school ${schoolId} in list response`,
    }
  }

  return { id: 'S8', label: 'Hyperdrive seeded data', status: 'passed' }
}

export async function runSmokeStaging(): Promise<SmokeStagingResult> {
  const env = loadSmokeStagingEnv()
  const staffEmail = env.staffEmail
  const staffPassword = env.staffPassword
  const client = new HttpSeedClient({
    baseUrl: env.apiUrl,
    appOrigin: env.appOrigin,
  })
  const checks: SmokeCheckResult[] = []

  checks.push(await checkHealth(client))
  checks.push(await checkDocs(client))
  checks.push(await checkCorsAllow(client, env.appOrigin))
  checks.push(await checkCorsDeny(client))

  const signInResult = await checkSignIn(client, env.appOrigin, staffEmail, staffPassword)
  checks.push(signInResult)

  if (signInResult.status === 'passed') {
    checks.push(await checkEffectiveGrants(client))
    checks.push(await checkSeededSchool(client, env.schoolId))
  }
  else {
    checks.push({
      id: 'S6',
      label: 'Effective grants',
      status: 'skipped',
      detail: 'Skipped because sign-in failed',
    })
    checks.push({
      id: 'S8',
      label: 'Hyperdrive seeded data',
      status: 'skipped',
      detail: 'Skipped because sign-in failed',
    })
  }

  checks.push(await checkServiceAccount(env.apiUrl, env.serviceAccountApiKey))

  const passed = checks.every(check => check.status === 'passed' || check.status === 'skipped')
  return { checks, passed }
}

export async function runSmokeStagingCli(): Promise<number> {
  const env = loadSmokeStagingEnv()
  console.log(`Running staging smoke against ${env.apiUrl} (app origin ${env.appOrigin})`)

  const result = await runSmokeStaging()

  for (const check of result.checks) {
    const icon = check.status === 'passed' ? '✓' : check.status === 'skipped' ? '○' : '✗'
    const suffix = check.detail ? ` — ${check.detail}` : ''
    console.log(`${icon} ${check.id} ${check.label} [${check.status}]${suffix}`)
  }

  if (result.passed) {
    console.log('\nStaging smoke passed.')
    return 0
  }

  console.error('\nStaging smoke failed.')
  return 1
}

// Convenience re-export for tests that sign in through the shared client path.
export { signInViaHttp }
