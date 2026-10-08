import type { ParsedDbCli } from '../parse-db-cli'
import { paths } from '../lib/paths'
import { runBunScript, runRepoCommand } from '../lib/spawn'

export async function runDbCommand(parsed: Exclude<ParsedDbCli, { kind: 'help' }>): Promise<number> {
  switch (parsed.kind) {
    case 'identity-migrate': return runBunScript(paths.identityMigrate, [parsed.target])
    case 'identity-wipe': return runBunScript(paths.identityWipe, [parsed.target, ...(parsed.yes ? ['--yes'] : [])])
    case 'migrate': {
      return runBunScript(paths.dbMigrate, [parsed.target, parsed.slice])
    }
    case 'reset': {
      const args: string[] = [parsed.target]
      if (parsed.yes) {
        args.push('--yes')
      }
      return runBunScript(paths.dbReset, args)
    }
    case 'flatten':
      return runBunScript(paths.dbFlatten, parsed.yes ? ['--yes'] : [])
    case 'generate': {
      return runRepoCommand(['bun', '--filter', '@edaya/adaptor-postgres', 'db:generate'])
    }
    case 'browser':
      return runRepoCommand([
        'bun',
        '--no-env-file',
        paths.dbBrowser,
        parsed.target,
      ])
  }
}
