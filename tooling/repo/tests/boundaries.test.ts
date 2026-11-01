import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { findBoundaryViolations, IMPORT_BOUNDARY_CHECKS } from '../lib/boundaries.ts'

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

  test('extracted operations reject broad services and repository types while allowing named picks', () => {
    const root = createRepoRoot()
    const path = 'package/domain-service/src/capabilities/documents/assembly/payment.ts'
    for (const source of ['function run(base: BaseSchoolService) {}', 'const repositories: SchoolRepositories = all', 'function run(base: DocumentAssemblyContext<keyof SchoolRepositories>) {}']) {
      writeSource(root, path, source)
      expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root).length).toBeGreaterThan(0)
    }
    writeSource(root, path, 'function run(base: DocumentAssemblyContext<\'payments\'>) { return base.repositories.payments }')
    expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root)).toEqual([])
    writeSource(root, 'package/domain-service/src/services/workflows/finance.ts', 'this.baseService.repositories.payments.list()')
    expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root).length).toBeGreaterThan(0)
  })

  test('imports keep parsing, persistence and runtime dependencies out of domain packages', () => {
    const root = createRepoRoot()
    for (const name of ['domain-core', 'domain-authorization', 'domain-service']) {
      const path = `package/${name}/src/imports.ts`
      for (const dependency of ['exceljs', 'xlsx', '@edaya/adaptor-postgres', '@hono/zod-openapi', 'drizzle-orm', 'cloudflare:workers', '../../../apps/api/runtime']) {
        writeSource(root, path, `import { something } from '${dependency}'`)
        expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root).length).toBeGreaterThan(0)
      }
      writeSource(root, path, 'import type { ImportFormatPort } from \'@edaya/core\'')
    }
    expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root)).toEqual([])
    writeSource(root, 'package/adaptor-import-format/src/index.ts', 'import { SchoolService } from \'@edaya/service\'')
    expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root).length).toBeGreaterThan(0)
  })

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

  test('API runtime accepts the lightweight client contract and rejects repository tooling', () => {
    const root = createRepoRoot()
    const sourcePath = 'apps/api/src/client-bindings.ts'
    for (const specifier of ['@edaya/repo', '@edaya/client-codegen', '../../../tooling/repo/codegen/src/index']) {
      writeSource(root, sourcePath, `import { bindings } from '${specifier}'\n`)
      expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root).length).toBeGreaterThan(0)
    }
    writeSource(root, sourcePath, `import { bindings } from '@maya-invest/edaya-api-client/contract'\n`)
    expect(findBoundaryViolations(IMPORT_BOUNDARY_CHECKS, root)).toEqual([])
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

  test('reports core imports of the identity client', () => {
    const root = createRepoRoot()
    writeSource(root, 'package/domain-core/src/index.ts', `import { verifyIdentityToken } from '../../../apps/api/src/identity/server/index'\n`)

    expect(findBoundaryViolations([
      {
        label: 'core imports identity client',
        pattern: /from ["'][^"']*apps\/api\/src\/identity/,
        searchPath: 'package/domain-core/src',
      },
    ], root)).toEqual([{
      label: 'core imports identity client',
      matches: ['package/domain-core/src/index.ts:1:import { verifyIdentityToken } from \'../../../apps/api/src/identity/server/index\''],
    }])
  })

  test('reports core imports of school-service', () => {
    const root = createRepoRoot()
    writeSource(root, 'package/domain-core/src/foo.ts', `import { SchoolService } from '@edaya/service'\n`)

    expect(findBoundaryViolations([
      {
        label: 'core imports school-service',
        pattern: /from ["']@edaya\/service/,
        searchPath: 'package/domain-core/src',
      },
    ], root)).toEqual([{
      label: 'core imports school-service',
      matches: ['package/domain-core/src/foo.ts:1:import { SchoolService } from \'@edaya/service\''],
    }])
  })

  test('reports authorization imports of school-service', () => {
    const root = createRepoRoot()
    writeSource(root, 'package/domain-authorization/src/policy.ts', `import { staffPermissionAssignmentConfig } from '@edaya/service'\n`)

    expect(findBoundaryViolations([
      {
        label: 'authorization imports school-service',
        pattern: /from ["']@edaya\/service/,
        searchPath: 'package/domain-authorization/src',
      },
    ], root)).toEqual([{
      label: 'authorization imports school-service',
      matches: ['package/domain-authorization/src/policy.ts:1:import { staffPermissionAssignmentConfig } from \'@edaya/service\''],
    }])
  })

  test('reports core imports of authorization', () => {
    const root = createRepoRoot()
    writeSource(root, 'package/domain-core/src/domain/foo.ts', `import { Permission } from '@edaya/authorization'\n`)

    expect(findBoundaryViolations([
      {
        label: 'core imports authorization',
        pattern: /from ["']@edaya\/authorization/,
        searchPath: 'package/domain-core/src',
      },
    ], root)).toEqual([{
      label: 'core imports authorization',
      matches: ['package/domain-core/src/domain/foo.ts:1:import { Permission } from \'@edaya/authorization\''],
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
