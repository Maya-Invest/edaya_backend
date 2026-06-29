#!/usr/bin/env bun
import { spawnSync } from 'node:child_process'
import process from 'node:process'
import {
  createR2FileStorageFromEnv,
  isR2FileStorageConfigured,
  resolveR2EndpointFromEnv,
} from '@edaya/adaptor-r2'
import { loadLocalProcessEnv } from '../../../apps/api/src/runtime/shared/env/local-loader.ts'

const TEST_BODY = 'r2-credential-check'
const TEST_CONTENT_TYPE = 'text/plain'

async function main() {
  const curlOnly = process.argv.includes('--curl-only')
  const env = loadLocalProcessEnv()

  if (!isR2FileStorageConfigured(env)) {
    console.error('R2 is not configured. Set R2_ENDPOINT (or R2_ACCOUNT_ID), R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME in apps/api/.dev.vars')
    process.exit(1)
  }

  const endpoint = resolveR2EndpointFromEnv(env)
  const storage = createR2FileStorageFromEnv({ env })
  const key = `integration-test/credential-check-${Date.now()}.txt`

  const presigned = await storage.createPresignedUpload({
    key,
    contentType: TEST_CONTENT_TYPE,
    sizeBytes: TEST_BODY.length,
    expiresInSeconds: 300,
  })

  const curlCommand = [
    'curl',
    '-sS',
    '-w',
    '\\nhttp_code=%{http_code}\\n',
    '-X',
    'PUT',
    '-H',
    `Content-Type: ${TEST_CONTENT_TYPE}`,
    '--data-binary',
    TEST_BODY,
    presigned.uploadUrl,
  ]

  console.log('R2 credential check')
  console.log(`  endpoint: ${endpoint}`)
  console.log(`  bucket:   ${env.R2_BUCKET_NAME}`)
  if (env.R2_ACCOUNT_ID) {
    console.log(`  account:  ${env.R2_ACCOUNT_ID}`)
  }
  console.log(`  key:      ${key}`)
  console.log('')
  console.log('Copy/paste:')
  console.log(`curl -sS -w '\\nhttp_code=%{http_code}\\n' -X PUT -H 'Content-Type: ${TEST_CONTENT_TYPE}' --data-binary '${TEST_BODY}' '${presigned.uploadUrl}'`)
  console.log('')

  if (curlOnly) {
    return
  }

  const result = spawnSync(curlCommand[0], curlCommand.slice(1), {
    encoding: 'utf8',
    shell: false,
  })

  if (result.stdout) {
    process.stdout.write(result.stdout)
  }
  if (result.stderr) {
    process.stderr.write(result.stderr)
  }

  const httpCode = result.stdout.match(/http_code=(\d+)/)?.[1]
  const ok = httpCode === '200' || httpCode === '204'

  if (!ok) {
    console.error(`\nR2 credential check failed (HTTP ${httpCode ?? 'unknown'}).`)
    if (result.status !== 0) {
      console.error(`curl exited with code ${result.status}`)
    }
    process.exit(1)
  }

  const head = await storage.headObject(key)
  if (!head) {
    console.error('\nPUT succeeded but headObject returned null.')
    process.exit(1)
  }

  await storage.deleteObject(key)
  console.log('\nR2 credential check passed (PUT + HEAD + DELETE).')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
