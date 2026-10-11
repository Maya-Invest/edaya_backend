#!/usr/bin/env bun
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import {
  buildBrowserUploadCorsOrigins,
  buildWranglerR2CorsPolicy,
  configureR2BucketCors,
  resolveR2EndpointFromEnv,
} from '@edaya/adaptor-r2'
import { trustedOriginsFromEnv } from '../../../apps/api/src/http/cors.ts'
import { redact, run } from '../ops/runtime'
import { loadR2DevEnv } from './load-r2-dev-env.ts'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')

async function configureWithWrangler(bucketName: string, corsFile: string): Promise<boolean> {
  try {
    await run(['bun', 'x', 'wrangler', 'r2', 'bucket', 'cors', 'set', bucketName, '--file', corsFile, '-y'], { cwd: apiRoot })
    return true
  }
  catch { return false }
}

async function main() {
  let env
  try {
    env = loadR2DevEnv()
  }
  catch (error) {
    console.error(redact(error instanceof Error ? error.message : 'R2 CORS configuration failed'))
    process.exit(1)
  }

  const allowedOrigins = buildBrowserUploadCorsOrigins(trustedOriginsFromEnv(env.TRUSTED_ORIGINS))
  const corsDir = mkdtempSync(join(tmpdir(), 'edaya-r2-cors-'))
  const corsFile = join(corsDir, 'cors.json')
  writeFileSync(corsFile, `${JSON.stringify(buildWranglerR2CorsPolicy(allowedOrigins), null, 2)}\n`)

  console.log('Configuring R2 bucket CORS')
  console.log(`  bucket:   ${env.R2_BUCKET_NAME}`)
  console.log(`  origins:  ${allowedOrigins.join(', ')}`)
  console.log('')

  try {
    if (await configureWithWrangler(env.R2_BUCKET_NAME, corsFile)) {
      console.log('R2 bucket CORS configured via wrangler.')
      return
    }

    console.log('wrangler failed; trying S3 API with R2 credentials...')
    try {
      await configureR2BucketCors({
        accountId: env.R2_ACCOUNT_ID,
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        bucketName: env.R2_BUCKET_NAME,
        endpoint: env.R2_ENDPOINT,
      }, allowedOrigins)
      console.log(`R2 bucket CORS configured via S3 API (${resolveR2EndpointFromEnv(env)}).`)
    }
    catch (error) {
      console.error(redact(error instanceof Error ? error.message : 'R2 CORS configuration failed'))
      console.error('')
      console.error('Could not configure CORS automatically. Either:')
      console.error('  1. Run `wrangler login`, then retry `bun run repo maintenance smoke r2 staging` or tooling/repo/dev/r2-configure-cors.ts')
      console.error('  2. Set CORS manually in Cloudflare dashboard (R2 → bucket → Settings → CORS)')
      console.error(JSON.stringify(buildWranglerR2CorsPolicy(allowedOrigins), null, 2))
      throw new Error('R2 CORS configuration failed')
    }
  }
  finally { rmSync(corsDir, { recursive: true, force: true }) }
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : 'R2 CORS configuration failed'))
  process.exit(1)
})
