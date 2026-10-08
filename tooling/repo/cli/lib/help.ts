import { commandCatalog } from '../catalog'

export function repoCliUsage(): string {
  return ['Usage: bun repo <command> [options]', '', ...Object.entries(commandCatalog).map(([name, entry]) => `  ${name.padEnd(18)} ${entry.description}`), '', 'Use bun repo <command> --help for syntax. Unknown arguments are rejected.'].join('\n')
}
