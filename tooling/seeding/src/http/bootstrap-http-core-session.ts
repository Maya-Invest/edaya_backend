import type { HttpSeedClient } from './client'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_SCHOOL_ID,
  SEED_SCHOOL_OWNER_STAFF_ID,
  SEED_SCHOOL_PROFILE,
  SEED_STAFF,
  splitDisplayName,
} from '@edaya/fixtures'
import { HttpAuthProvisioner } from './auth'
import { isTransientHttpStatus } from './client'

const BOOTSTRAP_SIGN_IN_STAFF_IDS = ['st5', 'st8', 'st1', 'st3', 'st7'] as const

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

async function trySignIn(client: HttpSeedClient, email: string): Promise<boolean> {
  client.clearCookies()
  const response = await client.request('/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password: DEV_AUTH_PASSWORD,
    }),
  })

  if (response.ok) {
    return true
  }

  const message = await response.text()
  if (isTransientHttpStatus(response.status)) {
    throw new Error(
      `Staff sign-in failed with transient HTTP ${response.status} after retries: ${message}`,
    )
  }

  return false
}

/** Sign in with the dev owner account that will register the school. */
async function signInForOnboarding(client: HttpSeedClient): Promise<void> {
  const onboardingStaffIds = [
    MINIMAL_AUTH_FIXTURE_STAFF_ID,
    SEED_SCHOOL_OWNER_STAFF_ID,
    ...BOOTSTRAP_SIGN_IN_STAFF_IDS,
  ]

  const seen = new Set<string>()
  for (const staffId of onboardingStaffIds) {
    if (seen.has(staffId)) {
      continue
    }
    seen.add(staffId)

    const account = DEV_AUTH_STAFF_ACCOUNTS.find(entry => entry.staffId === staffId)
    if (account && await trySignIn(client, account.email)) {
      return
    }
  }

  const ownerAccount = DEV_AUTH_STAFF_ACCOUNTS.find(
    account => account.staffId === SEED_SCHOOL_OWNER_STAFF_ID,
  )
  const ownerMember = SEED_STAFF.find(member => member.id === SEED_SCHOOL_OWNER_STAFF_ID)
  if (ownerAccount && ownerMember) {
    client.clearCookies()
    const provisioner = new HttpAuthProvisioner(client)
    await provisioner.ensureUser({
      email: ownerAccount.email,
      password: DEV_AUTH_PASSWORD,
      name: ownerMember.name,
    })
    if (await trySignIn(client, ownerAccount.email)) {
      return
    }
  }

  throw new Error(
    'Could not sign in with the dev school owner account. '
    + 'Run `bun seed:auth` with the API running, then retry `bun seed:init`.',
  )
}

/** Establish a linked staff actor for session-backed /core/* seeding via onboarding. */
export async function bootstrapHttpCoreSession(client: HttpSeedClient): Promise<void> {
  await signInForOnboarding(client)

  if (await probeCoreAccess(client) === 'authorized') {
    return
  }

  const ownerMember = SEED_STAFF.find(member => member.id === MINIMAL_AUTH_FIXTURE_STAFF_ID)
  const ownerAccount = DEV_AUTH_STAFF_ACCOUNTS.find(
    account => account.staffId === MINIMAL_AUTH_FIXTURE_STAFF_ID,
  )
  if (!ownerMember || !ownerAccount) {
    throw new Error('Dev owner fixture is missing from seed data')
  }

  const ownerName = splitDisplayName(ownerMember.name)
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
      ownerFirstName: ownerName.firstName,
      ownerLastName: ownerName.lastName,
      ownerEmail: ownerAccount.email,
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
