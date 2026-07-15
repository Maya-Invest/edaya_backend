import type { ParsedDbCli } from '../parse-db-cli'
import path from 'node:path'
import { paths, repoRoot } from '../lib/paths'
import { runBunScript, runRepoCommand } from '../lib/spawn'

const apiEnvFile = path.join(repoRoot, 'apps/api/.env')

export async function runDbCommand(parsed: Exclude<ParsedDbCli, { kind: 'help' }>): Promise<number> {
  switch (parsed.kind) {
    case 'migrate': {
      const sliceArg = parsed.slice === 'full' ? 'full' : parsed.slice
      return runBunScript(paths.dbMigrate, [parsed.target, sliceArg])
    }
    case 'reset': {
      const args = [parsed.target]
      if (parsed.yes) {
        args.push('--yes')
      }
      return runBunScript(paths.dbReset, args)
    }
    case 'flatten':
      return runBunScript(paths.dbFlatten, [])
    case 'generate': {
      if (parsed.auth) {
        return runRepoCommand(['bun', '--filter', '@edaya/adaptor-auth', 'auth:db:generate'])
      }
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
