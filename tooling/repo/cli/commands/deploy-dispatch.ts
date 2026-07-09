import { deployCliUsage, parseDeployCliArgs } from '../parse-deploy-cli'
import { runDeployCommand } from './deploy'

export async function dispatchDeployCommand(forwardArgs: readonly string[]): Promise<number> {
  let parsed
  try {
    parsed = parseDeployCliArgs(forwardArgs)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error('')
    console.error(deployCliUsage())
    return 1
  }

  if (parsed.kind === 'help') {
    console.log(deployCliUsage())
    return 0
  }

  return runDeployCommand(parsed)
}
