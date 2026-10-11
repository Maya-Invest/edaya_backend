#!/usr/bin/env bun
import process from 'node:process'
import {
  createR2FileStorageFromEnv,
  resolveR2EndpointFromEnv,
} from '@edaya/adaptor-r2'
import { redact, run } from '../ops/runtime'
import { loadR2StagingEnv, r2StagingSecretsPath } from './load-r2-dev-env.ts'

const TEST_BODY = 'r2-credential-check'
const TEST_CONTENT_TYPE = 'text/plain'

async function main() {
  const curlOnly = process.argv.includes('--curl-only')
  let env
  try {
    env = loadR2StagingEnv()
  }
  catch (error) {
    console.error(redact(error instanceof Error ? error.message : 'R2 check failed'))
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

  console.log('R2 credential check (staging)')
  console.log(`  secrets:  ${r2StagingSecretsPath}`)
  console.log(`  endpoint: ${endpoint}`)
  console.log(`  bucket:   ${env.R2_BUCKET_NAME}`)
  if (env.R2_ACCOUNT_ID) {
    console.log(`  account:  ${env.R2_ACCOUNT_ID}`)
  }
  console.log(`  key:      ${key}`)
  console.log('')
  if (curlOnly) {
    console.log('Short-lived signed upload command (treat as a credential):')
    console.log(`curl -sS -X PUT -H 'Content-Type: ${TEST_CONTENT_TYPE}' --data-binary '${TEST_BODY}' '${presigned.uploadUrl}'`)
    return
  }

  try {
    const output = await run(curlCommand, { quiet: true, timeout: 60000 })
    const httpCode = output.match(/http_code=(\d+)/)?.[1]
    if (httpCode !== '200' && httpCode !== '204')
      throw new Error(`R2 credential check failed (HTTP ${httpCode ?? 'unknown'}).`)
    const head = await storage.headObject(key)
    if (!head)
      throw new Error('PUT succeeded but headObject returned null.')
  }
  finally {
    await storage.deleteObject(key)
  }

  console.log('\nR2 credential check passed (PUT + HEAD + DELETE).')
}

main().catch((error) => {
  console.error(redact(error instanceof Error ? error.message : 'R2 check failed'))
  process.exit(1)
})
