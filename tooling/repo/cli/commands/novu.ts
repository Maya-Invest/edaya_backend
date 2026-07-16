import type { ParsedNovuCli } from '../parse-novu-cli'
import { paths } from '../lib/paths'
import { runBunScript } from '../lib/spawn'

export async function runNovuCommand(parsed: Exclude<ParsedNovuCli, { kind: 'help' }>): Promise<number> {
  switch (parsed.kind) {
    case 'bootstrap':
      return runBunScript(paths.novuBootstrap, [parsed.action])
    case 'cleanup':
      return runBunScript(paths.novuCleanup, [parsed.action, ...parsed.forwardArgs])
  }
}
