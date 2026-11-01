import type { ConfiguredR2Environment } from '@edaya/adaptor-r2'
import { resolve } from 'node:path'
import { isR2FileStorageConfigured } from '@edaya/adaptor-r2'
import { readConfig, readSecrets } from '../../../apps/api/configuration/index.ts'
import { loadWranglerDevVars } from './load-wrangler-dev-vars.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')
const stagingSecretsFile = resolve(apiRoot, 'secrets.staging.json')

const R2_DEV_VARS_HELP = 'Set R2 settings in config.staging.jsonc and R2 credentials in apps/api/.dev.vars'
const R2_STAGING_SECRETS_HELP = `Fill R2 credentials in apps/api/secrets.staging.json (copy secrets.json.example). R2 endpoint and bucket come from config.staging.jsonc.`

export interface R2DevEnv extends ConfiguredR2Environment {
  TRUSTED_ORIGINS?: string
}

function toConfiguredR2Env(source: {
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET_NAME?: string
  R2_ACCOUNT_ID?: string
  R2_ENDPOINT?: string
  TRUSTED_ORIGINS?: string
}): R2DevEnv {
  const trustedOrigins = source.TRUSTED_ORIGINS
  if (!isR2FileStorageConfigured(source)) {
    throw new Error('R2 env is incomplete.')
  }

  return {
    R2_ACCESS_KEY_ID: source.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: source.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: source.R2_BUCKET_NAME,
    ...(source.R2_ACCOUNT_ID ? { R2_ACCOUNT_ID: source.R2_ACCOUNT_ID } : {}),
    ...(source.R2_ENDPOINT ? { R2_ENDPOINT: source.R2_ENDPOINT } : {}),
    ...(trustedOrigins ? { TRUSTED_ORIGINS: trustedOrigins } : {}),
  }
}

/** Load staging R2 credentials from `apps/api/secrets.staging.json` + settings from config.staging.jsonc. */
export function loadR2StagingEnv(): R2DevEnv {
  const secrets = readSecrets(stagingSecretsFile)
  const config = readConfig('staging', apiRoot)

  try {
    return toConfiguredR2Env({
      ...config,
      ...secrets,
    })
  }
  catch {
    throw new Error(`R2 staging credentials are incomplete. ${R2_STAGING_SECRETS_HELP}`)
  }
}

/** Load R2 credentials from `apps/api/.dev.vars` without requiring full API runtime env (e.g. DATABASE_URL). */
export function loadR2DevEnv(): R2DevEnv {
  loadWranglerDevVars()

  try {
    return toConfiguredR2Env({
      R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
      R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
      R2_BUCKET_NAME: process.env.R2_BUCKET_NAME,
      R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
      R2_ENDPOINT: process.env.R2_ENDPOINT,
      TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS,
    })
  }
  catch {
    throw new Error(`R2 is not configured. ${R2_DEV_VARS_HELP}`)
  }
}

export const r2StagingSecretsPath = stagingSecretsFile
