import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { findRuntimeBoundaryViolations } from '../lib/runtime-boundaries.ts'

const VALID_WRANGLER = `
  "compatibility_date": "2026-03-24",
  "browser": {
    "binding": "BROWSER"
  },
  "triggers": {
    "crons": [
      "0 * * * *"
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
    writeFile(root, 'tooling/repo/dev/start-local-dev.ts', 'const filters = ["@edaya/api", "@edaya/local-files-server"]\n')
    writeFile(root, 'apps/api/src/runtime/shared/adapters/notification-gateway.ts', 'env.RUNTIME === "in-memory"\n')
    writeFile(root, 'apps/api/src/runtime/shared/adapters/document-renderer.ts', 'env.RUNTIME === "in-memory"\n')
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

  test('reports legacy notify app when apps/notify exists', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      mkdirSync(join(root, 'apps/notify'), { recursive: true })

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'legacy notify app',
        message: 'apps/notify must be removed; notification send runs in-process on the school API',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('reports a separate notify process in start-local-dev', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      writeFile(root, 'tooling/repo/dev/start-local-dev.ts', 'const filters = ["@edaya/api", "@edaya/notify"]\n')

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'local dev orchestrator',
        message: 'start-local-dev.ts must not start a separate @edaya/notify process',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('reports a docs or Gotenberg process in start-local-dev', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      writeFile(root, 'tooling/repo/dev/start-local-dev.ts', 'const filters = ["@edaya/api", "gotenberg"]\n')

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'local dev orchestrator',
        message: 'start-local-dev.ts must not start Gotenberg or a docs process',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  test('reports leftover Better Auth adapters on the school API', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeBaselineRepoFiles(root)
      writeFile(root, 'apps/api/src/runtime/shared/adapters/better-auth.ts', 'export {}\n')

      expect(findRuntimeBoundaryViolations(root)).toEqual([{
        label: 'school identity extract',
        message: 'apps/api/src/runtime/shared/adapters/better-auth.ts must live in apps/identity, not the school API',
      }])
    }
    finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
