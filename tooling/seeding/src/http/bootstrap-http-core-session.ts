import type { HttpSeedClient } from './client'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { splitDisplayName } from '@edaya/fixtures/shared/people'
import { HttpAuthProvisioner } from './auth'
import { isTransientHttpStatus } from './client'

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

async function trySignIn(client: HttpSeedClient, email: string, password: string): Promise<boolean> {
  client.clearCookies()
  const response = await client.request('/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
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
  const context = resolveDevSeedContext()
  const onboardingStaffIds = [
    context.minimalStaffId,
    context.ownerStaffId,
    ...context.bootstrapSignInStaffIds,
  ]

  const seen = new Set<string>()
  for (const staffId of onboardingStaffIds) {
    if (seen.has(staffId)) {
      continue
    }
    seen.add(staffId)

    const account = context.staffAccounts.find(entry => entry.staffId === staffId)
    if (account && await trySignIn(client, account.email, context.authPassword)) {
      return
    }
  }

  const ownerAccount = context.staffAccounts.find(
    account => account.staffId === context.ownerStaffId,
  )
  const ownerMember = context.dataset.entities.staffMembers?.find(member => member.id === context.ownerStaffId)
  if (ownerAccount && ownerMember) {
    client.clearCookies()
    const provisioner = new HttpAuthProvisioner(client)
    await provisioner.ensureUser({
      email: ownerAccount.email,
      password: context.authPassword,
      name: `${ownerMember.firstName} ${ownerMember.lastName}`,
    })
    if (await trySignIn(client, ownerAccount.email, context.authPassword)) {
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
  const context = resolveDevSeedContext()

  await signInForOnboarding(client)

  if (await probeCoreAccess(client) === 'authorized') {
    return
  }

  const ownerMember = context.dataset.entities.staffMembers?.find(
    member => member.id === context.minimalStaffId,
  )
  const ownerAccount = context.staffAccounts.find(
    account => account.staffId === context.minimalStaffId,
  )
  if (!ownerMember || !ownerAccount) {
    throw new Error('Dev owner fixture is missing from seed data')
  }

  const ownerName = splitDisplayName(`${ownerMember.firstName} ${ownerMember.lastName}`)
  const school = context.dataset.entities.school
  const { response, body } = await client.jsonRequest('/core/onboarding/register-school', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': 'http-seed-bootstrap',
    },
    body: JSON.stringify({
      id: context.schoolId,
      name: school?.name,
      timeZone: school?.timeZone,
      country: school?.country,
      city: school?.city,
      ownerStaffId: context.minimalStaffId,
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
