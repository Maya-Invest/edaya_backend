import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'bun:test'
import { parseJsonc } from '../../../apps/api/configuration/index.ts'
import { findWorkerParityViolations } from '../lib/worker-parity'

const fixture = () => parseJsonc(readFileSync(new URL('../../../apps/api/wrangler.jsonc', import.meta.url), 'utf8')) as any

describe('Worker environment parity', () => {
  test('permits separate resource identities and routes', () => {
    expect(findWorkerParityViolations(fixture())).toEqual([])
  })
  for (const [name, change] of Object.entries({
    entrypoint: (p: any) => { p.main = 'other.ts' },
    build: (p: any) => { p.build = { command: 'other-build' } },
    compatibility: (p: any) => { p.compatibility_date = '2026-01-01' },
    binding: (p: any) => { p.browser.binding = 'OTHER_BROWSER' },
    missingBinding: (p: any) => { delete p.send_email },
    schedule: (p: any) => { p.triggers.crons = ['*/2 * * * *'] },
    queue: (p: any) => { p.queues.consumers[0].max_retries = 1 },
    routeBehavior: (p: any) => { p.routes[0].custom_domain = false },
  })) {
    test(`rejects ${name} drift`, () => {
      const config = fixture()
      change(config.env.prod)
      expect(findWorkerParityViolations(config)).toHaveLength(1)
    })
  }
  test('requires both environments', () => {
    const config = fixture()
    delete config.env.prod
    expect(findWorkerParityViolations(config)).toHaveLength(1)
  })
})

test('top-level bindings cannot mask a missing environment binding', () => {
  const config = fixture()
  config.browser = config.env.prod.browser
  delete config.env.prod.browser
  expect(findWorkerParityViolations(config)).toHaveLength(1)
})
