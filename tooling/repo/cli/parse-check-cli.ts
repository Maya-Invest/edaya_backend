import { commandUsage } from './catalog'

export type CheckTarget = 'openapi' | 'boundaries' | 'test-naming' | 'commands'

export type ParsedCheckCli
  = | { kind: 'help' }
    | { kind: 'run', target: CheckTarget }

const TARGETS = new Set<CheckTarget>(['openapi', 'boundaries', 'test-naming', 'commands'])

export function parseCheckCliArgs(args: readonly string[]): ParsedCheckCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  if (args.length !== 1)
    throw new Error('Expected exactly one check target')
  const [target] = args
  if (!target || !TARGETS.has(target as CheckTarget)) {
    throw new Error(
      `Unknown check target: ${target ?? '(missing)'}. Valid: ${[...TARGETS].join(', ')}`,
    )
  }

  return { kind: 'run', target: target as CheckTarget }
}

export function checkCliUsage(): string {
  return commandUsage('check')
}
