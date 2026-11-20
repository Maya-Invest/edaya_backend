import type { StageEvidence } from './qualification'
import { readFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { invalidateQualification, recordStage, stageContext, validateStageEvidence } from './qualification'
import { files, root, writeJson } from './runtime'

export const qualityParts = ['checks', 'lint', 'types'] as const
export function resetQuality(): void {
  invalidateQualification()
  rmSync(resolve(root, '.ci-evidence/quality'), { recursive: true, force: true })
  rmSync(resolve(root, '.ci-evidence/stages/quality.json'), { force: true })
}
export async function recordQualityPart(part: typeof qualityParts[number], action: () => Promise<unknown>): Promise<void> {
  await recordStage(part, action, undefined, 'quality')
}
export async function finalizeQuality(): Promise<void> {
  const reports = files(resolve(root, '.ci-evidence/quality')).filter(path => path.endsWith('.json')).map(path => JSON.parse(readFileSync(path, 'utf8')) as StageEvidence)
  const context = await stageContext()
  try {
    await recordStage('quality', async () => validateStageEvidence(reports, context, qualityParts))
  }
  finally {
    const path = resolve(root, '.ci-evidence/stages/quality.json')
    const record = JSON.parse(readFileSync(path, 'utf8')) as StageEvidence
    record.durationMs = reports.reduce((total, report) => total + report.durationMs, 0)
    writeJson(path, record)
  }
}
