import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { help } from '../ops/main'
import { repoRoot } from './lib/paths'

const start = '<!-- repo-commands:start -->'
const end = '<!-- repo-commands:end -->'
export function commandDocumentation(write = false, root = repoRoot): void {
  const file = resolve(root, 'docs/reference/repo-cli.md')
  const text = readFileSync(file, 'utf8')
  const from = text.indexOf(start)
  const to = text.indexOf(end)
  if (from < 0 || to < from)
    throw new Error('Command documentation markers are missing')
  const updated = `${text.slice(0, from + start.length)}\n\n${`\`\`\`text\n${help().trimEnd()}\n\`\`\``}\n\n${text.slice(to)}`
  if (write)
    writeFileSync(file, updated)
  else if (text.replaceAll('\r\n', '\n') !== updated.replaceAll('\r\n', '\n'))
    throw new Error('Command documentation drift. Run bun tooling/repo/cli/command-docs.ts --write')
}
if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.length > 1 || args.some(arg => !['--write', '--check'].includes(arg)))
    throw new Error('Usage: command-docs.ts [--write|--check]')
  commandDocumentation(args[0] === '--write')
}
