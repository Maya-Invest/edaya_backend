import type { CompoundRepoCommand } from './parse-repo-cli'
import { dispatchCheckCommand } from './commands/check-dispatch'
import { dispatchDbCommand } from './commands/db-dispatch'
import { dispatchDeployCommand } from './commands/deploy-dispatch'
import { dispatchOpenapiCommand } from './commands/openapi-dispatch'
import { dispatchSmokeTestCommand } from './commands/smoke-test-dispatch'
import { dispatchVerifyCommand } from './commands/verify'

export async function dispatchCompoundCommand(
  command: CompoundRepoCommand,
  forwardArgs: readonly string[],
): Promise<number> {
  switch (command) {
    case 'db':
      return dispatchDbCommand(forwardArgs)
    case 'check':
      return dispatchCheckCommand(forwardArgs)
    case 'smoke-test':
      return dispatchSmokeTestCommand(forwardArgs)
    case 'deploy':
      return dispatchDeployCommand(forwardArgs)
    case 'openapi':
      return dispatchOpenapiCommand(forwardArgs)
    case 'verify':
      return dispatchVerifyCommand(forwardArgs)
  }
}
