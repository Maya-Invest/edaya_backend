import type { ParsedDeployCli } from '../parse-deploy-cli'
import { paths } from '../lib/paths'
import { runRepoCommand } from '../lib/spawn'
import { wranglerEnvNameForDeployTarget } from '../parse-deploy-cli'

export async function runDeployCommand(parsed: Exclude<ParsedDeployCli, { kind: 'help' }>): Promise<number> {
  if (parsed.kind === 'api') {
    return runRepoCommand(
      ['bun', 'wrangler', 'deploy', '--env', wranglerEnvNameForDeployTarget(parsed.target)],
      { cwd: paths.apiRoot },
    )
  }
  return 1
}
