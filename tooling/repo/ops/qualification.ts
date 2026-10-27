import { existsSync, readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { integrationGroups } from './integration-groups'
import { qualifyRelease } from './release'
import { environment, files, root, run, sha, writeJson } from './runtime'

export const requiredStages = ['quality', 'unit', 'build', ...integrationGroups.map(group => `integration-${group}`)] as const
export interface StageEvidence {
  stage: string
  sourceCommit: string
  environment: string
  runId: string
  attempt: string
  status: 'running' | 'passed' | 'failed'
  durationMs: number
}
export async function stageContext(target = process.env.CI_TARGET ?? 'staging') {
  return { sourceCommit: sha(await run(['git', 'rev-parse', 'HEAD'], { quiet: true })), environment: environment(target), runId: process.env.GITHUB_RUN_ID ?? 'local', attempt: process.env.GITHUB_RUN_ATTEMPT ?? process.env.EDAYA_QUALIFICATION_ATTEMPT ?? 'local' }
}
export function validateStageEvidence(records: StageEvidence[], expected: Omit<StageEvidence, 'stage' | 'status' | 'durationMs'>): void {
  if (records.length !== requiredStages.length)
    throw new Error('Missing or duplicate qualification stages')
  for (const stage of requiredStages) {
    const matches = records.filter(record => record.stage === stage)
    if (matches.length !== 1 || matches[0]!.status !== 'passed'
      || Object.entries(expected).some(([key, value]) => matches[0]![key as keyof StageEvidence] !== value)) {
      throw new Error(`Missing, failed or mismatched stage: ${stage}`)
    }
  }
}
export async function recordStage(stage: string, action: () => Promise<unknown>, target?: string): Promise<void> {
  const context = await stageContext(target)
  const record: StageEvidence = { ...context, stage, status: 'running', durationMs: 0 }
  const path = resolve(root, `.ci-evidence/stages/${stage}.json`)
  writeJson(path, record)
  const started = performance.now()
  try {
    await action()
    record.status = 'passed'
  }
  catch (error) {
    record.status = 'failed'
    throw error
  }
  finally {
    record.durationMs = performance.now() - started
    writeJson(path, record)
  }
}
export async function finalizeQualification(target: string): Promise<void> {
  invalidateQualification()
  const context = await stageContext(target)
  const records = files(resolve(root, '.ci-evidence/stages')).filter(path => path.endsWith('.json')).map(path => JSON.parse(readFileSync(path, 'utf8')) as StageEvidence)
  validateStageEvidence(records, context)
  writeJson(resolve(root, '.ci-evidence/qualification.json'), { ...context, checks: { verification: true, integration: true, compatibility: true } })
  await qualifyRelease(target)
}
/** A failed new qualification must never leave an older success deployable. */
export function invalidateQualification(directory = root): void {
  rmSync(resolve(directory, '.ci-evidence/qualification.json'), { force: true })
  const manifest = resolve(directory, '.release/manifest.json')
  if (existsSync(manifest)) {
    const record = JSON.parse(readFileSync(manifest, 'utf8'))
    record.status = 'built'
    record.tests = []
    writeJson(manifest, record)
  }
}
export function resetQualification(): void {
  invalidateQualification()
  rmSync(resolve(root, '.ci-evidence/stages'), { recursive: true, force: true })
}
