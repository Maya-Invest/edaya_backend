import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { findRuntimeBoundaryViolations } from '../lib/runtime-boundaries.ts'

const VALID_WRANGLER = `
  "triggers": {
    "crons": [
      "*/5 * * * *"
    ]
  },
  "queues": {
    "producers": [
      {
        "binding": "CRON_JOBS",
        "queue": "edaya-cron-jobs"
      }
    ]
  }
`

describe('findRuntimeBoundaryViolations', () => {
  function writeFile(root: string, relativePath: string, contents: string): void {
    const filePath = join(root, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, contents)
  }

  function writeBaselineRepoFiles(root: string): void {
    writeFile(root, 'apps/api/.env.example', 'RUNTIME=local\nDATABASE_URL=pglite:.data/school\n')
    writeFile(root, 'apps/api/wrangler.jsonc', VALID_WRANGLER)
    writeFile(root, 'apps/api/src/runtime/shared/adapters/file-storage.ts', 'switch (env.RUNTIME) {}\n')
    writeFile(root, 'apps/api/src/runtime/local/school-database.ts', 'export async function createSchoolDatabase() {}\n')
    writeFile(root, 'tooling/repo/dev/start-local-dev.ts', 'const filters = ["@edaya/api", "@edaya/local-files"]\n')
    writeFile(root, 'apps/api/src/runtime/shared/adapters/notification-gateway.ts', 'env.RUNTIME === "in-memory"\n')
    writeFile(root, 'apps/api/src/runtime/shared/adapters/auth-email-delivery.ts', 'env.RUNTIME === "in-memory"\n')
  }

  test('reports no violations for the current repo', () => {
    const repoRoot = join(import.meta.dirname, '../../..')
    expect(findRuntimeBoundaryViolations(repoRoot)).toEqual([])
  })

  test('reports postgres default in apps/api/.env.example', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      writeFile(root, 'apps/api/.env.example', 'RUNTIME=local\nDATABASE_URL=postgres://localhost/edaya\n')

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'local env example',
        message: 'apps/api/.env.example must not default DATABASE_URL to postgres://',
      }, {
        label: 'local env example',
        message: 'apps/api/.env.example must default DATABASE_URL to pglite:.data/school',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('reports legacy cron app when apps/cron exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      mkdirSync(join(root, 'apps/cron'), { recursive: true })

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'legacy cron app',
        message: 'apps/cron must be removed; scheduled cron runs on @edaya/api worker',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('reports per-job wrangler cron triggers', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      writeFile(root, 'apps/api/wrangler.jsonc', `
        "triggers": { "crons": ["0 2 * * *", "*/5 * * * *"] }
        "queues": { "producers": [{ "binding": "CRON_JOBS", "queue": "edaya-cron-jobs" }] }
      `)

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'wrangler cron',
        message: 'apps/api/wrangler.jsonc must use a single heartbeat cron (*/5 * * * *), not per-job triggers',
      }, {
        label: 'wrangler cron',
        message: 'each wrangler triggers.crons must contain only "*/5 * * * *" (found: 0 2 * * *, */5 * * * *)',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
