import { commandHelp } from '../ops/command-tree'
import { commands } from '../ops/commands'

/** Internal operation parsers use the public tree for canonical usage text. */
export function commandUsage(command: 'db' | 'seed' | 'vars' | 'secrets' | 'pause' | 'resume' | 'status' | 'smoke'): string {
  return commandHelp(commands.children!.ops!.children![command]!, ['ops', command])
}
