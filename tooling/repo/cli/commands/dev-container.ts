import { paths } from '../lib/paths'
import { runRepoCommand } from '../lib/spawn'

export function devContainerCliUsage(): string {
  return [
    'Usage: bun repo dev-container [up|build|down|logs]',
    '',
    'Apple Container dev image for API + local-files (macOS 26, Apple silicon).',
    'Alias: bun run api-dev-container',
    '',
    'Actions:',
    '  up      Build, start, wait for /reference (default)',
    '  build   Build image only',
    '  down    Stop container',
    '  logs    Follow container logs',
  ].join('\n')
}

export async function runDevContainer(forwardArgs: readonly string[]): Promise<number> {
  if (forwardArgs.includes('--help') || forwardArgs.includes('-h')) {
    console.log(devContainerCliUsage())
    return 0
  }

  return runRepoCommand(['bash', paths.devContainer, ...forwardArgs])
}
