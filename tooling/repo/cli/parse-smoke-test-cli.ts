export type SmokeTestTarget = 'staging' | 'novu' | 'notify' | 'r2'

export type ParsedSmokeTestCli
  = | { kind: 'help' }
    | { kind: 'run', target: SmokeTestTarget }

const TARGETS = new Set<SmokeTestTarget>(['staging', 'novu', 'notify', 'r2'])

export function parseSmokeTestCliArgs(args: readonly string[]): ParsedSmokeTestCli {
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    return { kind: 'help' }
  }

  const [target] = args
  if (!target || !TARGETS.has(target as SmokeTestTarget)) {
    throw new Error(
      `Unknown smoke-test target: ${target ?? '(missing)'}. Valid: ${[...TARGETS].join(', ')}`,
    )
  }

  return { kind: 'run', target: target as SmokeTestTarget }
}

export function smokeTestCliUsage(): string {
  return [
    'Usage: bun repo smoke-test <target>',
    '',
    'Targets:',
    '  staging      Tier-1 HTTP vs deployed staging API',
    '  novu         Novu outbound + webhook e2e (legacy fallback)',
    '  notify       In-process notify outbound e2e (school API)',
    '  r2           Staging R2 PUT check (apps/api/secrets.staging.json + wrangler staging bucket)',
  ].join('\n')
}
