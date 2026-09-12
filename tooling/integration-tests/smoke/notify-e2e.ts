#!/usr/bin/env bun
/**
 * In-process notify smoke against the local school API.
 *
 * Prerequisites:
 *   - bun repo dev
 *   - bun repo seed
 *   - apps/api/.env: RUNTIME=local without NOVU_SECRET_KEY (in-process notify)
 */
import { loadDotenvFiles } from '../../../apps/api/src/runtime/shared/env/local-loader.ts'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
} from '../../fixtures/src/index'
import { signInViaHttp } from '../../seeding/src/http/auth'
import { HttpSeedClient } from '../../seeding/src/http/client'
import { executeCoreCommand } from '../../seeding/src/http/core-command'
import { waitForApi } from '../../seeding/src/http/wait-for-api'

loadDotenvFiles()

const baseUrl = process.env.API_ORIGIN ?? 'http://localhost:9999'
const director = DEV_AUTH_STAFF_ACCOUNTS.find(a => a.staffId === 'st5') ?? DEV_AUTH_STAFF_ACCOUNTS[0]!
const announcementId = `ann-notify-smoke-${Date.now()}`

interface MessageDeliveryRow {
  id: string
  subjectId: string
  status: string
}

function log(step: string, detail?: string) {
  console.log(detail ? `\n▸ ${step}\n  ${detail}` : `\n▸ ${step}`)
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`)
  process.exit(1)
}

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map((entry) => {
    if (typeof entry === 'object' && entry !== null && 'data' in entry) {
      const { data, ...rest } = entry as { data: Record<string, unknown> }
      return { ...data, ...rest } as T
    }
    return entry as T
  })
}

async function listDeliveries(client: HttpSeedClient, annId: string): Promise<MessageDeliveryRow[]> {
  const { response, body } = await client.jsonRequest<unknown>(
    '/core/entities/message-deliveries/list',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ announcementId: annId }),
    },
  )
  if (!response.ok) {
    const text = typeof body === 'string' ? body : JSON.stringify(body)
    fail(`list deliveries failed: ${response.status} ${text}`)
  }
  return unwrapEntityList<MessageDeliveryRow>(body)
}

async function main() {
  console.log('In-process notify E2E smoke test')
  console.log(`API: ${baseUrl}`)

  if (process.env.NOVU_SECRET_KEY?.trim()) {
    fail('Unset NOVU_SECRET_KEY in apps/api/.env to exercise in-process notify')
  }

  log('Waiting for API')
  await waitForApi(baseUrl, { timeoutMs: 15_000 })

  const client = new HttpSeedClient({
    baseUrl,
    appOrigin: process.env.TRUSTED_ORIGINS?.split(',')[0] ?? 'http://localhost:5173',
  })

  log('Sign in as director', director.email)
  await signInViaHttp(client, { email: director.email, password: DEV_AUTH_PASSWORD })

  log('Create announcement', announcementId)
  {
    const { response, body } = await executeCoreCommand({
      client,
      commandName: 'create-announcement',
      payload: {
        id: announcementId,
        schoolId: SEED_SCHOOL_ID,
        title: 'Notify smoke test',
        content: 'Published by tooling/integration-tests/smoke/notify-e2e.ts — safe to delete.',
        createdBy: director.staffId,
        priority: 'normal',
      },
    })
    if (!response.ok) {
      fail(`create-announcement: ${response.status} ${JSON.stringify(body)}`)
    }
  }

  log('Add target', 'all_guardians')
  {
    const { response, body } = await executeCoreCommand({
      client,
      commandName: 'add-target',
      payload: {
        id: `target-${announcementId}`,
        announcementId,
        targetKind: 'all_guardians',
      },
    })
    if (!response.ok) {
      fail(`add-target: ${response.status} ${JSON.stringify(body)}`)
    }
  }

  log('Publish announcement')
  {
    const { response, body } = await executeCoreCommand({
      client,
      commandName: 'publish-announcement',
      payload: { announcementId },
    })
    if (!response.ok) {
      fail(`publish-announcement: ${response.status} ${JSON.stringify(body)}`)
    }
  }

  const deliveries = await listDeliveries(client, announcementId)
  if (deliveries.length === 0) {
    fail('No MessageDelivery rows — run: bun repo seed --scope auth:link')
  }
  log('Materialized deliveries', `${deliveries.length} row(s)`)

  const sentOrFailed = deliveries.filter(row => row.status === 'sent' || row.status === 'failed')
  if (sentOrFailed.length === 0) {
    fail('No sent/failed MessageDelivery rows — in-process notify did not apply delivery events')
  }
  log('Delivery events applied', `${sentOrFailed.length} sent/failed of ${deliveries.length}`)

  console.log('\n✓ Notify smoke finished')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
