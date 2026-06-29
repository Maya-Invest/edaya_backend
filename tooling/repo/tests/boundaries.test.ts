import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { findBoundaryViolations } from '../lib/boundaries.ts'

describe('findBoundaryViolations', () => {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  function createRepoRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'edaya-boundary-test-'))
    temporaryDirectories.push(root)
    return root
  }

  function writeSource(root: string, relativePath: string, contents: string): void {
    const filePath = join(root, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, contents)
  }

  test('reports no violations for clean imports', () => {
    const root = createRepoRoot()
    writeSource(root, 'apps/api/src/runtime/local/resolve-api-runtime.ts', `import type { AppBindings } from '@/http/bindings'\n`)
    writeSource(root, 'apps/api/src/runtime/local/build-runtime.ts', `import { foo } from '../shared/foo'\n`)
    writeSource(root, 'package/domain-core/src/index.ts', `import { bar } from '@edaya/adaptor-postgres'\n`)

    expect(findBoundaryViolations([
      {
        label: 'runtime imports http',
        pattern: /from ["']@\/http\/(?!bindings)/,
        searchPath: 'apps/api/src/runtime',
      },
      {
        label: 'core imports apps',
        pattern: /from ["']@\//,
        searchPath: 'package/domain-core/src',
      },
    ], root)).toEqual([])
  })

  test('reports runtime imports of http layer', () => {
    const root = createRepoRoot()
    writeSource(root, 'apps/api/src/runtime/local/build-runtime.ts', `import { app } from '@/http/app'\n`)

    expect(findBoundaryViolations([
      {
        label: 'runtime imports http',
        pattern: /from ["']@\/http\/(?!bindings)/,
        searchPath: 'apps/api/src/runtime',
      },
    ], root)).toEqual([{
      label: 'runtime imports http',
      matches: ['apps/api/src/runtime/local/build-runtime.ts:1:import { app } from \'@/http/app\''],
    }])
  })

  test('reports core imports of integration packages', () => {
    const root = createRepoRoot()
    writeSource(root, 'package/domain-core/src/index.ts', `import { migrate } from '@edaya/integration-migrations'\n`)

    expect(findBoundaryViolations([
      {
        label: 'core imports integrations',
        pattern: /from ["']@edaya\/integration-migrations/,
        searchPath: 'package/domain-core/src',
      },
    ], root)).toEqual([{
      label: 'core imports integrations',
      matches: ['package/domain-core/src/index.ts:1:import { migrate } from \'@edaya/integration-migrations\''],
    }])
  })

  test('ignores files under excluded directories', () => {
    const root = createRepoRoot()
    writeSource(root, 'apps/api/src/runtime/node_modules/bad.ts', `import { app } from '@/http/app'\n`)
    writeSource(root, 'apps/api/src/runtime/dist/bad.ts', `import { app } from '@/http/app'\n`)

    expect(findBoundaryViolations([
      {
        label: 'runtime imports http',
        pattern: /from ["']@\/http\/(?!bindings)/,
        searchPath: 'apps/api/src/runtime',
      },
    ], root)).toEqual([])
  })
})
