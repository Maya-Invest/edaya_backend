import type { CommandsWithMode, RepoCliCommand } from './catalog'
import { commandCatalog } from './catalog'

export type { RepoCliCommand } from './catalog'
export type RepoBunSpawnCommand = CommandsWithMode<'spawn'>
export type CompoundRepoCommand = CommandsWithMode<'compound'>

export type ParsedRepoCli
  = | { kind: 'help' }
    | { kind: 'run', command: RepoCliCommand, forwardArgs: string[] }

const COMMANDS = new Set(Object.keys(commandCatalog))
export function isCompoundRepoCommand(command: RepoCliCommand): command is CompoundRepoCommand {
  return commandCatalog[command].mode === 'compound'
}

export function parseRepoCliArgs(argv: readonly string[]): ParsedRepoCli {
  const args = argv.slice(2)

  if (args.length === 0) {
    return { kind: 'help' }
  }

  const [command, ...forwardArgs] = args

  if (command === '--help' || command === '-h') {
    return { kind: 'help' }
  }

  if (!COMMANDS.has(command as RepoCliCommand)) {
    const unknown = command ?? '(missing)'
    throw new Error(
      `Unknown repo command: ${unknown}. Valid commands: ${[...COMMANDS].join(', ')}`,
    )
  }

  return {
    kind: 'run',
    command: command as RepoCliCommand,
    forwardArgs,
  }
}
