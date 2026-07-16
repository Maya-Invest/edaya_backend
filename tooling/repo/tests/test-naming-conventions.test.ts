import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import { findTestNamingViolations } from '../lib/test-naming.ts'

describe('findTestNamingViolations', () => {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  function createRepoRoot(): string {
    const root = mkdtempSync(join(tmpdir(), 'edaya-test-naming-'))
    temporaryDirectories.push(root)
    return root
  }

  function writeTest(root: string, relativePath: string): void {
    const filePath = join(root, relativePath)
    mkdirSync(join(filePath, '..'), { recursive: true })
    writeFileSync(filePath, 'import { test } from "bun:test"\ntest("ok", () => {})\n')
  }

  test('allows behavior-focused test filenames', () => {
    const root = createRepoRoot()
    writeTest(root, 'package/domain-core/tests/unit/auth/operation-ref-registry-complete.test.ts')

    expect(findTestNamingViolations(root)).toEqual([])
  })

  test('reports forbidden filename segments', () => {
    const root = createRepoRoot()
    writeTest(root, 'package/domain-core/tests/unit/auth/zz-operation-matrix-coverage.test.ts')

    expect(findTestNamingViolations(root)).toEqual([{
      path: 'package/domain-core/tests/unit/auth/zz-operation-matrix-coverage.test.ts',
      segments: ['coverage'],
    }])
  })

  test('skips integration-tests harness paths', () => {
    const root = createRepoRoot()
    writeTest(root, 'tooling/integration-tests/test/coverage-scene.test.ts')

    expect(findTestNamingViolations(root)).toEqual([])
  })
})
