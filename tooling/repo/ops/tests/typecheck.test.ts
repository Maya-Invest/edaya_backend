import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { assertProjectCoverage, readProject, typecheckPlan } from '../../ci/typecheck'
import { validateStageEvidence } from '../qualification'
import { qualityParts } from '../quality'
import { root } from '../runtime'

test('API consolidation retains every root, compiler constraint and alias from absorbed projects', () => {
  const plan = typecheckPlan()
  expect(plan.projects).toContain('tooling/integration-tests/tsconfig.json')
  expect(plan.projects).not.toContain('apps/api/tsconfig.json')
  expect(plan.projects).not.toContain('tooling/repo/tsconfig.api-tools.json')
  expect(plan.preparations).toEqual([{ cwd: 'package/adaptor-docs', command: ['bun', 'scripts/precompile-templates.ts', '--check'] }])
  const original = readProject('apps/api/tsconfig.json')
  const combined = readProject('tooling/integration-tests/tsconfig.json')
  expect(() => assertProjectCoverage(original, combined)).not.toThrow()
  expect(() => assertProjectCoverage(original, { ...combined, fileNames: [] })).toThrow('omits')
  expect(() => assertProjectCoverage(original, { ...combined, options: { ...combined.options, strict: false } })).toThrow('compiler option')
  expect(() => assertProjectCoverage(original, { ...combined, options: { ...combined.options, noCheck: true } })).toThrow('compiler option')
  expect(() => assertProjectCoverage(original, { ...combined, options: { ...combined.options, paths: {} } })).toThrow('alias')
})

test('quality is incomplete when one of lint, types or repository checks is missing or unsuccessful', () => {
  const context = { sourceCommit: 'a'.repeat(40), environment: 'staging', runId: '1', attempt: '1' }
  const reports = qualityParts.map(stage => ({ ...context, stage, status: 'passed' as const, durationMs: 1 }))
  expect(() => validateStageEvidence(reports, context, qualityParts)).not.toThrow()
  expect(() => validateStageEvidence(reports.slice(1), context, qualityParts)).toThrow()
  expect(() => validateStageEvidence(reports.map(report => report.stage === 'types' ? { ...report, status: 'failed' as const } : report), context, qualityParts)).toThrow()
})

test('a warm incremental compiler detects changed imported types and clears repaired diagnostics', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-type-cache-'))
  try {
    const config = resolve(directory, 'tsconfig.json')
    writeFileSync(config, JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'bundler', types: [], strict: true, skipLibCheck: true, noEmit: true }, include: ['*.ts'] }))
    writeFileSync(resolve(directory, 'shared.ts'), 'export interface Shared { value: number }\n')
    writeFileSync(resolve(directory, 'consumer.ts'), 'import type { Shared } from "./shared"; export const result: Shared = { value: 1 };\n')
    const compile = () => Bun.spawnSync([process.execPath, '--no-env-file', resolve(root, 'node_modules/typescript/bin/tsc'), '--project', config, '--noEmit', '--incremental', '--tsBuildInfoFile', resolve(directory, 'state.tsbuildinfo')])
    expect(compile().exitCode).toBe(0)
    expect(compile().exitCode).toBe(0)
    writeFileSync(resolve(directory, 'shared.ts'), 'export interface Shared { value: string }\n')
    const failed = compile()
    expect(failed.exitCode).not.toBe(0)
    expect(failed.stdout.toString()).toContain('not assignable')
    writeFileSync(resolve(directory, 'consumer.ts'), 'import type { Shared } from "./shared"; export const result: Shared = { value: "fixed" };\n')
    expect(compile().exitCode).toBe(0)
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 30000)
