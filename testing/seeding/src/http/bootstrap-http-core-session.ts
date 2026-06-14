import type { HttpSeedClient } from './client'
import {
  DEV_AUTH_PASSWORD,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_PROFILE,
  SEED_STAFF,
  splitDisplayName,
} from '@edaya/dev-fixtures'
import { HttpAuthProvisioner, signInViaHttp } from './auth'
import { isTransientHttpStatus } from './client'

async function ensureDirectorSignedIn(client: HttpSeedClient): Promise<void> {
  const director = SEED_STAFF[0]

  const response = await client.request('/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      password: DEV_AUTH_PASSWORD,
    }),
  })

  if (response.ok) {
    return
  }

  if (response.status === 401 || response.status === 422) {
    const provisioner = new HttpAuthProvisioner(client)
    await provisioner.ensureUser({
      email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      password: DEV_AUTH_PASSWORD,
      name: director.name,
    })
    await signInViaHttp(client, {
      email: MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
      password: DEV_AUTH_PASSWORD,
    })
    return
  }

  const message = await response.text()
  if (isTransientHttpStatus(response.status)) {
    throw new Error(
      `Director sign-in failed with transient HTTP ${response.status} after retries: ${message}`,
    )
  }

  throw new Error(`Director sign-in failed: ${response.status} ${message}`)
}

async function probeCoreAccess(client: HttpSeedClient): Promise<'authorized' | 'unauthorized'> {
  const { response } = await client.jsonRequest('/core/entities/schools/list', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  if (response.status === 401 || response.status === 403) {
    return 'unauthorized'
  }

  if (!response.ok) {
    const text = await response.text().catch(() => `HTTP ${response.status}`)
    throw new Error(`Failed to probe /core access: ${response.status} ${text}`)
  }

  return 'authorized'
}

/** Establish a linked staff actor for session-backed /core/* seeding via onboarding. */
export async function bootstrapHttpCoreSession(client: HttpSeedClient): Promise<void> {
  await ensureDirectorSignedIn(client)

  if (await probeCoreAccess(client) === 'authorized') {
    return
  }

  const director = SEED_STAFF[0]
  const directorName = splitDisplayName(director.name)
  const { response, body } = await client.jsonRequest('/core/onboarding/register-school', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'http-seed-bootstrap',
    },
    body: JSON.stringify({
      id: SEED_SCHOOL_ID,
      name: SEED_SCHOOL_PROFILE.name,
      timeZone: SEED_SCHOOL_PROFILE.timeZone,
      country: SEED_SCHOOL_PROFILE.country,
      city: SEED_SCHOOL_PROFILE.city,
      ownerStaffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      ownerFirstName: directorName.firstName,
      ownerLastName: directorName.lastName,
      ownerEmail: director.email,
    }),
  })

  if (!response.ok) {
    const message = typeof body === 'object' && body && 'message' in body
      ? String((body as { message?: string }).message)
      : `HTTP ${response.status}`
    throw new Error(`Failed to bootstrap HTTP core session via onboarding: ${message}`)
  }

  if (await probeCoreAccess(client) !== 'authorized') {
    throw new Error('HTTP core session bootstrap completed but /core/* is still unauthorized')
  }
}
