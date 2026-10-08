import type { WorkerCredentials } from './worker-vars.mjs'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apiRoot, parseJsonc } from '../../../apps/api/configuration/index.mjs'
import { readWorkerState, updateWorkerVariables } from './worker-vars.mjs'

export interface SeedSession { drain: () => Promise<void>, finish: (success: boolean) => Promise<void> }
export async function withSeedPause(begin: () => Promise<SeedSession>, run: () => Promise<number>): Promise<number> {
  const session = await begin()
  let success = false
  try {
    await session.drain()
    const code = await run()
    success = code === 0
    return code
  }
  finally { await session.finish(success) }
}
function canonical(value: unknown): string {
  if (Array.isArray(value))
    return JSON.stringify(value.map(canonical))
  if (value && typeof value === 'object')
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, canonical(v)])))
  return JSON.stringify(value)
}
function fingerprint(value: unknown) {
  return createHash('sha256').update(canonical(value)).digest('hex')
}
function readBoolean(value: unknown): boolean {
  if (value === undefined)
    return false
  if (['true', '1'].includes(String(value).trim().toLowerCase()))
    return true
  if (['false', '0'].includes(String(value).trim().toLowerCase()))
    return false
  throw new Error('Invalid deployed pause control')
}
export async function beginStagingSeed(credentials: WorkerCredentials, options: { queueName?: string, wait?: () => Promise<void> } = {}): Promise<SeedSession> {
  const request = credentials.request ?? fetch
  const before = await readWorkerState(credentials)
  const prior: Record<string, string> = {}
  const missing: string[] = []
  for (const name of ['PAUSE_SCHEDULER', 'PAUSE_JOBS']) {
    const binding = before.bindings.find(binding => binding.name === name)
    if (binding && binding.type !== 'plain_text')
      throw new Error('Pause controls must be non-secret variables')
    if (binding)
      prior[name] = binding.text!
    else missing.push(name)
  }
  if (['PAUSE_SCHEDULER', 'PAUSE_JOBS'].every(name => readBoolean(prior[name])))
    throw new Error('Staging is already paused; use the owning release or resume explicitly before standalone seeding')
  if (readBoolean(before.bindings.find(binding => binding.name === 'PAUSE_API')?.text))
    throw new Error('Staging API is paused')
  const name = options.queueName ?? (parseJsonc(readFileSync(resolve(apiRoot, 'wrangler.jsonc'), 'utf8')) as { env: { staging: { queues: { producers: { binding: string, queue: string }[] } } } }).env.staging.queues.producers.find(binding => binding.binding === 'CRON_JOBS')?.queue
  if (!name)
    throw new Error('Missing staging queue name')
  async function queueRequest(path: string, body?: unknown) {
    try {
      const response = await request(`https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/queues${path}`, {
        method: body ? 'PUT' : 'GET',
        headers: { 'Authorization': `Bearer ${credentials.token}`, 'Content-Type': 'application/json' },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(30000),
      })
      const json = await response.json() as { success: boolean, result: unknown }
      if (!response.ok || !json.success)
        throw new Error('Queue request failed')
      return json.result
    }
    catch { throw new Error('Cloudflare queue operation failed; check queue permissions and state') }
  }
  interface Queue { queue_id: string, queue_name: string, settings: Record<string, unknown> }
  let queue: Queue | undefined
  for (let page = 1; page <= 100; page++) {
    const rows = await queueRequest(`?per_page=100&page=${page}`) as Queue[]
    queue = rows.find(row => row.queue_name === name)
    if (queue || rows.length < 100)
      break
  }
  if (!queue)
    throw new Error('Staging cron queue is missing')
  const id = queue.queue_id
  const previousQueue = queue.settings
  const previousDelivery = readBoolean(queue.settings.delivery_paused)
  let expectedWorker: string
  let expectedQueue: string
  try {
    await updateWorkerVariables({ ...credentials, values: { PAUSE_SCHEDULER: 'true', PAUSE_JOBS: 'true' } })
    await queueRequest(`/${id}`, { queue_name: queue.queue_name, settings: { ...previousQueue, delivery_paused: true } })
    const afterQueue = await queueRequest(`/${id}`) as Queue
    if (afterQueue.settings.delivery_paused !== true)
      throw new Error('Queue pause verification failed')
    expectedQueue = fingerprint(afterQueue.settings)
    expectedWorker = fingerprint(await readWorkerState(credentials))
  }
  catch { throw new Error('Could not establish staging seed pause; inspect status and queue delivery before recovery') }
  return {
    drain: options.wait ?? (() => new Promise(done => setTimeout(done, 60000))),
    async finish(success) {
      if (!success)
        return
      const currentQueue = await queueRequest(`/${id}`) as Queue
      if (fingerprint(await readWorkerState(credentials)) !== expectedWorker || fingerprint(currentQueue.settings) !== expectedQueue)
        throw new Error('Staging changed during seeding; refusing automatic restoration')
      // Queue transport resumes while handlers still retry, then controls restore.
      try {
        await queueRequest(`/${id}`, { queue_name: queue!.queue_name, settings: { ...previousQueue, delivery_paused: previousDelivery } })
        const restored = await queueRequest(`/${id}`) as Queue
        if (readBoolean(restored.settings.delivery_paused) !== previousDelivery)
          throw new Error('Queue resume verification failed')
        await updateWorkerVariables({ ...credentials, values: prior, deletes: missing })
      }
      catch {
        const recovery = await Promise.allSettled([
          updateWorkerVariables({ ...credentials, values: { PAUSE_SCHEDULER: 'true', PAUSE_JOBS: 'true' } }),
          queueRequest(`/${id}`, { queue_name: queue!.queue_name, settings: { ...previousQueue, delivery_paused: true } }),
        ])
        throw new Error(recovery.some(result => result.status === 'rejected')
          ? 'Staging restoration and pause recovery failed; inspect controls and queue delivery immediately'
          : 'Staging restoration failed; background controls and queue delivery were paused again')
      }
    },
  }
}
