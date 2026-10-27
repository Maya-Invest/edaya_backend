import type { StageEvidence } from '../qualification'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { integrationInventory } from '../integration-groups'
import { invalidateQualification, requiredStages, validateStageEvidence } from '../qualification'
import { writeJson } from '../runtime'

const context = { sourceCommit: 'a'.repeat(40), environment: 'staging', runId: '12', attempt: '2' }
const evidence = (): StageEvidence[] => requiredStages.map(stage => ({ ...context, stage, status: 'passed', durationMs: 10 }))

test('qualification requires complete, successful evidence from this exact candidate and attempt', () => {
  expect(() => validateStageEvidence(evidence(), context)).not.toThrow()
  for (const key of ['sourceCommit', 'environment', 'runId', 'attempt'] as const) {
    const records = evidence()
    records[0]![key] = 'different'
    expect(() => validateStageEvidence(records, context)).toThrow('mismatched')
  }
  for (const status of ['failed', 'running', 'skipped'] as const) {
    const records = evidence()
    records[0]!.status = status as StageEvidence['status']
    expect(() => validateStageEvidence(records, context)).toThrow()
  }
  expect(() => validateStageEvidence(evidence().slice(1), context)).toThrow()
  const duplicate = evidence()
  duplicate[0] = duplicate[1]!
  expect(() => validateStageEvidence(duplicate, context)).toThrow()
  expect(() => validateStageEvidence([...evidence(), evidence()[0]!], context)).toThrow()
})

test('every mandatory integration file has one owner; optional live/benchmark suites stay excluded', () => {
  const groups = integrationInventory()
  const paths = Object.values(groups).flat()
  expect(Object.values(groups).every(paths => paths.length > 0)).toBe(true)
  expect(new Set(paths).size).toBe(paths.length)
  expect(paths.some(path => path.includes('/benchmarks/') || path.includes('/adaptor-r2/'))).toBe(false)
  expect(groups['seed-native'].some(path => path.endsWith('marks-approval.test.ts'))).toBe(true)
  expect(groups['adapters-http'].some(path => path.includes('/compatibility/'))).toBe(true)
})

test('a new failed qualification cannot leave an older successful candidate deployable', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-qualification-'))
  try {
    writeJson(resolve(directory, '.release/manifest.json'), { status: 'qualified', tests: ['verification', 'integration'], artifacts: { worker: 'hash' } })
    writeJson(resolve(directory, '.ci-evidence/qualification.json'), { checks: { verification: true } })
    invalidateQualification(directory)
    expect(existsSync(resolve(directory, '.ci-evidence/qualification.json'))).toBe(false)
    expect(JSON.parse(readFileSync(resolve(directory, '.release/manifest.json'), 'utf8'))).toEqual({ status: 'built', tests: [], artifacts: { worker: 'hash' } })
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
})
