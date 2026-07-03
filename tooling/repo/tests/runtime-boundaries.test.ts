import { describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findRuntimeBoundaryViolations } from '../lib/runtime-boundaries.ts'

describe('findRuntimeBoundaryViolations', () => {
  function writeFile(root: string, relativePath: string, contents: string): void {
    const filePath = join(root, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, contents)
  }

  test('reports no violations for the current repo', () => {
    const repoRoot = join(import.meta.dirname, '../../..')
    expect(findRuntimeBoundaryViolations(repoRoot)).toEqual([])
  })

  test('reports postgres default in apps/api/.env.example', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-runtime-boundary-'))
    try {
      writeFile(root, 'apps/api/.env.example', 'RUNTIME=local\nDATABASE_URL=postgres://localhost/edaya\n')
      writeFile(root, 'apps/api/src/runtime/shared/adapters/file-storage.ts', 'switch (env.RUNTIME) {}\n')
      writeFile(root, 'apps/api/src/runtime/local/school-database.ts', 'export async function createSchoolDatabase() {}\n')
      writeFile(root, 'tooling/repo/dev/start-local-dev.ts', 'const filters = ["@edaya/api", "@edaya/local-files"]\n')
      writeFile(root, 'apps/api/src/runtime/shared/adapters/notification-gateway.ts', 'env.RUNTIME === "in-memory"\n')
      writeFile(root, 'apps/api/src/runtime/shared/adapters/auth-email-delivery.ts', 'env.RUNTIME === "in-memory"\n')

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
})
