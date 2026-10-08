import { commandUsage } from './catalog'

export type SmokeTestTarget = 'staging' | 'notify' | 'r2'
export type ParsedSmokeTestCli = { kind: 'help' } | { kind: 'run', target: SmokeTestTarget, curlOnly?: boolean }
export function parseSmokeTestCliArgs(args: readonly string[]): ParsedSmokeTestCli {
  if (!args.length || args.includes('--help') || args.includes('-h'))
    return { kind: 'help' }
  const [subject, ...rest] = args
  let target: SmokeTestTarget
  if (subject === 'api' && rest.shift() === 'staging') {
    target = 'staging'
  }
  else if (subject === 'staging') {
    target = 'staging'
  }
  else if (subject === 'notify') {
    target = 'notify'
    if (rest[0] === 'local')
      rest.shift()
  }
  else if (subject === 'r2') {
    target = 'r2'
    if (rest[0] === 'staging')
      rest.shift()
  }
  else {
    throw new Error(commandUsage('smoke'))
  }
  if (rest.length > 1 || rest.some(arg => target !== 'r2' || arg !== '--curl-only'))
    throw new Error('Unsupported smoke environment/option; use smoke --help')
  return { kind: 'run', target, ...(rest.length ? { curlOnly: true } : {}) }
}
export function smokeTestCliUsage(): string {
  return commandUsage('smoke')
}
