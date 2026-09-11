import type { ParsedDbCli } from '../parse-db-cli'
import path from 'node:path'
import { paths, repoRoot } from '../lib/paths'
import { runBunScript, runRepoCommand } from '../lib/spawn'

const apiEnvFile = path.join(repoRoot, 'apps/api/.env')

export async function runDbCommand(parsed: Exclude<ParsedDbCli, { kind: 'help' }>): Promise<number> {
  switch (parsed.kind) {
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
      return runBunScript(paths.dbFlatten, [])
    case 'generate': {
      return runRepoCommand(['bun', '--filter', '@edaya/adaptor-postgres', 'db:generate'])
    }
    case 'browser':
      return runRepoCommand([
        'bun',
        '--env-file',
        apiEnvFile,
        paths.dbBrowser,
        parsed.target,
      ])
  }
}
