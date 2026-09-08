import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'bun:test'
import {
  extractEslintRestrictedImportGlobs,
  findLayoutIdentityViolations,
  globToExistingPathPrefix,
} from '../lib/layout-identity.ts'

describe('layout identity', () => {
  const temporaryDirectories: string[] = []

  afterEach(() => {
    for (const directory of temporaryDirectories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  test('extracts restricted-import files globs from eslint config source', () => {
    const source = `
export default antfu({}, {
  files: ['package/domain-core/src/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { paths: [] }] },
}, {
  files: ['package/domain-authorization/src/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { paths: [] }] },
}, {
  files: ['tooling/repo/**', 'tooling/integration-tests/smoke/**'],
  rules: { 'no-console': 'off' },
})
`
    expect(extractEslintRestrictedImportGlobs(source)).toEqual([
      'package/domain-core/src/**/*.ts',
      'package/domain-authorization/src/**/*.ts',
    ])
  })

  test('strips glob stars to a directory prefix', () => {
    expect(globToExistingPathPrefix('package/domain-authorization/src/**/*.ts')).toBe(
      'package/domain-authorization/src',
    )
  })

  test('passes for the current repo', () => {
    const repoRoot = join(import.meta.dirname, '../../..')
    expect(findLayoutIdentityViolations(repoRoot)).toEqual([])
  })

  test('reports a missing boundary searchPath', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-layout-identity-'))
    temporaryDirectories.push(root)
    writeFileSync(join(root, 'eslint.config.js'), `
export default antfu({}, {
  files: ['package/domain-core/src/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { paths: [] }] },
}, {
  files: ['package/domain-authorization/src/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { paths: [] }] },
})
`)

    const violations = findLayoutIdentityViolations(root)
    expect(violations.some(violation => violation.message.includes('does not exist'))).toBe(true)
  })

  test('reports a restricted-import glob whose directory is missing', () => {
    const root = mkdtempSync(join(tmpdir(), 'edaya-layout-identity-'))
    temporaryDirectories.push(root)
    mkdirSync(join(root, 'apps/api/src/runtime'), { recursive: true })
    mkdirSync(join(root, 'package/domain-core/src'), { recursive: true })
    mkdirSync(join(root, 'package/domain-authorization/src'), { recursive: true })
    mkdirSync(join(root, 'package/domain-service/src'), { recursive: true })
    mkdirSync(join(root, 'package/adaptor-postgres'), { recursive: true })
    mkdirSync(join(root, 'package/adaptor-novu'), { recursive: true })
    mkdirSync(join(root, 'package/adaptor-r2'), { recursive: true })
    mkdirSync(join(root, 'package/adaptor-local-fs'), { recursive: true })
    writeFileSync(join(root, 'package/domain-core/src/index.ts'), 'export {}\n')
    writeFileSync(join(root, 'eslint.config.js'), `
export default antfu({}, {
  files: ['package/domain-core/src/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { paths: [] }] },
}, {
  files: ['package/authorization/src/**/*.ts'],
  rules: { 'no-restricted-imports': ['error', { paths: [] }] },
})
`)

    expect(findLayoutIdentityViolations(root)).toContainEqual({
      label: 'eslint restricted-import globs',
      message: 'glob matches no directory: package/authorization/src/**/*.ts (package/authorization/src)',
    })
  })
})
