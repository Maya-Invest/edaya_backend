import type { ParsedDeployCli } from '../parse-deploy-cli'
import { paths } from '../lib/paths'
import { runRepoCommand } from '../lib/spawn'

export async function runDeployCommand(parsed: Exclude<ParsedDeployCli, { kind: 'help' }>): Promise<number> {
  if (parsed.kind === 'api') {
    const script = parsed.target === 'production' ? 'deploy:production' : 'deploy:staging'
    return runRepoCommand(['bun', 'run', script], { cwd: paths.apiRoot })
  }
  return 1
}
