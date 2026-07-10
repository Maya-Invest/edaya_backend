import type { ConfiguredR2Environment } from '@edaya/adaptor-r2'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { isR2FileStorageConfigured } from '@edaya/adaptor-r2'
import { loadWranglerDevVars } from './load-wrangler-dev-vars.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')
const stagingSecretsFile = resolve(apiRoot, 'secrets.staging.json')
const wranglerConfigFile = resolve(apiRoot, 'wrangler.jsonc')

const R2_DEV_VARS_HELP = 'Set R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in apps/api/.dev.vars'
const R2_STAGING_SECRETS_HELP = `Fill R2 credentials in apps/api/secrets.staging.json (copy secrets.json.example). Bucket name comes from wrangler.jsonc env.staging.vars.R2_BUCKET_NAME.`

export interface R2DevEnv extends ConfiguredR2Environment {
  TRUSTED_ORIGINS?: string
}

interface WranglerStagingSecrets {
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_ENDPOINT?: string
  R2_ACCOUNT_ID?: string
}

function readWranglerStagingVar(name: string): string | undefined {
  if (!existsSync(wranglerConfigFile)) {
    return undefined
  }

  const stagingBlock = readFileSync(wranglerConfigFile, 'utf8').split('"staging"')[1]?.split('"prod"')[0]
  if (!stagingBlock) {
    return undefined
  }

  const match = stagingBlock.match(new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`))
  return match?.[1]
}

function readStagingSecretsFile(): WranglerStagingSecrets {
  if (!existsSync(stagingSecretsFile)) {
    throw new Error(
      `Missing ${stagingSecretsFile}. ${R2_STAGING_SECRETS_HELP}`,
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(readFileSync(stagingSecretsFile, 'utf8'))
  }
  catch {
    throw new Error(`Invalid JSON in ${stagingSecretsFile}.`)
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Invalid secrets file: ${stagingSecretsFile}.`)
  }

  return parsed as WranglerStagingSecrets
}

function toConfiguredR2Env(source: {
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  R2_BUCKET_NAME?: string
  R2_ACCOUNT_ID?: string
  R2_ENDPOINT?: string
  TRUSTED_ORIGINS?: string
}): R2DevEnv {
  if (!isR2FileStorageConfigured(source)) {
    throw new Error('R2 env is incomplete.')
  }

  return {
    R2_ACCESS_KEY_ID: source.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: source.R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME: source.R2_BUCKET_NAME,
    ...(source.R2_ACCOUNT_ID ? { R2_ACCOUNT_ID: source.R2_ACCOUNT_ID } : {}),
    ...(source.R2_ENDPOINT ? { R2_ENDPOINT: source.R2_ENDPOINT } : {}),
    ...(source.TRUSTED_ORIGINS ? { TRUSTED_ORIGINS: source.TRUSTED_ORIGINS } : {}),
  }
}

/** Load staging R2 credentials from `apps/api/secrets.staging.json` + bucket from wrangler staging vars. */
export function loadR2StagingEnv(): R2DevEnv {
  const secrets = readStagingSecretsFile()
  const r2BucketName = readWranglerStagingVar('R2_BUCKET_NAME')
  const trustedOrigins = readWranglerStagingVar('TRUSTED_ORIGINS')

  try {
    return toConfiguredR2Env({
      ...secrets,
      ...(r2BucketName ? { R2_BUCKET_NAME: r2BucketName } : {}),
      ...(trustedOrigins ? { TRUSTED_ORIGINS: trustedOrigins } : {}),
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
    return toConfiguredR2Env(process.env)
  }
  catch {
    throw new Error(`R2 is not configured. ${R2_DEV_VARS_HELP}`)
  }
}

export const r2StagingSecretsPath = stagingSecretsFile
