import type { HttpSeedClient } from '../../transport/http/client'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { splitDisplayName } from '@edaya/fixtures/shared/people'
import { HttpAuthProvisioner, signInSeedAccount } from '../auth/http-provisioner'

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

const CORE_ACCESS_PROBE_ATTEMPTS = 8
const CORE_ACCESS_PROBE_DELAY_MS = 750

async function waitForCoreAccess(client: HttpSeedClient): Promise<'authorized' | 'unauthorized'> {
  let last: 'authorized' | 'unauthorized' = 'unauthorized'
  for (let attempt = 0; attempt < CORE_ACCESS_PROBE_ATTEMPTS; attempt++) {
    last = await probeCoreAccess(client)
    if (last === 'authorized') {
      return last
    }
    if (attempt < CORE_ACCESS_PROBE_ATTEMPTS - 1) {
      await new Promise(resolve => setTimeout(resolve, CORE_ACCESS_PROBE_DELAY_MS * (attempt + 1)))
    }
  }
  return last
}

async function trySignIn(client: HttpSeedClient, email: string, _password: string): Promise<boolean> {
  await signInSeedAccount(client, email)
  return true
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
    + 'Run `bun repo ops seed --scope auth` with the API running, then retry `bun repo ops seed`.',
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
      financeCurrency: school?.financeCurrency,
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
    // School may already exist from a partial prior seed — wait for actor resolution.
    const alreadyLinked = message.includes('SUBJECT_ALREADY_LINKED')
      || message.includes('already linked')
      || response.status === 409
    if (!alreadyLinked) {
      throw new Error(`Failed to bootstrap HTTP core session via onboarding: ${message}`)
    }
  }

  if (await waitForCoreAccess(client) !== 'authorized') {
    throw new Error('HTTP core session bootstrap completed but /core/* is still unauthorized')
  }
}
