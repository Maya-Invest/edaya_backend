import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import path from 'node:path'

export interface WipeLocalDataOptions {
  repoRoot: string
}

export interface WipeLocalDataResult {
  removed: boolean
  dataDir: string
}

export function resolveLocalDataDir(repoRoot: string): string {
  return path.join(repoRoot, '.data', 'school')
}

export async function wipeLocalData(options: WipeLocalDataOptions): Promise<WipeLocalDataResult> {
  const dataDir = resolveLocalDataDir(options.repoRoot)

  if (!existsSync(dataDir)) {
    return { removed: false, dataDir }
  }

  await rm(dataDir, { recursive: true, force: true })
  return { removed: true, dataDir }
}
