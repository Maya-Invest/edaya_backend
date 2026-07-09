import type { RunHttpDevSeedsOptions } from '../runtime/types'
import type { SeedDoctorFinding, SeedDoctorResult } from './seed-doctor'
import { bootstrapHttpCoreSession } from '../bootstrap/session/http-core-session'
import { runHttpSeedDoctor } from './seed-doctor'

export type SeedDoctorRepairScope = 'auth:link' | 'access' | 'profile-pictures' | 'service-account'

export interface SeedDoctorRepairStep {
  scope: SeedDoctorRepairScope
  codes: readonly string[]
}

export interface SeedDoctorRepairResult {
  before: SeedDoctorResult
  after: SeedDoctorResult
  repairs: readonly SeedDoctorRepairScope[]
}

/** Ordered minimal HTTP repair chain for common local drift (no wipe). */
export const SEED_DOCTOR_REPAIR_CHAIN: readonly SeedDoctorRepairStep[] = [
  { scope: 'auth:link', codes: ['staff-unlinked'] },
  { scope: 'service-account', codes: ['service-account-key-rejected', 'service-account-grants'] },
  { scope: 'access', codes: ['access-assignments-missing'] },
  { scope: 'profile-pictures', codes: ['profile-photos-missing'] },
]

export function deriveRepairScopesFromFindings(
  findings: readonly SeedDoctorFinding[],
): SeedDoctorRepairScope[] {
  const codes = new Set(
    findings
      .filter(entry => entry.severity === 'warn')
      .map(entry => entry.code),
  )

  return SEED_DOCTOR_REPAIR_CHAIN
    .filter(step => step.codes.some(code => codes.has(code)))
    .map(step => step.scope)
}

async function runRepairScope(
  scope: SeedDoctorRepairScope,
  options: RunHttpDevSeedsOptions,
): Promise<void> {
  if (scope === 'service-account') {
    try {
      await bootstrapHttpCoreSession(options.client)
    }
    catch {
      // Owner session may already be active from a prior repair step.
    }
  }

  const { runHttpDevSeeds } = await import('../runtime/orchestrator')
  await runHttpDevSeeds({
    ...options,
    scope,
    provisionServiceAccount: false,
    log: undefined,
  })
}

export async function runHttpSeedDoctorWithRepair(
  options: RunHttpDevSeedsOptions,
): Promise<SeedDoctorRepairResult> {
  const before = await runHttpSeedDoctor(options.client, options.serviceAccountApiKey)
  if (before.status === 'healthy') {
    return { before, after: before, repairs: [] }
  }

  if (before.status === 'broken') {
    return { before, after: before, repairs: [] }
  }

  const repairs = deriveRepairScopesFromFindings(before.findings)
  if (repairs.length === 0) {
    return { before, after: before, repairs: [] }
  }

  for (const scope of repairs) {
    // eslint-disable-next-line no-console
    console.log(`Seed doctor repair: running \`bun repo seed --scope ${scope}\`...`)
    await runRepairScope(scope, options)
  }

  const after = await runHttpSeedDoctor(options.client, options.serviceAccountApiKey)
  return { before, after, repairs }
}

export function logSeedDoctorRepairResult(result: SeedDoctorRepairResult): void {
  if (result.repairs.length === 0) {
    return
  }

  // eslint-disable-next-line no-console
  console.log(`Seed doctor repair: ran ${result.repairs.join(' → ')}.`)

  if (result.after.status === 'healthy') {
    // eslint-disable-next-line no-console
    console.log('Seed doctor repair: database is healthy after repairs.')
    return
  }

  if (result.after.status === 'repairable') {
    // eslint-disable-next-line no-console
    console.log('Seed doctor repair: some repairable issues remain (see above).')
    return
  }

  // eslint-disable-next-line no-console
  console.log('Seed doctor repair: database is still not ready for dev login.')
}
