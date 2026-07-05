export type CheckTarget = 'openapi' | 'boundaries'

export type ParsedCheckCli
  = | { kind: 'help' }
    | { kind: 'run', target: CheckTarget }

const TARGETS = new Set<CheckTarget>(['openapi', 'boundaries'])

export function parseCheckCliArgs(args: readonly string[]): ParsedCheckCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [target] = args
  if (!target || !TARGETS.has(target as CheckTarget)) {
    throw new Error(
      `Unknown check target: ${target ?? '(missing)'}. Valid: ${[...TARGETS].join(', ')}`,
    )
  }

  return { kind: 'run', target: target as CheckTarget }
}

export function checkCliUsage(): string {
  return [
    'Usage: bun repo check <target>',
    '',
    'Targets:',
    '  openapi      OpenAPI drift vs committed fixture',
    '  boundaries   Runtime boundary import rules',
  ].join('\n')
}
