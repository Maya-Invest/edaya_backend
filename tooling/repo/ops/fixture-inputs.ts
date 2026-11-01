import type { ChildProcess } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { waitForUrl } from './runtime'

/** Probe overrides before starting children; bind markers close the release/rebind race. */
export async function fixturePort(value: string | undefined): Promise<string> {
  if (value !== undefined && (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 65535))
    throw new Error('Fixture port must be an integer from 1 to 65535')
  const server = createServer()
  return new Promise((resolve, reject) => {
    server.once('error', () => reject(new Error(`Fixture port ${value ?? 'automatic'} is unavailable`)))
    server.listen(Number(value ?? 0), '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? String(address.port) : ''
      server.close(error => error ? reject(error) : resolve(port))
    })
  })
}

export function fixtureSecret(): string {
  return randomBytes(32).toString('hex')
}

export async function waitForOwnedService(child: ChildProcess, marker: string, token: string, url: string, assertActive: () => void, seconds = 120): Promise<void> {
  const end = Date.now() + seconds * 1000
  while (Date.now() < end) {
    assertActive()
    let ready = false
    try {
      const value = JSON.parse(readFileSync(marker, 'utf8'))
      ready = value.pid === child.pid && value.token === token
    }
    catch { /* Child has not published its bind marker yet. */ }
    if (ready) {
      await waitForUrl(url, Math.max(1, (end - Date.now()) / 1000), assertActive)
      assertActive()
      return
    }
    await Bun.sleep(50)
  }
  throw new Error('Owned service did not publish its readiness marker')
}
