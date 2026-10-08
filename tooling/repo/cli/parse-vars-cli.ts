import { commandUsage } from './catalog'

export function varsCliUsage() {
  return commandUsage('vars')
}

export function parseVarsCliArgs(args: readonly string[]) {
  if (!args.length || args.includes('--help') || args.includes('-h'))
    return { kind: 'help' as const }
  const [action, app, target, ...rest] = args
  if (!['push', 'delete'].includes(action!) || app !== 'api' || !['staging', 'production'].includes(target!))
    throw new Error(varsCliUsage())
  let dryRun = false
  const replaceSecrets: string[] = []
  let name: string | undefined
  for (let i = 0; i < rest.length; i++) {
    const item = rest[i]
    if (item === '--dry-run') {
      if (dryRun)
        throw new Error('Duplicate --dry-run')
      dryRun = true
    }
    else if (item === '--replace-secret' && action === 'push') {
      const key = rest[++i]
      if (!key || !/^[A-Z][A-Z0-9_]*$/.test(key))
        throw new Error('--replace-secret requires a variable name')
      replaceSecrets.push(key)
    }
    else if (action === 'delete' && !name && item && /^[A-Z][A-Z0-9_]*$/.test(item)) {
      name = item
    }
    else {
      throw new Error(`Unexpected argument: ${item}`)
    }
  }
  if (action === 'delete' && !name)
    throw new Error('Delete requires a variable name')
  return { kind: 'run' as const, action, target: target!, dryRun, replaceSecrets, name }
}
