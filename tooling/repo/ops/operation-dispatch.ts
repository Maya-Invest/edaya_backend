export type Operation = 'db' | 'seed' | 'vars' | 'secrets' | 'pause' | 'resume' | 'status' | 'smoke'

/** Load only the selected operation, after public argument validation. */
export async function dispatchOperation(command: Operation, args: readonly string[]): Promise<number> {
  switch (command) {
    case 'db': return (await import('../cli/commands/db-dispatch')).dispatchDbCommand(args)
    case 'seed': return (await import('../cli/commands/seed')).dispatchSeedCommand(args)
    case 'vars': return (await import('../cli/commands/vars')).dispatchVarsCommand(args)
    case 'smoke': return (await import('../cli/commands/smoke-test-dispatch')).dispatchSmokeTestCommand(args)
    default: return (await import('../cli/commands/operations')).dispatchOperations(command, args)
  }
}
