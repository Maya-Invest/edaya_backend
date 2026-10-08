#!/usr/bin/env bun
import { resolve } from 'node:path'
import process from 'node:process'
import { loadLocalConfiguration } from '../../../apps/api/configuration/index.mjs'

const repoRoot = resolve(import.meta.dirname, '../../..')
const apiRoot = resolve(repoRoot, 'apps/api')

loadLocalConfiguration(process.env, apiRoot)
process.env.LOCAL_OTP_CAPTURE ??= 'true'

console.log(`API and authentication on :${process.env.PORT}, local files on :${process.env.LOCAL_FILES_PORT}. OTP capture: ${process.env.LOCAL_OTP_CAPTURE}.`)

const children = [
  Bun.spawn(['bun', '--no-env-file', '--watch', 'src/entries/local.ts'], {
    cwd: apiRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
  Bun.spawn(['bun', '--no-env-file', '--watch', 'tooling/repo/dev/local-files.ts'], {
    cwd: repoRoot,
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
    env: process.env,
  }),
]

let stopping: Promise<void> | undefined
function shutdown(): Promise<void> {
  return stopping ??= (async () => {
    for (const child of children) child.kill('SIGTERM')
    await Promise.race([Promise.all(children.map(child => child.exited)), new Promise(done => setTimeout(done, 3000))])
    for (const child of children) {
      if (child.exitCode === null)
        child.kill('SIGKILL')
    }
  })()
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    void shutdown().then(() => process.exit(signal === 'SIGINT' ? 130 : 143))
  })
}
const exitCode = await Promise.race(children.map(child => child.exited))
await shutdown()
process.exit(exitCode)
