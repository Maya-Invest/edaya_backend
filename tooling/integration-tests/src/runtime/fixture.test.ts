import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { buildDownloadTokenPayload, buildUploadTokenPayload, createLocalFileStorageApp, createLocalFileToken } from '../../../../package/adaptor-local-fs/src'
import { fixturePort, fixtureSecret, waitForOwnedService } from '../../../repo/ops/fixture-inputs'
import { root, run, waitForUrl } from '../../../repo/ops/runtime'
import { Services } from '../../../repo/ops/services'

test('occupied healthy ports fail without affecting their owner; defaults allocate available ports', async () => {
  const foreign = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('ok') })
  try {
    await expect(fixturePort(String(foreign.port))).rejects.toThrow('unavailable')
    expect(await fixturePort(undefined)).not.toBe(String(foreign.port))
    expect(await (await fetch(foreign.url)).text()).toBe('ok')
    await expect(fixturePort('0')).rejects.toThrow('integer')
  }
  finally {
    foreign.stop(true)
  }
})

test('a foreign health response cannot replace a matching owned bind marker', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-ready-test-'))
  const marker = resolve(directory, 'ready.json')
  const services = new Services()
  const foreign = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('ok') })
  try {
    const child = services.start('unbound', [process.execPath, '-e', 'setInterval(() => {}, 1000)'], directory, process.env)
    writeFileSync(marker, JSON.stringify({ pid: child.pid, token: 'stale' }))
    await expect(waitForOwnedService(child, marker, 'current', String(foreign.url), () => services.assertRunning(), 0.15)).rejects.toThrow('readiness marker')
    writeFileSync(marker, JSON.stringify({ pid: 0, token: 'current' }))
    await expect(waitForOwnedService(child, marker, 'current', String(foreign.url), () => services.assertRunning(), 0.15)).rejects.toThrow('readiness marker')
    expect((await fetch(foreign.url)).ok).toBe(true)
  }
  finally {
    await services.stop(resolve(directory, 'services.json'))
    foreign.stop(true)
    rmSync(directory, { recursive: true, force: true })
  }
})

test('readiness rechecks process liveness after a successful HTTP response', async () => {
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response('ok') })
  let checks = 0
  try {
    await expect(waitForUrl(String(server.url), 1, () => {
      if (++checks === 2)
        throw new Error('service exited')
    })).rejects.toThrow('service exited')
  }
  finally {
    server.stop(true)
  }
})

test('startup exits and service death abort supervised children promptly', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-supervision-test-'))
  for (const delay of [0, 300]) {
    const services = new Services()
    try {
      const child = services.start('exiting', [process.execPath, '-e', `setTimeout(() => process.exit(1), ${delay})`], directory, process.env)
      const started = Date.now()
      if (delay === 0)
        await expect(waitForOwnedService(child, resolve(directory, 'absent'), 'token', 'http://127.0.0.1:1', () => services.assertRunning(), 2)).rejects.toThrow('Owned service')
      else
        await expect(services.run([process.execPath, '-e', 'setInterval(() => {}, 1000)'], { cwd: directory })).rejects.toThrow('owned service failed')
      expect(Date.now() - started).toBeLessThan(3000)
    }
    finally {
      await services.stop(resolve(directory, 'services.json'))
    }
  }
  rmSync(directory, { recursive: true, force: true })
})

test('fixture signing identity supports upload and download and rejects a different secret', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-files-test-'))
  const secret = fixtureSecret()
  expect(fixtureSecret()).not.toBe(secret)
  const app = createLocalFileStorageApp({ rootDir: directory, baseUrl: 'http://localhost', secret })
  const payload = buildUploadTokenPayload({ key: 'photo.txt', contentType: 'text/plain', sizeBytes: 5 })
  const upload = (signingSecret: string) => app.request(`/upload?token=${createLocalFileToken(signingSecret, payload)}`, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'photo' })
  try {
    expect((await upload(fixtureSecret())).status).toBe(403)
    expect((await upload(secret)).status).toBe(200)
    const response = await app.request(`/download?token=${createLocalFileToken(secret, buildDownloadTokenPayload('photo.txt'))}`)
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('photo')
    expect(readFileSync(resolve(directory, 'photo.txt'), 'utf8')).toBe('photo')
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('real fixture overrides inherited secrets consistently and publishes owned services', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-fixture-smoke-'))
  const script = resolve(directory, 'check.ts')
  writeFileSync(script, `
    import { readFileSync } from 'node:fs';
    import { createLocalFileToken, buildUploadTokenPayload, buildDownloadTokenPayload } from ${JSON.stringify(resolve(root, 'package/adaptor-local-fs/src/index.ts'))};
    const secret = process.env.LOCAL_FILES_SECRET!;
    if (secret === 'inherited-wrong-secret' || !readFileSync(process.env.SEED_ENV_FILE!, 'utf8').includes(secret)) throw new Error('fixture signing identity mismatch');
    if (!(await fetch(process.env.API_URL + '/reference')).ok) throw new Error('API readiness');
    const upload = createLocalFileToken(secret, buildUploadTokenPayload({ key: 'smoke.txt', contentType: 'text/plain', sizeBytes: 5 }));
    const response = await fetch(process.env.LOCAL_FILES_URL + '/upload?token=' + upload, { method: 'PUT', headers: { 'content-type': 'text/plain' }, body: 'photo' });
    if (!response.ok) throw new Error('upload failed');
    const download = createLocalFileToken(secret, buildDownloadTokenPayload('smoke.txt'));
    if (await (await fetch(process.env.LOCAL_FILES_URL + '/download?token=' + download)).text() !== 'photo') throw new Error('download failed');
    console.log('fixture smoke passed');
  `)
  try {
    const output = await run([process.execPath, '--no-env-file', 'tooling/repo/ops/main.ts', 'ci', 'fixture', directory, '--', process.execPath, '--no-env-file', script], { quiet: true, timeout: 60000, env: { ...process.env, LOCAL_FILES_SECRET: 'inherited-wrong-secret' } })
    expect(output).toContain('fixture smoke passed')
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
}, 65000)
