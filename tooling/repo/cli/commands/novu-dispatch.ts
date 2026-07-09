import { novuCliUsage, parseNovuCliArgs } from '../parse-novu-cli'
import { runNovuCommand } from './novu'

export async function dispatchNovuCommand(forwardArgs: readonly string[]): Promise<number> {
  let parsed
  try {
    parsed = parseNovuCliArgs(forwardArgs)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error('')
    console.error(novuCliUsage())
    return 1
  }

  if (parsed.kind === 'help') {
    console.log(novuCliUsage())
    return 0
  }

  return runNovuCommand(parsed)
}
