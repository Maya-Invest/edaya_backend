import { dbCliUsage, parseDbCliArgs } from '../parse-db-cli'
import { runDbCommand } from './db'

export async function dispatchDbCommand(forwardArgs: readonly string[]): Promise<number> {
  let parsed
  try {
    parsed = parseDbCliArgs(forwardArgs)
  }
  catch (error) {
    console.error(error instanceof Error ? error.message : error)
    console.error('')
    console.error(dbCliUsage())
    return 1
  }

  if (parsed.kind === 'help') {
    console.log(dbCliUsage())
    return 0
  }

  return runDbCommand(parsed)
}
