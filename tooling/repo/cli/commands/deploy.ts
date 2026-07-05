import type { ParsedDeployCli } from '../parse-deploy-cli'
import { paths } from '../lib/paths'
import { runRepoCommand } from '../lib/spawn'

export async function runDeployCommand(parsed: Exclude<ParsedDeployCli, { kind: 'help' }>): Promise<number> {
  if (parsed.kind === 'api') {
    return runRepoCommand(
      ['bun', 'wrangler', 'deploy', '--env', parsed.target],
      { cwd: paths.apiRoot },
    )
  }
  return 1
}
