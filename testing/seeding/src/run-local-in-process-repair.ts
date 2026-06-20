/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import type { AuthProvisioner, SeedApplication } from './types'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { createHandlerAuthProvisioner } from './auth/handler-auth-provisioner'
import { syncDevStaffAuthAndOwner } from './dev-staff-auth-seed'
import { loadSeedEnvFiles } from './load-seed-env'
import { runDevAuthProvision } from './run-dev-auth-provision'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(packageRoot, '../..')

export function isLocalPersistedPgliteDev(): boolean {
  const databaseUrl = process.env['DATABASE_URL'] ?? process.env['SEED_DATABASE_URL'] ?? ''
  return databaseUrl.startsWith('pglite:.data')
    || databaseUrl.startsWith('pglite:.\\data')
    || databaseUrl.includes('pglite:.data/')
}

export interface LocalInProcessSeedContext {
  application: SeedApplication
  auth: AuthProvisioner
}

export async function createLocalInProcessSeedContext(): Promise<LocalInProcessSeedContext> {
  if (!isLocalPersistedPgliteDev()) {
    throw new Error('In-process local seeding is only supported for local persisted PGlite dev databases')
  }

  loadSeedEnvFiles()

  const apiRuntimeModule = await import(path.join(repoRoot, 'apps/api/src/runtime/index.ts'))
  const env = apiRuntimeModule.loadNodeProcessEnv()
  const runtime = await apiRuntimeModule.getApiRuntime(env)

  return {
    application: await runtime.getSchoolApplication(),
    auth: createHandlerAuthProvisioner(runtime.getAuth(), env.BETTER_AUTH_URL),
  }
}

/** Repair dev auth links directly against the local PGlite database (no /core HTTP session). */
export async function runLocalInProcessStaffAuthSync(): Promise<void> {
  const { application, auth } = await createLocalInProcessSeedContext()
  await runDevAuthProvision(auth)
  await syncDevStaffAuthAndOwner(application, auth)
}
