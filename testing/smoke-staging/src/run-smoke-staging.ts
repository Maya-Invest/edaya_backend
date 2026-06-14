import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_SCHOOL_ID,
} from '@edaya/dev-fixtures'
import { HttpSeedClient, signInViaHttp } from '@edaya/seeding/http'
import { loadSmokeStagingEnv } from '../src/load-smoke-env'

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
      Origin: appOrigin,
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

async function checkCorsDeny(client: HttpSeedClient, trustedOrigin: string): Promise<SmokeCheckResult> {
  const response = await client.request('/core/entities/schools/list', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://evil.example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type',
    },
  })

  const allowOrigin = response.headers.get('access-control-allow-origin')
  if (allowOrigin === trustedOrigin || allowOrigin === 'https://evil.example.com') {
    return {
      id: 'S4',
      label: 'CORS unknown origin rejected',
      status: 'failed',
      detail: `unexpected allow-origin=${allowOrigin}`,
    }
  }

  return { id: 'S4', label: 'CORS unknown origin rejected', status: 'passed' }
}

async function checkSignIn(
  client: HttpSeedClient,
  appOrigin: string,
  email: string,
  password: string,
): Promise<SmokeCheckResult> {
  const response = await client.request('/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: appOrigin,
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    return {
      id: 'S5',
      label: 'Auth sign-in',
      status: 'failed',
      detail: `${response.status} ${truncateBody(await response.text())}`,
    }
  }

  if (!client.cookieHeader()) {
    return {
      id: 'S5',
      label: 'Auth sign-in',
      status: 'failed',
      detail: 'Sign-in succeeded but no session cookie was set',
    }
  }

  return { id: 'S5', label: 'Auth sign-in', status: 'passed' }
}

async function checkEffectiveGrants(client: HttpSeedClient): Promise<SmokeCheckResult> {
  const { response, body } = await client.jsonRequest<{
    kind?: string
    effectiveGrants?: { permissions?: string[] }
  }>('/core/authorization/effective-grants')

  if (!response.ok) {
    return {
      id: 'S6',
      label: 'Effective grants',
      status: 'failed',
      detail: `${response.status} ${truncateBody(JSON.stringify(body ?? {}))}`,
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
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return {
      id: 'S7',
      label: 'Service account entity access',
      status: 'failed',
      detail: `${response.status}`,
    }
  }

  return { id: 'S7', label: 'Service account entity access', status: 'passed' }
}

async function checkSeededSchool(client: HttpSeedClient): Promise<SmokeCheckResult> {
  const { response, body } = await client.jsonRequest<Array<{ id?: string }>>('/core/entities/schools/list', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (!response.ok) {
    return {
      id: 'S8',
      label: 'Hyperdrive seeded data',
      status: 'failed',
      detail: `${response.status}`,
    }
  }

  const schools = body ?? []
  if (!schools.some(school => school.id === SEED_SCHOOL_ID)) {
    return {
      id: 'S8',
      label: 'Hyperdrive seeded data',
      status: 'failed',
      detail: `Expected seeded school ${SEED_SCHOOL_ID} in list response`,
    }
  }

  return { id: 'S8', label: 'Hyperdrive seeded data', status: 'passed' }
}

export async function runSmokeStaging(): Promise<SmokeStagingResult> {
  const env = loadSmokeStagingEnv()
  const staffEmail = env.staffEmail || MINIMAL_AUTH_FIXTURE_STAFF_EMAIL
  const staffPassword = env.staffPassword || DEV_AUTH_PASSWORD
  const client = new HttpSeedClient({ baseUrl: env.apiUrl })
  const checks: SmokeCheckResult[] = []

  checks.push(await checkHealth(client))
  checks.push(await checkDocs(client))
  checks.push(await checkCorsAllow(client, env.appOrigin))
  checks.push(await checkCorsDeny(client, env.appOrigin))

  const signInResult = await checkSignIn(client, env.appOrigin, staffEmail, staffPassword)
  checks.push(signInResult)

  if (signInResult.status === 'passed') {
    checks.push(await checkEffectiveGrants(client))
    checks.push(await checkSeededSchool(client))
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

  if (env.serviceAccountApiKey) {
    checks.push(await checkServiceAccount(env.apiUrl, env.serviceAccountApiKey))
  }
  else {
    checks.push({
      id: 'S7',
      label: 'Service account entity access',
      status: 'skipped',
      detail: 'Set SERVICE_ACCOUNT_API_KEY to enable',
    })
  }

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
