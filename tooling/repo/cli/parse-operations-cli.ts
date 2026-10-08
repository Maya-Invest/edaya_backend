import { commandUsage } from './catalog'

export type RemoteTarget = 'staging' | 'production'
export type OperationCommand = 'secrets' | 'pause' | 'resume' | 'status'
export interface ParsedOperation { command: OperationCommand, target: RemoteTarget, action: string, name?: string, dryRun: boolean }
export function parseOperationsCli(command: OperationCommand, args: readonly string[]): ParsedOperation {
  const rest = [...args]
  const action = command === 'secrets' ? rest.shift()! : command
  const subject = rest.shift()
  const target = rest.shift()
  if (!['staging', 'production'].includes(target ?? ''))
    throw new Error(commandUsage(command))
  if (command === 'pause' || command === 'resume') {
    if (!['api', 'scheduler', 'jobs', 'all'].includes(subject ?? ''))
      throw new Error(commandUsage(command))
  }
  else if (subject !== 'api') {
    throw new Error(commandUsage(command))
  }
  if (command === 'secrets' && !['push', 'delete', 'list'].includes(action))
    throw new Error(commandUsage(command))
  let name: string | undefined
  if (command === 'secrets' && action === 'delete') {
    name = rest.shift()
    if (!name || !/^[A-Z][A-Z0-9_]*$/.test(name))
      throw new Error('Secret delete requires a variable name')
  }
  const allowPreview = command !== 'status' && action !== 'list'
  if (rest.length > 1 || rest.some(flag => !allowPreview || flag !== '--dry-run'))
    throw new Error('Unexpected operation argument')
  return { command, target: target as RemoteTarget, action: command === 'pause' || command === 'resume' ? subject! : action, ...(name ? { name } : {}), dryRun: rest.length > 0 }
}
export function pauseValues(action: string, paused: boolean): Record<string, string> {
  const controls: Record<string, string> = { api: 'PAUSE_API', scheduler: 'PAUSE_SCHEDULER', jobs: 'PAUSE_JOBS' }
  const keys = action === 'all' ? Object.values(controls) : [controls[action]]
  if (keys.some(key => !key))
    throw new Error('Invalid pause control')
  return Object.fromEntries(keys.map(key => [key, String(paused)]))
}
