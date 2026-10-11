import type { ParsedDeployCli } from '../parse-deploy-cli'
import { runRepoCommand } from '../lib/spawn'

export async function runDeployCommand(parsed: Exclude<ParsedDeployCli, { kind: 'help' }>, run = runRepoCommand): Promise<number> {
  return run(
    // Legacy callers receive the same explicit confirmation and evidence policy.
    ['bun', '--no-env-file', 'tooling/repo/ops/main.ts', 'maintenance', 'emergency-deploy', parsed.target, ...(parsed.dryRun ? ['--dry-run'] : [])],
  )
}
