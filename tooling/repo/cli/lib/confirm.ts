import process from 'node:process'
import { createInterface } from 'node:readline/promises'

export async function confirmOperation(message: string, yes: boolean): Promise<boolean> {
  if (yes)
    return true
  if (!process.stdin.isTTY)
    throw new Error(`${message} Pass --yes to run non-interactively.`)
  const reader = createInterface({ input: process.stdin, output: process.stdout })
  try {
    return ['y', 'yes'].includes((await reader.question(`${message} [y/N] `)).trim().toLowerCase())
  }
  finally { reader.close() }
}
