import type { SeedProgressReporter } from '../support/seed-progress'
import type { AuthProvisioner } from '../support/types'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { isStagingSeedApiUrl } from '../support/resolve-seed-env'
import { countAuthProvisionAccounts } from '../support/seed-progress'

const AUTH_REQUEST_PAUSE_MS = 250
const STAGING_AUTH_REQUEST_PAUSE_MS = 750

export interface RunDevAuthProvisionOptions {
  /** Remote API origin — enables throttling for HTTP/staging auth provision. */
  baseUrl?: string
  /** Override delay between ensureUser calls. Defaults to 0 in-process, 250ms remote, 750ms staging. */
  pauseBetweenRequestsMs?: number
  progress?: SeedProgressReporter
}

function resolveAuthRequestPauseMs(options: RunDevAuthProvisionOptions): number {
  if (options.pauseBetweenRequestsMs !== undefined) {
    return options.pauseBetweenRequestsMs
  }
  if (!options.baseUrl) {
    return 0
  }
  return isStagingSeedApiUrl(options.baseUrl)
    ? STAGING_AUTH_REQUEST_PAUSE_MS
    : AUTH_REQUEST_PAUSE_MS
}

async function pauseBetweenAuthRequests(options: RunDevAuthProvisionOptions): Promise<void> {
  const delayMs = resolveAuthRequestPauseMs(options)
  if (delayMs === 0) {
    return
  }
  await new Promise(resolve => setTimeout(resolve, delayMs))
}

export type DevAuthProvisionResult
  = | { status: 'seeded', accounts: Array<{ email: string, subjectId: string, kind: 'staff' | 'teacher' | 'guardian' }> }

export async function runDevAuthProvision(
  auth: AuthProvisioner,
  options: RunDevAuthProvisionOptions = {},
): Promise<DevAuthProvisionResult> {
  const context = resolveDevSeedContext()
  const accounts: DevAuthProvisionResult['accounts'] = []
  const totalAccounts = countAuthProvisionAccounts(context)

  const run = async (tick: (by?: number) => void) => {
    for (const account of context.staffAccounts) {
      const { subjectId } = await auth.ensureUser({
        email: account.email,
        password: context.authPassword,
        name: account.name,
      })
      accounts.push({
        email: account.email,
        subjectId,
        kind: 'staff',
      })
      tick()
      await pauseBetweenAuthRequests(options)
    }

    for (const account of context.teacherAccounts) {
      const { subjectId } = await auth.ensureUser({
        email: account.email,
        password: context.authPassword,
        name: account.name,
      })
      accounts.push({
        email: account.email,
        subjectId,
        kind: 'teacher',
      })
      tick()
      await pauseBetweenAuthRequests(options)
    }

    for (const account of context.guardianAccounts) {
      const { subjectId } = await auth.ensureUser({
        email: account.email,
        password: context.authPassword,
        name: account.name,
      })
      accounts.push({
        email: account.email,
        subjectId,
        kind: 'guardian',
      })
      tick()
      await pauseBetweenAuthRequests(options)
    }
  }

  if (options.progress) {
    await options.progress.step(run, { total: totalAccounts })
  }
  else {
    await run(() => {})
  }

  return {
    status: 'seeded',
    accounts,
  }
}
