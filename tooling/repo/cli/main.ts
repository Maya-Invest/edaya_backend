#!/usr/bin/env bun

import { resolve } from 'node:path'
import process from 'node:process'
import { config } from 'dotenv'
import { commandUsage } from './catalog'
import { dispatchCompoundCommand } from './dispatch'
import { repoCliUsage } from './lib/help'
import { repoRoot } from './lib/paths'
import { runBunScript } from './lib/spawn'
import { isCompoundRepoCommand, parseRepoCliArgs } from './parse-repo-cli'
import { resolveRepoCommandScript } from './registry'

let parsed
try {
  parsed = parseRepoCliArgs(process.argv)
}
catch (error) {
  console.error(error instanceof Error ? error.message : error)
  console.error('')
  console.error(repoCliUsage())
  process.exit(1)
}

if (parsed.kind === 'help') {
  console.log(repoCliUsage())
  process.exit(0)
}

if (parsed.forwardArgs.some(arg => arg === '--help' || arg === '-h') && parsed.command !== 'codegen') {
  console.log(commandUsage(parsed.command))
  process.exit(0)
}
if (['dev', 'doctor'].includes(parsed.command) && parsed.forwardArgs.length) {
  console.error(`Unexpected argument: ${parsed.forwardArgs[0]}`)
  process.exit(1)
}
config({ path: resolve(repoRoot, '.env') })
if (isCompoundRepoCommand(parsed.command)) {
  process.exit(await dispatchCompoundCommand(parsed.command, parsed.forwardArgs))
}

const scriptPath = resolveRepoCommandScript(parsed.command)
const exitCode = await runBunScript(scriptPath, parsed.forwardArgs)
process.exit(exitCode)
