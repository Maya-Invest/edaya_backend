import type { ParsedCheckCli } from '../parse-check-cli'
import { paths } from '../lib/paths'
import { runBunScript } from '../lib/spawn'

export async function runCheckCommand(parsed: Exclude<ParsedCheckCli, { kind: 'help' }>): Promise<number> {
  switch (parsed.target) {
    case 'openapi':
      return runBunScript(paths.openapiCheck)
    case 'boundaries':
      return runBunScript(paths.checkBoundaries)
    case 'test-naming':
      return runBunScript(paths.checkTestNaming)
  }
}
