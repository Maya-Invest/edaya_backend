import type { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import type { runHttpSeedDoctor } from '../diagnostics/seed-doctor'
import type { SeedDoctorRepairResult } from '../diagnostics/seed-doctor-repair'
import type { HttpSeedValidationResult } from '../diagnostics/seed-validation'
import type { DevSeedScope, LogDevSeedResultsOptions, RunDevSeedsResults } from '../orchestration/run-dev-seeds'
import type { SeedProgressReporter } from '../support/seed-progress'
import type { AuthProvisioner } from '../support/types'
import type { HttpSeedClient } from '../transport/http/client'

export type HttpDevSeedScope = DevSeedScope | 'smoke' | 'service-account' | 's2s-clients' | 'validate' | 'doctor'

export interface RunHttpDevSeedsOptions {
  client: HttpSeedClient
  scope: HttpDevSeedScope
  /** Seed domain data through `/core/*` routes with a service account API key. */
  serviceAccountApiKey?: string
  /** Override the default HTTP auth provisioner (for tests). */
  auth?: AuthProvisioner
  /** After `all`, provision a seeding service account when no API key is configured. */
  provisionServiceAccount?: boolean
  /** Skip profile photo uploads (unreachable local-files or `--skip-profile-photos`). */
  skipProfilePhotos?: boolean
  /** Skip fixture attachment registration (`--skip-attachments`). */
  skipAttachments?: boolean
  profilePhotosSkipReason?: string
  /** When scope is `doctor`, run the minimal HTTP repair chain for repairable findings. */
  repair?: boolean
  log?: LogDevSeedResultsOptions
  /** Disable interactive stderr progress bars. */
  noProgress?: boolean
  /** Interactive stderr progress bars (TTY only unless forced). */
  progress?: SeedProgressReporter
}

export interface HttpSmokeSeedResult {
  status: 'passed' | 'failed'
  signInStatus: number
  effectiveGrantsStatus?: number
  reason?: string
}

export interface RunHttpDevSeedsResults extends RunDevSeedsResults {
  smoke: HttpSmokeSeedResult | null
  validation: HttpSeedValidationResult | null
  doctor: Awaited<ReturnType<typeof runHttpSeedDoctor>> | null
  doctorRepair: SeedDoctorRepairResult | null
}

export interface HttpSeedRuntimeContext {
  options: RunHttpDevSeedsOptions
  auth: AuthProvisioner
  client: HttpSeedClient
  scope: HttpDevSeedScope
  serviceAccountApiKey: string | undefined
  profileSeedingApiKey: string
  seedContext: ReturnType<typeof resolveDevSeedContext>
}
