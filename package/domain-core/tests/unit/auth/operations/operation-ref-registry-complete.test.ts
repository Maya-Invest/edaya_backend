import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'bun:test'
import { getOperationMatrixCoverage } from '../../../support/operation-matrix'

import './define-operation.test.ts'
import './operation-matrices.test.ts'
import './operation-module.test.ts'

const operationsDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../src/capabilities/authorization/operations',
)

const EXCLUDED_OPERATION_FILES = new Set([
  'assert-operation.ts',
  'define-operation.ts',
  'index.ts',
  'types.ts',
])

async function registeredOperationIds(): Promise<string[]> {
  const entries = await readdir(operationsDir)
  const ids: string[] = []

  for (const entry of entries) {
    if (!entry.endsWith('.ts') || EXCLUDED_OPERATION_FILES.has(entry)) {
      continue
    }
    const text = await readFile(join(operationsDir, entry), 'utf8')
    for (const match of text.matchAll(/id: '([^']+)'/g)) {
      const id = match[1]
      if (id) {
        ids.push(id)
      }
    }
  }

  return [...new Set(ids)].sort()
}

describe('operation matrix registry', () => {
  test('includes every registered OperationRef', async () => {
    const registered = await registeredOperationIds()
    const covered = [...getOperationMatrixCoverage()].sort()
    expect(covered).toEqual(registered)
  })
})
