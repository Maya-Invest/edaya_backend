import type { Binding } from '../operations/worker-vars.ts'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { localOperations } from '../../../apps/api/configuration/local-operations.ts'
import { beginStagingSeed, withSeedPause } from '../operations/seed'

test('local seed excludes concurrent runs, drains active work, and preserves previous controls', async () => {
  const root = mkdtempSync(join(tmpdir(), 'seed-controls-'))
  try {
    const ops = localOperations({ API_ORIGIN: 'http://localhost:9999', DATABASE_URL: 'pglite:school', AUTH_DATABASE_URL: 'pglite:identity', PAUSE_API: true }, root)
    let complete!: () => void
    let started!: () => void
    const ready = new Promise<void>((done) => {
      started = done
    })
    const running = ops.background(['PAUSE_JOBS'], async () => {
      started()
      await new Promise<void>((done) => {
        complete = done
      })
    })
    await ready
    const seed = await ops.beginSeed()
    expect(ops.read().controls).toEqual({ PAUSE_API: true, PAUSE_JOBS: true, PAUSE_SCHEDULER: true })
    await expect(ops.beginSeed()).rejects.toThrow('already running')
    await expect(ops.set({ PAUSE_JOBS: false })).rejects.toThrow('owns')
    let called = false
    await ops.background(['PAUSE_JOBS'], async () => {
      called = true
    })
    expect(called).toBe(false)
    await expect(seed.drain(1)).rejects.toThrow('did not drain')
    complete()
    await running
    await seed.drain()
    await seed.finish(true)
    expect(ops.read().controls).toEqual({ PAUSE_API: true, PAUSE_JOBS: false, PAUSE_SCHEDULER: false })
    await withSeedPause(() => ops.beginSeed(), async () => 1)
    expect(ops.read().controls.PAUSE_JOBS).toBe(true)
    expect(ops.read().seed).toBeNull()
    await ops.set({ PAUSE_JOBS: false, PAUSE_SCHEDULER: false })
    const conflicting = await ops.beginSeed()
    writeFileSync(join(ops.directory, 'state.json'), JSON.stringify({ ...ops.read(), revision: 99 }))
    await expect(conflicting.finish(true)).rejects.toThrow('changed')
  }
  finally { rmSync(root, { recursive: true, force: true }) }
})

function cloud(options: { failResume?: boolean } = {}) {
  let bindings: Binding[] = [{ name: 'PAUSE_API', type: 'plain_text', text: 'false' }, { name: 'PRIVATE', type: 'secret_text' }, { name: 'PHONE_AUTH_MODE', type: 'plain_text', text: 'sms_only' }]
  let settings = { delivery_paused: false, message_retention_period: 86400 }
  let version = 1
  const events: string[] = []
  const request = (async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url)
    let result: unknown
    if (path.includes('/queues')) {
      if (init?.method === 'PUT') {
        settings = JSON.parse(String(init.body)).settings
        events.push(`queue:${settings.delivery_paused}`)
      }
      const queue = { queue_id: 'q', queue_name: 'jobs', settings }
      result = path.includes('?') ? [queue] : queue
    }
    else if (path.endsWith('/deployments')) {
      result = { deployments: [{ id: `d${version}`, versions: [{ version_id: `v${version}`, percentage: 100 }] }] }
    }
    else if (path.endsWith('/versions')) {
      result = { items: [{ id: `v${version}` }] }
    }
    else if (init?.method === 'PATCH') {
      const body = JSON.parse(String((init.body as FormData).get('settings')))
      if (options.failResume && !body.bindings.some((binding: Binding) => binding.name === 'PAUSE_JOBS'))
        return Response.json({ success: false }, { status: 503 })
      bindings = body.bindings.map((binding: Binding) => binding.type === 'inherit' ? bindings.find(old => old.name === binding.name)! : binding)
      version++
      events.push(`controls:${bindings.find(b => b.name === 'PAUSE_JOBS')?.text ?? 'absent'}`)
      result = {}
    }
    else {
      result = { bindings }
    }
    return Response.json({ success: true, result })
  }) as typeof fetch
  return { events, credentials: { accountId: 'a'.repeat(32), token: 'private', worker: 'worker', request }, bindings: () => bindings, settings: () => settings, conflict: () => {
    version++
  } }
}
test('staging pauses before seeding, restores exact absent settings and preserves bindings', async () => {
  const f = cloud()
  await withSeedPause(() => beginStagingSeed(f.credentials, { queueName: 'jobs', wait: async () => {
    f.events.push('drain')
  } }), async () => {
    f.events.push('seed')
    return 0
  })
  expect(f.events).toEqual(['controls:true', 'queue:true', 'drain', 'seed', 'queue:false', 'controls:absent'])
  expect(f.bindings()).toContainEqual({ name: 'PRIVATE', type: 'secret_text' })
  expect(f.bindings()).toContainEqual({ name: 'PHONE_AUTH_MODE', type: 'plain_text', text: 'sms_only' })
  expect(f.settings().message_retention_period).toBe(86400)
})
test('staging failures and concurrent deployment changes retain pauses', async () => {
  for (const conflict of [false, true]) {
    const f = cloud()
    const run = withSeedPause(() => beginStagingSeed(f.credentials, { queueName: 'jobs', wait: async () => {} }), async () => {
      if (conflict)
        f.conflict()
      return conflict ? 0 : 1
    })
    if (conflict)
      await expect(run).rejects.toThrow('changed')
    else expect(await run).toBe(1)
    expect(f.settings().delivery_paused).toBe(true)
    expect(f.bindings().find(b => b.name === 'PAUSE_JOBS')?.text).toBe('true')
  }
})

test('failed restoration pauses queue delivery again', async () => {
  const f = cloud({ failResume: true })
  await expect(withSeedPause(() => beginStagingSeed(f.credentials, { queueName: 'jobs', wait: async () => {} }), async () => 0)).rejects.toThrow('paused again')
  expect(f.settings().delivery_paused).toBe(true)
  expect(f.bindings().find(b => b.name === 'PAUSE_JOBS')?.text).toBe('true')
})
