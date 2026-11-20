import { existsSync, readFileSync } from 'node:fs'
import { relative } from 'node:path'

export interface GeneratedArtifact {
  generated: string
  tracked: string
}

function filesMatch(generated: string, tracked: string): boolean {
  if (!existsSync(generated) || !existsSync(tracked))
    return false
  const normalize = (path: string) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n')
  return normalize(generated) === normalize(tracked)
}

export function findDriftedArtifacts(
  artifacts: GeneratedArtifact[],
  repoRoot: string,
): string[] {
  return artifacts
    .filter(({ generated, tracked }) => !filesMatch(generated, tracked))
    .map(({ tracked }) => relative(repoRoot, tracked))
}
