import type { ParsedDeployCli } from '../parse-deploy-cli'
import { paths } from '../lib/paths'
import { runRepoCommand } from '../lib/spawn'
import { wranglerEnvNameForDeployTarget } from '../parse-deploy-cli'

export async function runDeployCommand(parsed: Exclude<ParsedDeployCli, { kind: 'help' }>, run = runRepoCommand): Promise<number> {
  return run(
    ['bun', 'wrangler', 'deploy', '--env', wranglerEnvNameForDeployTarget(parsed.target), ...(parsed.dryRun ? ['--dry-run'] : [])],
    { cwd: paths.apiRoot },
  )
}
