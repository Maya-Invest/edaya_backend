#!/usr/bin/env bun
import { randomUUID } from 'node:crypto'
/**
 * Novu outbound + webhook smoke test against local API.
 *
 * Prerequisites:
 *   - API running: cd apps/api && bun repo dev  (or bun repo dev from repo root)
 *   - Seed data: bun repo seed  (or bun repo seed --scope doctor to verify)
 *   - apps/api/.env: NOVU_SECRET_KEY (+ NOVU_API_URL for EU)
 *   - Novu dashboard: workflow trigger ids `announcement.published` and `account_invitation`
 *     (or run `bun repo novu bootstrap apply`)
 *   - Optional: NOVU_WEBHOOK_SECRET for local webhook simulation
 */
import { buildSignedNovuWebhookRequest, createNovuInvitationDeliveryPortFromSecretKey } from '@edaya/adaptor-novu'
import {
  executeCoreCommand,
  HttpSeedClient,
  signInViaHttp,
  waitForApi,
} from '@edaya/seeding/http'
import { loadDotenvFiles } from '../../../apps/api/src/runtime/shared/env/local-loader.ts'
import {
  DEV_AUTH_PASSWORD,
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_SCHOOL_ID,
} from '../../fixtures/src/index'

loadDotenvFiles()

const baseUrl = process.env.SCHOOL_API_ORIGIN ?? 'http://localhost:9999'
const director = DEV_AUTH_STAFF_ACCOUNTS.find(a => a.staffId === 'st5') ?? DEV_AUTH_STAFF_ACCOUNTS[0]!
const announcementId = `ann-novu-smoke-${Date.now()}`

interface MessageDeliveryRow {
  id: string
  subjectId: string
  status: string
  providerMessageId?: string
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

async function simulateWebhook(delivery: MessageDeliveryRow): Promise<void> {
  const secret = process.env.NOVU_WEBHOOK_SECRET
  if (!secret) {
    log('Webhook simulation skipped', 'Set NOVU_WEBHOOK_SECRET in apps/api/.env to test status sync locally.')
    return
  }

  const payload = JSON.stringify({
    type: 'message.delivered',
    timestamp: new Date().toISOString(),
    data: {
      object: {
        _id: `novu-sim-${randomUUID()}`,
        transactionId: delivery.id,
        channel: 'in_app',
        subscriberId: delivery.subjectId,
        updatedAt: new Date().toISOString(),
      },
    },
  })

  const request = buildSignedNovuWebhookRequest(secret, `${baseUrl}/webhooks/notification-delivery`, payload)
  const response = await fetch(request)

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    fail(`webhook simulation failed: ${response.status} ${JSON.stringify(body)}`)
  }

  log('Webhook simulated', `POST /webhooks/notification-delivery → ${JSON.stringify(body)}`)
}

async function smokeTransientInvitation(): Promise<string> {
  log('Transient invite subscriber (account_invitation)')
  const invitationId = `inv-smoke-${Date.now()}`
  const subscriberId = `invite:${invitationId}`

  const port = createNovuInvitationDeliveryPortFromSecretKey({
    secretKey: process.env.NOVU_SECRET_KEY!,
    serverURL: process.env.NOVU_API_URL,
  })

  await port.deliver({
    invitationId,
    schoolId: SEED_SCHOOL_ID,
    contactChannel: 'email',
    contactValue: `novu-smoke+${Date.now()}@example.com`,
    displayName: 'Novu Smoke Invitee',
    actorKind: 'staff',
    inviteUrl: `https://app.edaya.test/invite/smoke-${invitationId}`,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    emailSubject: 'Novu smoke test — account invitation',
    emailBody: '<p>Transient invite smoke test from tooling/integration-tests/smoke/novu-e2e.ts — safe to ignore.</p>',
  })

  log('Transient subscriber created + triggered', `${subscriberId} → workflow account_invitation`)

  await port.revoke(invitationId)
  log('Transient subscriber deleted', subscriberId)

  return invitationId
}

async function main() {
  console.log('Novu E2E smoke test')
  console.log(`API: ${baseUrl}`)

  if (!process.env.NOVU_SECRET_KEY) {
    fail('NOVU_SECRET_KEY is not set in apps/api/.env')
  }

  log('Waiting for API')
  await waitForApi(baseUrl, { timeoutMs: 15_000 })

  const inviteTransactionId = await smokeTransientInvitation()

  const client = new HttpSeedClient({
    baseUrl,
    appOrigin: process.env.TRUSTED_ORIGINS?.split(',')[0] ?? 'http://localhost:5173',
  })

  log('Sign in as director', `${director.email}`)
  await signInViaHttp(client, { email: director.email, password: DEV_AUTH_PASSWORD })

  log('Create announcement', announcementId)
  {
    const { response, body } = await executeCoreCommand({
      client,
      commandName: 'create-announcement',
      payload: {
        id: announcementId,
        schoolId: SEED_SCHOOL_ID,
        title: 'Novu smoke test',
        content: 'Published by tooling/integration-tests/smoke/novu-e2e.ts — safe to delete.',
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
    fail(
      'No MessageDelivery rows — guardians may lack linked subjectId. Run: bun repo seed --scope auth:link',
    )
  }

  log('Materialized deliveries', `${deliveries.length} row(s)`)
  for (const row of deliveries.slice(0, 5)) {
    console.log(`  • ${row.id}  subject=${row.subjectId}  status=${row.status}`)
  }
  if (deliveries.length > 5) {
    console.log(`  … and ${deliveries.length - 5} more`)
  }

  const pending = deliveries.filter(d => d.status === 'pending')
  if (pending[0]) {
    await simulateWebhook(pending[0])
    const after = await listDeliveries(client, announcementId)
    const updated = after.find(d => d.id === pending[0]!.id)
    if (updated?.status === 'sent') {
      log('Delivery status updated', `${updated.id} → sent`)
    }
    else if (process.env.NOVU_WEBHOOK_SECRET) {
      log('Delivery still pending', 'Check API logs for webhook handler errors.')
    }
  }

  console.log('\n── Novu dashboard (invite) ──')
  console.log(`1. Filter Activity by transactionId: ${inviteTransactionId}`)
  console.log('2. Confirm workflow `account_invitation` fired to a transient invite:… subscriber')
  console.log('3. Orphan cleanup: bun repo novu cleanup apply -- --transient-invites --yes')

  console.log('\n── Novu dashboard (announcement) ──')
  console.log('1. Open Novu → Activity / Messages')
  console.log(`2. Filter by transactionId prefix: delivery:${announcementId}`)
  console.log('3. Confirm workflow `announcement.published` exists (trigger id must match event key)')
  console.log('4. For real webhook delivery: point Novu webhook URL to your public API')
  console.log('   e.g. https://<tunnel>/webhooks/notification-delivery  +  NOVU_WEBHOOK_SECRET in .env')
  console.log('   Or skip webhooks and run: CRON_JOB_KEYS=reconcilePendingDeliveries bun --filter @edaya/api cron:local')
  console.log('\n✓ Smoke test finished — check API logs for "novu notification failed" if triggers did not appear.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
